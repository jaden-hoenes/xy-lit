// Ported from xyflow (MIT) packages/react/src/additional-components/NodeResizer/NodeResizer.tsx, packages/svelte/src/lib/plugins/NodeResizer/NodeResizer.svelte@3d35b57
import { ContextConsumer } from '@lit/context';
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import type { NodeResizerDefaults } from '@xy-lit/store';
import { XY_RESIZER_HANDLE_POSITIONS, XY_RESIZER_LINE_POSITIONS } from '@xy-lit/store/internal';
import type { OnResize, OnResizeEnd, OnResizeStart, ShouldResize } from '@xy-lit/store/internal';
import { StoreController } from '../controllers/store-controller.js';
import { nodeIdContext } from '../context.js';
import { booleanAttr, numberAttr } from '../elements/xy-flow/attributes.js';

/** Which controls `<xy-node-resizer>` renders. */
export type NodeResizerVariant = 'handles' | 'lines' | 'hover-corner';

const triState = {
  fromAttribute: (value: string | null): boolean | undefined =>
    value === null ? undefined : value !== 'false',
  toAttribute: (value: boolean | undefined): string | null =>
    value === undefined ? null : String(value),
};

/**
 * Resize controls around a node (React `NodeResizer`): four lines and four corner handles by
 * default. Put it inside a node's content, or opt a node type in with `resizer: { ... }` and
 * `<xy-node>` renders it for you.
 *
 * Renders into its own light DOM, so the controls are part of the node and of the flow's single
 * shadow tree. Visible while the node is selected unless `is-visible` says otherwise; the
 * `hover-corner` variant is always rendered and only visible while the node is hovered.
 * @tag xy-node-resizer
 */
export class XyNodeResizerElement extends LitElement {
  static override properties = {
    nodeId: { attribute: 'node-id' },
    variant: { reflect: true },
    color: {},
    handleClass: { attribute: 'handle-class' },
    handleStyle: { attribute: 'handle-style' },
    lineClass: { attribute: 'line-class' },
    lineStyle: { attribute: 'line-style' },
    isVisible: { attribute: 'is-visible', converter: triState },
    minWidth: { attribute: 'min-width', converter: numberAttr(10) },
    minHeight: { attribute: 'min-height', converter: numberAttr(10) },
    maxWidth: { attribute: 'max-width', converter: numberAttr(Number.MAX_VALUE) },
    maxHeight: { attribute: 'max-height', converter: numberAttr(Number.MAX_VALUE) },
    keepAspectRatio: { attribute: 'keep-aspect-ratio', converter: booleanAttr(false) },
    autoScale: { attribute: 'auto-scale', converter: booleanAttr(true) },
    shouldResize: { attribute: false },
    onResizeStart: { attribute: false },
    onResize: { attribute: false },
    onResizeEnd: { attribute: false },
  };

  /** Id of the node to resize. Default: the enclosing node. */
  declare nodeId: string | undefined;
  /** `handles` (default), `lines` or `hover-corner`. */
  declare variant: NodeResizerVariant;
  /** Colour of the controls. */
  declare color: string | undefined;
  /** Extra classes of the corner handles. */
  declare handleClass: string | undefined;
  /** Extra inline style of the corner handles. */
  declare handleStyle: string | undefined;
  /** Extra classes of the lines. */
  declare lineClass: string | undefined;
  /** Extra inline style of the lines. */
  declare lineStyle: string | undefined;
  /** Show the controls. Default: while the node is selected. */
  declare isVisible: boolean | undefined;
  /** Minimum width in px. Default 10. */
  declare minWidth: number;
  /** Minimum height in px. Default 10. */
  declare minHeight: number;
  /** Maximum width in px. */
  declare maxWidth: number;
  /** Maximum height in px. */
  declare maxHeight: number;
  /** Keep the aspect ratio. */
  declare keepAspectRatio: boolean;
  /** Keep handles at constant screen size when zooming out. Default true. */
  declare autoScale: boolean;
  /** Return false to block a resize step. */
  declare shouldResize: ShouldResize | undefined;
  /** Called when a resize starts. */
  declare onResizeStart: OnResizeStart | undefined;
  /** Called on every resize step. */
  declare onResize: OnResize | undefined;
  /** Called when a resize ends. */
  declare onResizeEnd: OnResizeEnd | undefined;

