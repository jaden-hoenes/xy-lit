// Ported from xyflow (MIT) packages/react/src/additional-components/MiniMap/*, packages/svelte/src/lib/plugins/Minimap/*@3d35b57
import { html, nothing, svg } from 'lit';
import type { SVGTemplateResult, TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type {
  AriaLabelConfig,
  CoordinateExtent,
  FlowStore,
  InternalNode,
  Node,
  PanZoomInstance,
  PanelPosition,
  Rect,
  XYMinimapInstance,
} from '@xy-lit/store';
import {
  XYMinimap,
  getBoundsOfRects,
  getInternalNodesBounds,
  getNodeDimensions,
  nodeHasDimensions,
} from '@xy-lit/store/internal';
import { StoreController } from '../controllers/store-controller.js';
import { booleanAttr, numberAttr } from '../elements/xy-flow/attributes.js';
import { FlowPluginElement, positionClasses } from './plugin-base.js';

/** What a custom minimap node renderer receives. */
export type MiniMapNodeProps = {
  /** Node id. */
  id: string;
  /** Absolute x position in flow coordinates. */
  x: number;
  /** Absolute y position in flow coordinates. */
  y: number;
  /** Node width. */
  width: number;
  /** Node height. */
  height: number;
  /** The node's inline `style` string. */
  style: string | undefined;
  /** Whether the node is selected. */
  selected: boolean;
  /** Class from `nodeClass`. */
  className: string;
  /** Fill from `nodeColor`, if any. */
  color: string | undefined;
  /** Corner radius. */
  borderRadius: number;
  /** Stroke from `nodeStrokeColor`, if any. */
  strokeColor: string | undefined;
  /** Stroke width. */
  strokeWidth: number | undefined;
  /** `crispEdges` in Chromium, `geometricPrecision` elsewhere. */
  shapeRendering: string;
  /** Call from your own click handler to emit `minimap-node-click`. */
  onClick: ((event: MouseEvent, id: string) => void) | undefined;
};

/** A minimap node attribute: a constant or a function of the node. */
export type MiniMapNodeAttribute = string | ((node: Node) => string);
/** Renders one node of the minimap. */
export type MiniMapNodeRenderer = (props: MiniMapNodeProps) => SVGTemplateResult;

type MiniMapView = {
  viewBB: Rect;
  boundingRect: Rect;
  flowId: string;
  panZoom: PanZoomInstance | null;
  translateExtent: CoordinateExtent;
  flowWidth: number;
  flowHeight: number;
  ariaLabelConfig: AriaLabelConfig;
  lookupVersion: number;
};

const rectEqual = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const viewEqual = (a: MiniMapView, b: MiniMapView): boolean =>
  rectEqual(a.viewBB, b.viewBB) &&
  rectEqual(a.boundingRect, b.boundingRect) &&
  a.flowId === b.flowId &&
  a.panZoom === b.panZoom &&
  a.translateExtent === b.translateExtent &&
  a.flowWidth === b.flowWidth &&
  a.flowHeight === b.flowHeight &&
  a.ariaLabelConfig === b.ariaLabelConfig &&
  a.lookupVersion === b.lookupVersion;

const filterHidden = (node: { hidden?: boolean }): boolean => !node.hidden;

/** The fill a node's inline style asks for (`background`, then `background-color`). */
function styleFill(style: string | undefined): string | undefined {
  if (!style) return undefined;
  let background: string | undefined;
  let backgroundColor: string | undefined;
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (name === 'background') background = value;
    else if (name === 'background-color') backgroundColor = value;
  }
  return background || backgroundColor;
}

const attributeFn = (value: MiniMapNodeAttribute | undefined): ((node: Node) => string) | null =>
  typeof value === 'function' ? value : value === undefined ? null : () => value;

const shapeRendering =
  typeof window !== 'undefined' && 'chrome' in window ? 'crispEdges' : 'geometricPrecision';

