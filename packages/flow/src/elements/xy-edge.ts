// Ported from xyflow (MIT) packages/svelte/src/lib/components/EdgeWrapper/EdgeWrapper.svelte, packages/react/src/components/EdgeWrapper/index.tsx@3d35b57
import { ContextProvider } from '@lit/context';
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { Directive, directive } from 'lit/async-directive.js';
import type { DirectiveResult, ElementPart } from 'lit/async-directive.js';
import { ARIA_EDGE_DESC_KEY, devWarn, getMarkerUrl } from '@xy-lit/store';
import type { Edge, EdgeLayouted, EdgeProps } from '@xy-lit/store';
import { elementSelectionKeys, errorMessages } from '@xy-lit/store/internal';
import { reconnectAnchors, startReconnect } from '../edges/reconnect-anchors.js';
import type { EdgeEnd } from '../edges/reconnect-anchors.js';
import { edgeIdContext } from '../context.js';
import type { EdgeRenderResult, EdgeTypeDefinition } from '../edges/define-edge-type.js';
import type { EdgeRenderContext, LabelEntry } from '../types.js';
import { cssMs } from './xy-flow/motion.js';

/** `domAttributes` keys that are allowed besides `data-*` and `aria-*`. */
const ALLOWED_DOM_ATTRIBUTES = new Set(['title', 'lang', 'dir', 'tabindex']);
const DATA_OR_ARIA = /^(data|aria)-[a-z0-9-]+$/;

/**
 * Sets and removes attributes on an element part (the edge `<g>`) from a map, applying the
 * `domAttributes` key rules and removing attributes that disappeared.
 */
class SpreadDomAttributesDirective extends Directive {
  private applied = new Set<string>();

  render(attributes: Record<string, string> | undefined): typeof nothing {
    void attributes;
    return nothing;
  }

  override update(part: ElementPart, [attributes]: [Record<string, string> | undefined]) {
    const el = part.element;
    const next = new Set<string>();
    for (const [key, value] of Object.entries(attributes ?? {})) {
      if (!DATA_OR_ARIA.test(key) && !ALLOWED_DOM_ATTRIBUTES.has(key)) {
        devWarn('XYL01', `domAttributes key "${key}" is not allowed and was dropped.`);
        continue;
      }
      next.add(key);
      const text = String(value);
      if (el.getAttribute(key) !== text) el.setAttribute(key, text);
    }
    for (const key of this.applied) if (!next.has(key)) el.removeAttribute(key);
    this.applied = next;
    return nothing;
  }
}
const spreadDomAttributes: (attributes: Record<string, string> | undefined) => DirectiveResult =
  directive(SpreadDomAttributesDirective);

/**
 * One edge of the flow: renders the edge type's SVG into an `<svg><g>` of its own and publishes
 * the type's HTML labels to the flow's label layer. Rendered by `<xy-flow>`; not meant to be
 * created by hand.
 *
 * Renders into its own light DOM; the host itself is `display: contents` and carries no
 * `data-id` (the `<g>` does), so `[data-id="…"]` matches exactly one element.
 *
 * @csspart edge - The edge `<g>`.
 * @csspart edge-svg - The edge `<svg>`.
 * @tag xy-edge
 */
export class XyEdgeElement extends LitElement {
  static override properties = {
    edge: { attribute: false },
    ctx: { attribute: false },
    reconnecting: { state: true },
    anchorHover: { state: true },
    entering: { state: true },
  };

  /** The laid-out edge. */
  declare edge: EdgeLayouted;
  /** Everything the edge needs from its flow. */
  declare ctx: EdgeRenderContext;
  /** True while the edge is being reconnected (its path is hidden). */
  declare reconnecting: boolean;
  /** True while the pointer is over a reconnect anchor (the edge gets the `updating` class). */
  declare anchorHover: boolean;
  /** True while the draw-in animation runs (entrance motion). */
  declare entering: boolean;

  #idContext = new ContextProvider(this, { context: edgeIdContext });
  #warnedTypes = new Set<string>();
  #published: LabelEntry[] = [];
  #publishedTo: EdgeRenderContext['flow'] | null = null;
  #selectable = true;
  #focusable = true;
  #reconnectable: boolean | 'source' | 'target' = false;

  #suppressNextClick = false;
  #enterStarted = false;
  #enterTimer: ReturnType<typeof setTimeout> | undefined;
  #enterRestore: { path: SVGPathElement; dasharray: string; dashoffset: string } | null = null;