  readonly #idConsumer = new ContextConsumer(this, {
    context: nodeIdContext,
    subscribe: true,
    callback: (value) => {
      this.#contextNodeId = value;
      this.requestUpdate();
    },
  });
  readonly #selected = new StoreController<boolean>(
    this,
    (s) => !!s.nodeLookup.get(this.resolvedNodeId ?? '')?.selected,
  );
  #contextNodeId: string | undefined;

  constructor() {
    super();
    this.nodeId = undefined;
    this.variant = 'handles';
    this.color = undefined;
    this.handleClass = undefined;
    this.handleStyle = undefined;
    this.lineClass = undefined;
    this.lineStyle = undefined;
    this.isVisible = undefined;
    this.minWidth = 10;
    this.minHeight = 10;
    this.maxWidth = Number.MAX_VALUE;
    this.maxHeight = Number.MAX_VALUE;
    this.keepAspectRatio = false;
    this.autoScale = true;
    this.shouldResize = undefined;
    this.onResizeStart = undefined;
    this.onResize = undefined;
    this.onResizeEnd = undefined;
    this.style.display = 'contents';
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** @internal Keeps the consumer referenced (it registers itself on the host). */
  get idConsumer(): ContextConsumer<typeof nodeIdContext, this> {
    return this.#idConsumer;
  }

  /** The id of the node being resized. */
  get resolvedNodeId(): string | undefined {
    return typeof this.nodeId === 'string' ? this.nodeId : this.#contextNodeId;
  }

  /** Sets several properties at once (`NodeTypeDefinition.resizer`). */
  set options(options: NodeResizerDefaults | undefined) {
    if (!options) return;
    if (options.variant !== undefined) this.variant = options.variant;
    if (options.minWidth !== undefined) this.minWidth = options.minWidth;
    if (options.minHeight !== undefined) this.minHeight = options.minHeight;
    if (options.maxWidth !== undefined) this.maxWidth = options.maxWidth;
    if (options.maxHeight !== undefined) this.maxHeight = options.maxHeight;
    if (options.keepAspectRatio !== undefined) this.keepAspectRatio = options.keepAspectRatio;
  }

  #control(position: string, kind: 'handle' | 'line'): TemplateResult {
    const isLine = kind === 'line';
    return html`<xy-resize-control
      .nodeId=${this.nodeId}
      .position=${position}
      .variant=${kind}
      .color=${this.color}
      .controlClass=${isLine ? this.lineClass : this.handleClass}
      .controlStyle=${isLine ? this.lineStyle : this.handleStyle}
      .minWidth=${this.minWidth}
      .minHeight=${this.minHeight}
      .maxWidth=${this.maxWidth}
      .maxHeight=${this.maxHeight}
      .keepAspectRatio=${this.keepAspectRatio}
      .autoScale=${this.autoScale}
      .shouldResize=${this.shouldResize}
      .onResizeStart=${this.onResizeStart}
      .onResize=${this.onResize}
      .onResizeEnd=${this.onResizeEnd}
    ></xy-resize-control>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    const hover = this.variant === 'hover-corner';
    const visible = hover || (this.isVisible ?? this.#selected.value);
    if (!visible) return nothing;
    if (hover) return this.#control('bottom-right', 'handle');
    return html`${XY_RESIZER_LINE_POSITIONS.map((p) => this.#control(p, 'line'))}
    ${
      this.variant === 'handles'
        ? XY_RESIZER_HANDLE_POSITIONS.map((p) => this.#control(p, 'handle'))
        : nothing
    }`;
  }
}