/** The default node shape: a rounded rectangle. */
export const defaultMiniMapNode: MiniMapNodeRenderer = (p) => {
  const fill = p.color || styleFill(p.style);
  const style =
    (fill ? `fill:${fill};` : '') +
    (p.strokeColor ? `stroke:${p.strokeColor};` : '') +
    (p.strokeWidth !== undefined ? `stroke-width:${p.strokeWidth};` : '');
  return svg`<rect
    class="lit-flow__minimap-node ${p.selected ? 'selected' : ''} ${p.className}"
    x=${p.x}
    y=${p.y}
    rx=${p.borderRadius}
    ry=${p.borderRadius}
    width=${p.width}
    height=${p.height}
    style=${style}
    shape-rendering=${p.shapeRendering}
    @click=${p.onClick ? (event: MouseEvent) => p.onClick?.(event, p.id) : nothing}
  ></rect>`;
};

/**
 * An overview of the flow: every node as a rectangle and the visible area as a cut-out in a mask
 * (React `MiniMap`). Optionally pannable and zoomable.
 *
 * @csspart panel - The panel element.
 * @fires minimap-click - The minimap was clicked; `detail` is `{ event, position }` (flow coordinates).
 * @fires minimap-node-click - A node of the minimap was clicked; `detail` is `{ event, node }`.
 * @tag xy-minimap
 */
export class XyMinimapElement extends FlowPluginElement {
  static override properties = {
    position: { reflect: true },
    width: { converter: numberAttr(200) },
    height: { converter: numberAttr(150) },
    pannable: { converter: booleanAttr(false) },
    zoomable: { converter: booleanAttr(false) },
    inversePan: { attribute: 'inverse-pan', converter: booleanAttr(false) },
    zoomStep: { attribute: 'zoom-step', converter: numberAttr(10) },
    offsetScale: { attribute: 'offset-scale', converter: numberAttr(5) },
    nodeColor: { attribute: 'node-color' },
    nodeStrokeColor: { attribute: 'node-stroke-color' },
    nodeClass: { attribute: 'node-class' },
    nodeBorderRadius: { attribute: 'node-border-radius', converter: numberAttr(5) },
    nodeStrokeWidth: { attribute: 'node-stroke-width', converter: numberAttr(NaN) },
    maskColor: { attribute: 'mask-color' },
    maskStrokeColor: { attribute: 'mask-stroke-color' },
    maskStrokeWidth: { attribute: 'mask-stroke-width', converter: numberAttr(NaN) },
    bgColor: { attribute: 'bg-color' },
    ariaLabel: { attribute: 'aria-label' },
    nodeRenderer: { attribute: false },
  };

  /** Where the panel sits. Default `bottom-right`. */
  declare position: PanelPosition;
  /** Width of the minimap in px. Default 200. */
  declare width: number;
  /** Height of the minimap in px. Default 150. */
  declare height: number;
  /** Drag the minimap to pan the flow. */
  declare pannable: boolean;
  /** Scroll over the minimap to zoom the flow. */
  declare zoomable: boolean;
  /** Invert the direction of minimap panning. */
  declare inversePan: boolean;
  /** Zoom speed of wheel zooming on the minimap. Default 10. */
  declare zoomStep: number;
  /** Padding around the nodes, in minimap scale units. Default 5. */
  declare offsetScale: number;
  /** Node fill: a colour or a function of the node. */
  declare nodeColor: MiniMapNodeAttribute | undefined;
  /** Node stroke colour: a colour or a function of the node. */
  declare nodeStrokeColor: MiniMapNodeAttribute | undefined;
  /** Node class: a string or a function of the node. */
  declare nodeClass: MiniMapNodeAttribute | undefined;
  /** Corner radius of nodes. Default 5. */
  declare nodeBorderRadius: number;
  /** Stroke width of nodes. */
  declare nodeStrokeWidth: number;
  /** Fill of the mask outside the visible area. */
  declare maskColor: string | undefined;
  /** Stroke colour of the visible-area outline. */
  declare maskStrokeColor: string | undefined;
  /** Stroke width of the visible-area outline, in screen px. */
  declare maskStrokeWidth: number;
  /** Background colour of the minimap. */
  declare bgColor: string | undefined;
  /** Accessible name (default: the flow's `minimap.ariaLabel`). */
  declare ariaLabel: string | null;
  /** Renders each node; default is a rounded rectangle. */
  declare nodeRenderer: MiniMapNodeRenderer | undefined;