  constructor() {
    super();
    this.reconnecting = false;
    this.anchorHover = false;
    this.entering = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // moved in the DOM (keyed re-order): the labels were withdrawn on disconnect
    if (this.hasUpdated && this.#published.length > 0 && this.ctx) {
      this.#publishedTo = this.ctx.flow;
      this.ctx.flow.setEdgeLabels(this.edge.id, this.#published);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const flow = this.#publishedTo ?? this.ctx?.flow;
    if (flow && this.edge) {
      flow.releaseEdgeLabels(this.edge.id);
      flow.edgeRemoved(this.edge.id);
    }
    this.#publishedTo = null;
    clearTimeout(this.#enterTimer);
  }

  protected override willUpdate(): void {
    const { edge, ctx } = this;
    if (!edge || !ctx) return;
    this.#idContext.setValue(edge.id);
    this.#selectable = edge.selectable ?? ctx.elementsSelectable;
    this.#focusable = edge.focusable ?? ctx.edgesFocusable;
    this.#reconnectable = edge.reconnectable ?? ctx.edgesReconnectable;
  }

  #definition(): EdgeTypeDefinition {
    const { edge, ctx } = this;
    const requested = edge.type ?? 'default';
    const def = ctx.edgeTypes[requested];
    if (def) return def;
    if (!this.#warnedTypes.has(requested)) {
      this.#warnedTypes.add(requested);
      ctx.store.reportError('011', errorMessages.error011(requested));
    }
    return ctx.edgeTypes.default as EdgeTypeDefinition;
  }

  #buildProps(): EdgeProps {
    const { edge, ctx } = this;
    return {
      ...(edge.edge as Edge),
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type ?? 'default',
      data: edge.data,
      selected: !!edge.selected,
      animated: !!edge.animated,
      selectable: this.#selectable,
      deletable: edge.deletable ?? true,
      sourceX: edge.sourceX,
      sourceY: edge.sourceY,
      targetX: edge.targetX,
      targetY: edge.targetY,
      sourcePosition: edge.sourcePosition,
      targetPosition: edge.targetPosition,
      sourceHandleId: edge.sourceHandle ?? null,
      targetHandleId: edge.targetHandle ?? null,
      markerStart: getMarkerUrl(edge.markerStart, ctx.flowId),
      markerEnd: getMarkerUrl(edge.markerEnd, ctx.flowId),
      offset: edge.resolvedOffset,
      interactionWidth: edge.interactionWidth ?? 20,
      label: edge.label,
      startLabel: edge.startLabel,
      endLabel: edge.endLabel,
      labelStyle: edge.labelStyle,
      style: edge.style,
    };
  }

  /** Hand the HTML labels of a render result to the flow's label layer. */
  #publishLabels(result: EdgeRenderResult): void {
    const { edge, ctx } = this;
    const entries: LabelEntry[] = [];
    const add = (part: string, template: TemplateResult | typeof nothing | undefined): void => {
      if (template && template !== nothing) entries.push({ key: `${edge.id}:${part}`, template });
    };
    add('center', result.label);
    add('start', result.startLabel);
    add('end', result.endLabel);
    this.#published = entries;
    this.#publishedTo = ctx.flow;
    ctx.flow.setEdgeLabels(edge.id, entries);
  }

  protected override updated(): void {
    this.ctx.flow.edgeRendered(this.edge.id);
    this.#maybeStartEnter();
  }

  // --- entrance motion (spec/10 §Motion) -------------------------------------------------------------

  /** Draw the edge in once: dash the path by its length and animate the offset to 0. */
  #maybeStartEnter(): void {
    const { ctx, edge } = this;
    const motion = ctx.motion;
    if (this.#enterStarted || !motion.enabled || !motion.enteringEdges.has(edge.id)) return;
    const path = this.querySelector<SVGPathElement>('.lit-flow__edge-path');
    const g = this.querySelector<SVGGElement>('g.lit-flow__edge');
    if (!path || !g || typeof path.getTotalLength !== 'function') return;
    const length = path.getTotalLength();
    if (!(length > 0)) return;
    this.#enterStarted = true;
    let index = 0;
    for (const id of motion.enteringEdges) {
      if (id === edge.id) break;
      index++;
    }
    this.#enterRestore = {
      path,
      dasharray: path.style.getPropertyValue('stroke-dasharray'),
      dashoffset: path.style.getPropertyValue('stroke-dashoffset'),
    };
    path.style.setProperty('stroke-dasharray', String(length));
    path.style.setProperty('stroke-dashoffset', String(length));
    g.style.setProperty('--xy-enter-index', String(index));
    const cs = getComputedStyle(g);
    const duration = cssMs(cs.getPropertyValue('--xy-enter-duration'), 260);
    const stagger = cssMs(cs.getPropertyValue('--xy-enter-stagger'), 18);
    this.entering = true;
    this.#enterTimer = setTimeout(
      () => {
        this.#endEnter();
      },
      duration + stagger * index + 120 + 100,
    );
  }

  #endEnter(): void {
    clearTimeout(this.#enterTimer);
    if (!this.entering) return;
    this.entering = false;
    const restore = this.#enterRestore;
    this.#enterRestore = null;
    if (restore) {
      for (const [name, value] of [
        ['stroke-dasharray', restore.dasharray],
        ['stroke-dashoffset', restore.dashoffset],
      ] as const) {
        if (value) restore.path.style.setProperty(name, value);
        else restore.path.style.removeProperty(name);
      }
    }
    this.querySelector<SVGGElement>('g.lit-flow__edge')?.style.removeProperty('--xy-enter-index');
  }

  readonly #onAnimationEnd = (event: AnimationEvent): void => {
    if (event.animationName === 'lit-flow-draw') this.#endEnter();
  };

  // --- events ---------------------------------------------------------------------------------------

  #userEdge(): Edge | undefined {
    return this.ctx.store.getState().edgeLookup.get(this.edge.id);
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#suppressNextClick) {
      // pointer capture makes the browser click the anchor after a reconnect drag
      this.#suppressNextClick = false;
      return;
    }
    const edge = this.#userEdge();
    if (!edge) return;
    if (this.#selectable) this.ctx.store.handleEdgeSelection(edge.id);
    if (this.ctx.listeners.has('edge-click')) this.ctx.store.emit('edge-click', { event, edge });
  };

  #mouse(type: 'edge-double-click' | 'edge-context-menu'): (event: MouseEvent) => void {
    return (event) => {
      if (!this.ctx.listeners.has(type)) return;
      const edge = this.#userEdge();
      if (edge) this.ctx.store.emit(type, { event, edge });
    };
  }

  #pointer(
    type: 'edge-pointer-enter' | 'edge-pointer-move' | 'edge-pointer-leave',
  ): (event: PointerEvent) => void {
    return (event) => {
      if (!this.ctx.listeners.has(type)) return;
      const edge = this.#userEdge();
      if (edge) this.ctx.store.emit(type, { event, edge });
    };
  }

  #startReconnect(event: MouseEvent | TouchEvent, end: EdgeEnd): void {
    const { ctx, edge } = this;
    this.#suppressNextClick = false;
    startReconnect(event, {
      flow: ctx.flow,
      edgeId: edge.id,
      end,
      anchor: event.currentTarget as Element,
      onStart: () => {
        this.reconnecting = true;
        this.#suppressNextClick = true;
      },
      onEnd: () => {
        this.reconnecting = false;
        this.anchorHover = false;
      },
    });
  }

  readonly #onDoubleClick = this.#mouse('edge-double-click');
  readonly #onContextMenu = this.#mouse('edge-context-menu');
  readonly #onPointerEnter = this.#pointer('edge-pointer-enter');
  readonly #onPointerMove = this.#pointer('edge-pointer-move');
  readonly #onPointerLeave = this.#pointer('edge-pointer-leave');

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const { ctx, edge } = this;
    if (ctx.disableKeyboardA11y || !elementSelectionKeys.includes(event.key) || !this.#selectable) {
      return;
    }
    if (event.key === 'Escape') {
      (event.currentTarget as SVGGElement).blur();
      const userEdge = this.#userEdge();
      if (userEdge) ctx.store.unselectNodesAndEdges({ edges: [userEdge] });
    } else {
      ctx.store.addSelectedEdges([edge.id]);
    }
  };

  // --- render ---------------------------------------------------------------------------------------

  protected override render(): TemplateResult | typeof nothing {
    const { edge, ctx } = this;
    if (!edge || !ctx) return nothing;
    const result = this.#definition().render(this.#buildProps(), ctx.instance);
    this.#publishLabels(result);

    const focusable = this.#focusable;
    const classes = [
      'lit-flow__edge',
      edge.class,
      edge.animated && 'animated',
      edge.selected && 'selected',
      this.#selectable && 'selectable',
      !this.#selectable && !ctx.listeners.has('edge-click') && 'inactive',
      (this.reconnecting || this.anchorHover) && 'updating',
      this.entering && 'entering',
    ]
      .filter(Boolean)
      .join(' ');
    const label =
      edge.ariaLabel === null
        ? nothing
        : (edge.ariaLabel ?? `Edge from ${edge.source} to ${edge.target}`);

    return html`<svg class="lit-flow__edge-wrapper" style="z-index:${edge.zIndex}" part="edge-svg">
      <g
        class=${classes}
        data-id=${edge.id}
        part="edge"
        role=${edge.ariaRole ?? (focusable ? 'group' : 'img')}
        aria-roledescription="edge"
        aria-label=${label}
        aria-describedby=${focusable ? `${ARIA_EDGE_DESC_KEY}-${ctx.flowId}` : nothing}
        tabindex=${focusable ? 0 : nothing}
        ${spreadDomAttributes(edge.domAttributes)}
        @click=${this.#onClick}
        @animationend=${this.#onAnimationEnd}
        @dblclick=${this.#onDoubleClick}
        @contextmenu=${this.#onContextMenu}
        @pointerenter=${this.#onPointerEnter}
        @pointermove=${this.#onPointerMove}
        @pointerleave=${this.#onPointerLeave}
        @keydown=${focusable && !ctx.disableKeyboardA11y ? this.#onKeyDown : nothing}
      >
        ${this.reconnecting ? nothing : result.path}
        ${
          this.#reconnectable
            ? reconnectAnchors({
                edge,
                reconnectable: this.#reconnectable,
                radius: ctx.reconnectRadius,
                noPanClassName: ctx.noPanClassName,
                onStart: (e, end) => {
                  this.#startReconnect(e, end);
                },
                onHover: (hover) => {
                  this.anchorHover = hover;
                },
              })
            : nothing
        }
      </g>
    </svg>`;
  }
}