  readonly #view = new StoreController<MiniMapView>(
    this,
    (s) => {
      const [tx, ty, zoom] = s.transform;
      const viewBB: Rect = {
        x: -tx / zoom,
        y: -ty / zoom,
        width: s.width / zoom,
        height: s.height / zoom,
      };
      // the bounds only cover visible nodes; with none, a rect at the origin would stretch them
      let hasVisibleNode = false;
      for (const node of s.nodeLookup.values()) {
        if (!node.hidden) {
          hasVisibleNode = true;
          break;
        }
      }
      return {
        viewBB,
        boundingRect: hasVisibleNode
          ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB)
          : viewBB,
        flowId: s.flowId,
        panZoom: s.panZoom,
        translateExtent: s.translateExtent,
        flowWidth: s.width,
        flowHeight: s.height,
        ariaLabelConfig: s.ariaLabelConfig,
        lookupVersion: s.lookupVersion,
      };
    },
    viewEqual,
  );

  #minimap: XYMinimapInstance | null = null;
  #svg: SVGSVGElement | null = null;
  #panZoom: PanZoomInstance | null = null;
  #viewScale = 1;

  constructor() {
    super();
    this.position = 'bottom-right';
    this.width = 200;
    this.height = 150;
    this.pannable = false;
    this.zoomable = false;
    this.inversePan = false;
    this.zoomStep = 10;
    this.offsetScale = 5;
    this.nodeColor = undefined;
    this.nodeStrokeColor = undefined;
    this.nodeClass = undefined;
    this.nodeBorderRadius = 5;
    this.nodeStrokeWidth = NaN;
    this.maskColor = undefined;
    this.maskStrokeColor = undefined;
    this.maskStrokeWidth = NaN;
    this.bgColor = undefined;
    this.ariaLabel = null;
    this.nodeRenderer = undefined;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#minimap?.destroy();
    this.#minimap = null;
    this.#svg = null;
    this.#panZoom = null;
  }

  protected override updated(): void {
    const { store } = this;
    const svgEl = this.renderRoot.querySelector<SVGSVGElement>('svg.lit-flow__minimap-svg');
    if (!store || !svgEl) return;
    const view = this.#view.value;
    if (view.panZoom && (svgEl !== this.#svg || view.panZoom !== this.#panZoom)) {
      this.#minimap?.destroy();
      this.#svg = svgEl;
      this.#panZoom = view.panZoom;
      this.#minimap = XYMinimap({
        domNode: svgEl,
        panZoom: view.panZoom,
        getTransform: () => store.getState().transform,
        getViewScale: () => this.#viewScale,
      });
    }
    this.#minimap?.update({
      translateExtent: view.translateExtent,
      width: view.flowWidth,
      height: view.flowHeight,
      inversePan: this.inversePan,
      pannable: this.pannable,
      zoomStep: this.zoomStep,
      zoomable: this.zoomable,
    });
  }

  readonly #onSvgClick = (event: MouseEvent): void => {
    const [x, y] = this.#minimap?.pointer(event) ?? [0, 0];
    this.dispatchEvent(
      new CustomEvent('minimap-click', {
        detail: { event, position: { x, y } },
        bubbles: true,
        composed: true,
      }),
    );
  };

  readonly #onNodeClick = (event: MouseEvent, id: string): void => {
    const node = this.store?.getState().nodeLookup.get(id)?.internals.userNode;
    if (!node) return;
    this.dispatchEvent(
      new CustomEvent('minimap-node-click', {
        detail: { event, node },
        bubbles: true,
        composed: true,
      }),
    );
  };

  #nodesMemo: { key: readonly unknown[]; value: { id: string; props: MiniMapNodeProps }[] } | null =
    null;

  /** The nodes to draw; recomputed only when the lookup or an attribute that shapes them changed. */
  #nodes(): { id: string; props: MiniMapNodeProps }[] {
    const { store } = this;
    if (!store) return [];
    const key = [
      this.#view.value.lookupVersion,
      this.nodeColor,
      this.nodeStrokeColor,
      this.nodeClass,
      this.nodeBorderRadius,
      this.nodeStrokeWidth,
    ];
    const memo = this.#nodesMemo;
    if (memo && memo.key.every((value, i) => Object.is(value, key[i]))) return memo.value;
    const value = this.#computeNodes(store);
    this.#nodesMemo = { key, value };
    return value;
  }

  #computeNodes(store: FlowStore): { id: string; props: MiniMapNodeProps }[] {
    const color = attributeFn(this.nodeColor);
    const stroke = attributeFn(this.nodeStrokeColor);
    const className = attributeFn(this.nodeClass);
    const out: { id: string; props: MiniMapNodeProps }[] = [];
    for (const node of store.getState().nodeLookup.values() as Iterable<InternalNode>) {
      if (node.hidden || !nodeHasDimensions(node)) continue;
      const userNode = node.internals.userNode;
      const { x, y } = node.internals.positionAbsolute;
      const { width, height } = getNodeDimensions(node);
      out.push({
        id: node.id,
        props: {
          id: node.id,
          x,
          y,
          width,
          height,
          style: node.style,
          selected: !!node.selected,
          className: className?.(userNode) ?? '',
          color: color?.(userNode),
          borderRadius: this.nodeBorderRadius,
          strokeColor: stroke?.(userNode),
          strokeWidth: Number.isNaN(this.nodeStrokeWidth) ? undefined : this.nodeStrokeWidth,
          shapeRendering,
          onClick: this.#onNodeClick,
        },
      });
    }
    return out;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const { boundingRect, viewBB, flowId, ariaLabelConfig } = this.#view.value;
    const elementWidth = this.width;
    const elementHeight = this.height;
    const viewScale = Math.max(
      boundingRect.width / elementWidth,
      boundingRect.height / elementHeight,
    );
    this.#viewScale = viewScale;
    const viewWidth = viewScale * elementWidth;
    const viewHeight = viewScale * elementHeight;
    const offset = this.offsetScale * viewScale;
    const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
    const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
    const width = viewWidth + offset * 2;
    const height = viewHeight + offset * 2;
    const labelledBy = `lit-flow__minimap-desc-${flowId}`;
    const label = this.ariaLabel ?? ariaLabelConfig['minimap.ariaLabel'];
    const renderNode = this.nodeRenderer ?? defaultMiniMapNode;
    const style =
      (this.bgColor ? `--xy-minimap-background-color-props:${this.bgColor};` : '') +
      (this.maskColor ? `--xy-minimap-mask-background-color-props:${this.maskColor};` : '') +
      (this.maskStrokeColor
        ? `--xy-minimap-mask-stroke-color-props:${this.maskStrokeColor};`
        : '') +
      (Number.isNaN(this.maskStrokeWidth)
        ? ''
        : `--xy-minimap-mask-stroke-width-props:${this.maskStrokeWidth * viewScale};`) +
      (typeof this.nodeColor === 'string'
        ? `--xy-minimap-node-background-color-props:${this.nodeColor};`
        : '') +
      (typeof this.nodeStrokeColor === 'string'
        ? `--xy-minimap-node-stroke-color-props:${this.nodeStrokeColor};`
        : '') +
      (Number.isNaN(this.nodeStrokeWidth)
        ? ''
        : `--xy-minimap-node-stroke-width-props:${this.nodeStrokeWidth};`);
    return html`<div
      class="lit-flow__panel lit-flow__minimap ${positionClasses(this.position)}"
      part="panel"
      data-testid="rf__minimap"
      style=${style}
    >
      <svg
        width=${elementWidth}
        height=${elementHeight}
        viewBox="${x} ${y} ${width} ${height}"
        class="lit-flow__minimap-svg"
        role="img"
        aria-labelledby=${labelledBy}
        @click=${this.#onSvgClick}
      >
        ${label ? svg`<title id=${labelledBy}>${label}</title>` : nothing}
        ${repeat(
          this.#nodes(),
          (n) => n.id,
          (n) => renderNode(n.props),
        )}
        <path
          class="lit-flow__minimap-mask"
          d="M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z"
          fill-rule="evenodd"
          pointer-events="none"
        ></path>
      </svg>
    </div>`;
  }
}
