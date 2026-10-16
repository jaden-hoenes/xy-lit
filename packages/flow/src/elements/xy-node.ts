// Ported from xyflow (MIT) packages/svelte/src/lib/components/NodeWrapper/NodeWrapper.svelte, packages/react/src/components/NodeWrapper/index.tsx@3d35b57
import { ContextProvider } from '@lit/context';
import { LitElement, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { ARIA_NODE_DESC_KEY, arrowKeyDiffs, devWarn } from '@xy-lit/store';
import type { InternalNode, NodeProps, NodeResizerDefaults, XYDragInstance } from '@xy-lit/store';
import {
  XYDrag,
  elementSelectionKeys,
  errorMessages,
  getNodeDimensions,
  getNodesInside,
  isInputDOMNode,
  nodeHasDimensions,
} from '@xy-lit/store/internal';
import { nodeConnectableContext, nodeIdContext } from '../context.js';
import { createDragStoreItems, handleNodeClick } from '../drag.js';
import type { FlowNodeElement } from '../nodes/flow-node-element.js';
import type { NodeTypeDefinition, NodeTypeEntry } from '../nodes/define-node-type.js';
import type { NodeRenderContext } from '../types.js';
import type { MeasurableNode } from './xy-flow/measure.js';
import { cssMs } from './xy-flow/motion.js';

/** `domAttributes` keys that are allowed besides `data-*` and `aria-*`. */
const ALLOWED_DOM_ATTRIBUTES = new Set(['title', 'lang', 'dir', 'tabindex']);
const DATA_OR_ARIA = /^(data|aria)-[a-z0-9-]+$/;

/**
 * Apply `domAttributes` to an element: allowed keys are set, keys that disappeared are removed.
 * Disallowed keys are dropped with development warning `XYL01`.
 *
 * @param el - The host element.
 * @param next - The wanted attributes.
 * @param previous - The attributes applied last time.
 * @returns The attributes that are applied now.
 */
export function applyDomAttributes(
  el: Element,
  next: Record<string, string> | undefined,
  previous: Record<string, string>,
): Record<string, string> {
  const applied: Record<string, string> = {};
  for (const [key, value] of Object.entries(next ?? {})) {
    if (!DATA_OR_ARIA.test(key) && !ALLOWED_DOM_ATTRIBUTES.has(key)) {
      devWarn('XYL01', `domAttributes key "${key}" is not allowed and was dropped.`);
      continue;
    }
    applied[key] = String(value);
    if (el.getAttribute(key) !== applied[key]) el.setAttribute(key, applied[key]);
  }
  for (const key of Object.keys(previous)) if (!(key in applied)) el.removeAttribute(key);
  return applied;
}

/** Whether anything but the position of a node changed (so the content must re-render). */
function nodeContentChanged(prev: InternalNode, next: InternalNode): boolean {
  if (
    prev.measured.width !== next.measured.width ||
    prev.measured.height !== next.measured.height
  ) {
    return true;
  }
  const a = prev.internals.userNode as Record<string, unknown>;
  const b = next.internals.userNode as Record<string, unknown>;
  if (a === b) return false;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key !== 'position' && !Object.is(a[key], b[key])) return true;
  }
  return false;
}

function isRenderer(entry: NodeTypeEntry): entry is NodeTypeDefinition {
  return typeof entry === 'object' && entry.kind === 'renderer';
}

const POINTER_EVENTS = [
  'node-click',
  'node-pointer-enter',
  'node-pointer-move',
  'node-pointer-leave',
];

/**
 * One node of the flow: positions itself, reports its size to the flow, owns the node's drag
 * gesture, and renders the content of its node type (a renderer function or a
 * {@link FlowNodeElement}). Rendered by `<xy-flow>`; not meant to be created by hand.
 *
 * Renders into its own light DOM (single-tree rule): the content, including `<xy-handle>`s, lives
 * in the flow's shadow root.
 *
 * @csspart node - The node element itself.
 * @tag xy-node
 */
export class XyNodeElement extends LitElement implements MeasurableNode {
  static override properties = {
    node: { attribute: false },
    px: { attribute: false },
    py: { attribute: false },
    z: { attribute: false },
    isParent: { attribute: false },
    ctx: { attribute: false },
  };

  /** The engine's internal node. */
  declare node: InternalNode;
  /** Absolute x position (separate from `node` because the engine mutates it in place). */
  declare px: number;
  /** Absolute y position. */
  declare py: number;
  /** z-index. */
  declare z: number;
  /** Whether other nodes have this node as parent. */
  declare isParent: boolean;
  /** Everything the node needs from its flow. */
  declare ctx: NodeRenderContext;

  #idContext = new ContextProvider(this, { context: nodeIdContext });
  #connectableContext = new ContextProvider(this, { context: nodeConnectableContext });
  #draggable = true;
  #selectable = true;
  #connectable = true;
  #focusable = true;
  #type = 'default';
  #entry: NodeTypeEntry | undefined;
  #warnedTypes = new Set<string>();
  #lastClass = '';
  #lastUserStyle: string | undefined;
  #managedWidth = false;
  #managedHeight = false;
  #domAttributes: Record<string, string> = {};
  #drag: XYDragInstance | null = null;
  #dragKey = '';
  #measure: NodeRenderContext['measure'] | null = null;
  #contentEl: (HTMLElement & Partial<FlowNodeElement>) | null = null;
  #contentEntry: NodeTypeEntry | null = null;
  #prevType: string | undefined;
  #prevSourcePosition: unknown;
  #prevTargetPosition: unknown;
  // entrance motion (spec/10 §Motion)
  #enterStarted = false;
  #entering = false;
  #enterIndex = 0;
  #enterTimer: ReturnType<typeof setTimeout> | undefined;
  #remoteColor: string | undefined;
  #remoteSettled = false;

  constructor() {
    super();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('dblclick', (e) => {
      this.#emitMouse('node-double-click', e);
    });
    this.addEventListener('contextmenu', (e) => {
      this.#emitMouse('node-context-menu', e);
    });
    this.addEventListener('pointerenter', (e) => {
      this.#emitPointer('node-pointer-enter', e);
    });
    this.addEventListener('pointermove', (e) => {
      this.#emitPointer('node-pointer-move', e);
    });
    this.addEventListener('pointerleave', (e) => {
      this.#emitPointer('node-pointer-leave', e);
    });
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('focus', this.#onFocus);
    this.addEventListener('animationend', (e) => {
      if (e.target === this && e.animationName === 'lit-flow-enter') this.#endEnter();
    });
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The id of the node this element renders. */
  get nodeId(): string | undefined {
    return this.node?.id;
  }

  // --- lifecycle -----------------------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    // moved in the DOM (e.g. by a keyed re-order): pick up measuring and dragging again
    if (this.hasUpdated && this.ctx) {
      this.#observe();
      this.#dragKey = '';
      this.#updateDrag();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#measure?.unobserve(this);
    this.#measure = null;
    clearTimeout(this.#enterTimer);
    this.#drag?.destroy();
    this.#drag = null;
    this.#dragKey = '';
  }

  #observe(): void {
    const measure = this.ctx.measure;
    if (this.#measure !== measure) {
      this.#measure?.unobserve(this);
      this.#measure = measure;
    }
    measure.observe(this);
  }

  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!this.hasUpdated || !this.node || !this.ctx) return true;
    if (changed.has('ctx') || changed.has('isParent')) return true;
    const prev: InternalNode | undefined = changed.get('node');
    if (prev && nodeContentChanged(prev, this.node)) return true;
    const entry = this.#entry;
    const usesPosition = !!entry && isRenderer(entry) && !!entry.usesPosition;
    if (usesPosition && (changed.has('px') || changed.has('py') || changed.has('z'))) return true;
    // a pure move: only the managed style properties change
    this.#applyStyle();
    return false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const { node: n, ctx: c } = this;
    if (!n || !c) return;

    this.#draggable = n.draggable ?? c.nodesDraggable;
    this.#selectable = n.selectable ?? c.elementsSelectable;
    this.#connectable = n.connectable ?? c.nodesConnectable;
    this.#focusable = n.focusable ?? c.nodesFocusable;
    this.#idContext.setValue(n.id);
    this.#connectableContext.setValue(this.#connectable);

    // node type, with a fallback to `default`
    const requested = n.type ?? 'default';
    let entry = c.nodeTypes[requested];
    let type = requested;
    if (!entry) {
      if (!this.#warnedTypes.has(requested)) {
        this.#warnedTypes.add(requested);
        c.store.reportError('003', errorMessages.error003(requested));
      }
      type = 'default';
      entry = c.nodeTypes.default;
    }
    this.#type = type;
    this.#entry = entry;

    if (changed.has('ctx') || !this.#measure) this.#observe();

    this.#maybeStartEnter();
    this.#applyHost();
    this.#applyStyle();
  }

  protected override updated(changed: PropertyValues<this>): void {
    const { node: n, ctx: c } = this;
    if (!n || !c) return;
    this.#updateDrag();

    // the engine has no measurement (the node object was replaced): ask the observer again
    if (!(nodeHasDimensions(n) && n.internals.handleBounds) && this.isConnected) {
      c.measure.remeasure(this);
    }

    // type or handle sides changed after the first render: the handles moved
    const hadPrevious = this.#prevType !== undefined;
    if (
      hadPrevious &&
      (this.#prevType !== this.#type ||
        this.#prevSourcePosition !== n.sourcePosition ||
        this.#prevTargetPosition !== n.targetPosition)
    ) {
      c.measure.requestMeasure([n.id]);
    }
    this.#prevType = this.#type;
    this.#prevSourcePosition = n.sourcePosition;
    this.#prevTargetPosition = n.targetPosition;
    void changed;
  }

  // --- entrance motion ----------------------------------------------------------------------------

  /** Start the entrance animation once, when the node is in `entering` and first measured. */
  #maybeStartEnter(): void {
    const { node: n, ctx: c } = this;
    const motion = c.motion;
    if (this.#enterStarted || !motion.enabled || !motion.entering.has(n.id)) return;
    if (!nodeHasDimensions(n)) return;
    this.#enterStarted = true;
    this.#entering = true;
    let index = 0;
    for (const id of motion.entering) {
      if (id === n.id) break;
      index++;
    }
    this.#enterIndex = index;
    const cs = getComputedStyle(this);
    const duration = cssMs(cs.getPropertyValue('--xy-enter-duration'), 260);
    const stagger = cssMs(cs.getPropertyValue('--xy-enter-stagger'), 18);
    // backstop: animationend does not fire when the node is hidden or the animation is disabled
    this.#enterTimer = setTimeout(
      () => {
        this.#endEnter();
      },
      duration + stagger * index + 100,
    );
    const addedBy = n.remote?.addedBy;
    if (motion.mode === 'enter remote' && addedBy) {
      this.#remoteColor = addedBy.color;
      // the glow fades out one frame later (CSS transition on box-shadow)
      requestAnimationFrame(() => {
        this.#remoteSettled = true;
        if (this.isConnected && this.node) this.#applyHost();
      });
    }
  }

  #endEnter(): void {
    clearTimeout(this.#enterTimer);
    if (!this.#entering) return;
    this.#entering = false;
    this.style.removeProperty('--xy-enter-index');
    if (this.node && this.ctx) this.#applyHost();
  }

  // --- host: classes, style, attributes ---------------------------------------------------------

  #applyHost(): void {
    const { node: n, ctx: c } = this;
    if (this.getAttribute('data-id') !== n.id) this.setAttribute('data-id', n.id);
    if (!this.hasAttribute('part')) this.setAttribute('part', 'node');

    const remote = n.remote;
    const className = [
      'lit-flow__node',
      `lit-flow__node-${this.#type}`,
      n.class,
      n.dragging && 'dragging',
      n.selected && 'selected',
      this.#draggable && 'draggable',
      this.#connectable && 'connectable',
      this.#selectable && 'selectable',
      this.#draggable && c.noPanClassName,
      this.isParent && 'parent',
      remote?.selectedBy?.length && 'remote-selected',
      (remote?.draggingBy || remote?.resizingBy) && 'remote-dragging',
      this.#entering && 'entering',
      this.#remoteColor && 'remote-added',
      this.#remoteColor && this.#remoteSettled && 'settled',
    ]
      .filter(Boolean)
      .join(' ');
    if (className !== this.#lastClass) {
      this.#lastClass = className;
      this.className = className;
    }

    this.#setAttr('tabindex', this.#focusable ? '0' : null);
    this.#setAttr('role', n.ariaRole ?? (this.#focusable ? 'group' : null));
    this.#setAttr('aria-label', n.ariaLabel ?? null);
    this.#setAttr('aria-roledescription', 'node');
    this.#setAttr(
      'aria-describedby',
      c.disableKeyboardA11y ? null : `${ARIA_NODE_DESC_KEY}-${c.flowId}`,
    );
    this.#domAttributes = applyDomAttributes(this, n.domAttributes, this.#domAttributes);
  }

  #setAttr(name: string, value: string | null): void {
    if (value === null) {
      if (this.hasAttribute(name)) this.removeAttribute(name);
    } else if (this.getAttribute(name) !== value) {
      this.setAttribute(name, value);
    }
  }

  /** The style properties this element manages itself; the user's `node.style` is kept. */
  #applyStyle(): void {
    const { node: n, ctx: c } = this;
    const style = this.style;

    // width/height (Svelte rule): the explicit size, or the initial size until measured
    const w = n.measured.width === undefined ? (n.width ?? n.initialWidth) : n.width;
    const h = n.measured.height === undefined ? (n.height ?? n.initialHeight) : n.height;
    const hasW = typeof w === 'number';
    const hasH = typeof h === 'number';

    // the user's style changed, or a managed size went away: start from the user's style
    if (
      n.style !== this.#lastUserStyle ||
      (this.#managedWidth && !hasW) ||
      (this.#managedHeight && !hasH)
    ) {
      style.cssText = n.style ?? '';
      this.#lastUserStyle = n.style;
      this.#managedWidth = false;
      this.#managedHeight = false;
    }

    style.setProperty('transform', `translate(${this.px}px, ${this.py}px)`);
    style.setProperty('z-index', String(this.z));
    style.setProperty('visibility', nodeHasDimensions(n) ? 'visible' : 'hidden');
    if (hasW) {
      style.setProperty('width', `${w}px`);
      this.#managedWidth = true;
    }
    if (hasH) {
      style.setProperty('height', `${h}px`);
      this.#managedHeight = true;
    }
    const interactive =
      this.#selectable || this.#draggable || POINTER_EVENTS.some((t) => c.listeners.has(t));
    style.setProperty('pointer-events', interactive ? 'all' : 'none');

    if (this.#entering) style.setProperty('--xy-enter-index', String(this.#enterIndex));
    const remoteColor =
      n.remote?.selectedBy?.[0]?.color ?? n.remote?.draggingBy?.color ?? this.#remoteColor;
    if (remoteColor) style.setProperty('--xy-remote-color', remoteColor);
    else style.removeProperty('--xy-remote-color');
  }

  // --- dragging -------------------------------------------------------------------------------------

  #updateDrag(): void {
    const { node: n, ctx: c } = this;
    if (!this.#draggable) {
      this.#drag?.destroy();
      this.#drag = null;
      this.#dragKey = '';
      return;
    }
    const key = [
      n.id,
      c.noDragClassName,
      n.dragHandle ?? '',
      this.#selectable,
      c.nodeClickDistance,
    ].join('|');
    if (this.#drag && key === this.#dragKey) return;
    this.#drag ??= XYDrag({
      getStoreItems: createDragStoreItems(c.store, c.flow),
      onNodeMouseDown: (id) => {
        handleNodeClick({ id, store: c.store, nodeEl: this });
      },
    });
    this.#dragKey = key;
    this.#drag.update({
      domNode: this,
      noDragClassName: c.noDragClassName,
      handleSelector: n.dragHandle,
      nodeId: n.id,
      isSelectable: this.#selectable,
      nodeClickDistance: c.nodeClickDistance,
    });
  }

  // --- events ---------------------------------------------------------------------------------------

  readonly #onClick = (event: MouseEvent): void => {
    const { node: n, ctx: c } = this;
    if (!n || !c) return;
    if (this.#selectable && (!c.selectNodesOnDrag || !this.#draggable || c.nodeDragThreshold > 0)) {
      // XYDrag calls this itself when a drag starts and selectNodesOnDrag is on
      handleNodeClick({ id: n.id, store: c.store, nodeEl: this });
    }
    this.#emitMouse('node-click', event);
  };

  #emitMouse(
    type: 'node-click' | 'node-double-click' | 'node-context-menu',
    event: MouseEvent,
  ): void {
    const { node: n, ctx: c } = this;
    if (!n || !c?.listeners.has(type)) return;
    c.store.emit(type, { event, node: n.internals.userNode });
  }

  #emitPointer(
    type: 'node-pointer-enter' | 'node-pointer-move' | 'node-pointer-leave',
    event: PointerEvent,
  ): void {
    const { node: n, ctx: c } = this;
    if (!n || !c?.listeners.has(type)) return;
    c.store.emit(type, { event, node: n.internals.userNode });
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const { node: n, ctx: c } = this;
    if (!n || !c || !this.#focusable) return;
    if (isInputDOMNode(event) || c.disableKeyboardA11y) return;

    if (elementSelectionKeys.includes(event.key) && this.#selectable) {
      c.store.handleNodeSelection(n.id, event.key === 'Escape', this);
    } else if (
      this.#draggable &&
      n.selected &&
      Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)
    ) {
      // keep the page from scrolling
      event.preventDefault();
      c.store.setState({
        ariaLiveMessage: c.ariaLabelConfig['node.a11yDescription.ariaLiveMessage']({
          direction: event.key.replace('Arrow', '').toLowerCase(),
          x: ~~n.internals.positionAbsolute.x,
          y: ~~n.internals.positionAbsolute.y,
        }),
      });
      c.store.moveSelectedNodes(arrowKeyDiffs[event.key]!, event.shiftKey ? 4 : 1);
    }
  };

  readonly #onFocus = (): void => {
    const { node: n, ctx: c } = this;
    if (!n || !c || !this.#focusable) return;
    if (c.disableKeyboardA11y || !c.autoPanOnNodeFocus || !this.matches(':focus-visible')) return;
    const { width, height, transform } = c.store.getState();
    const withinViewport =
      getNodesInside(new Map([[n.id, n]]), { x: 0, y: 0, width, height }, transform, true).length >
      0;
    if (!withinViewport) {
      void c.store.setCenter(
        n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
        n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
        { zoom: transform[2] },
      );
    }
  };

  // --- content ---------------------------------------------------------------------------------------

  #buildProps(): NodeProps {
    const { node: n } = this;
    const { width, height } = getNodeDimensions(n);
    return {
      id: n.id,
      data: n.data,
      type: this.#type,
      selected: !!n.selected,
      selectable: this.#selectable,
      deletable: n.deletable ?? true,
      draggable: this.#draggable,
      isConnectable: this.#connectable,
      dragging: !!n.dragging,
      zIndex: this.z,
      positionAbsoluteX: this.px,
      positionAbsoluteY: this.py,
      width,
      height,
      sourcePosition: n.sourcePosition,
      targetPosition: n.targetPosition,
      dragHandle: n.dragHandle,
      parentId: n.parentId,
    };
  }

  #contentElement(entry: Exclude<NodeTypeEntry, NodeTypeDefinition>): HTMLElement | null {
    if (this.#contentEl && this.#contentEntry === entry) return this.#contentEl;
    let el: HTMLElement | null = null;
    try {
      if (typeof entry === 'string') {
        if (customElements.get(entry)) el = document.createElement(entry);
      } else {
        el = new entry();
      }
    } catch {
      el = null;
    }
    if (!el) {
      this.ctx.store.reportError(
        'XYL04',
        `Node type "${this.#type}" refers to an element that is not registered.`,
      );
    }
    this.#contentEl = el;
    this.#contentEntry = entry;
    return el;
  }

  protected override render(): TemplateResult | typeof nothing | string | HTMLElement {
    const { ctx: c } = this;
    const entry = this.#entry;
    if (!c || !entry) return nothing;
    const props = this.#buildProps();
    const resizer = isRenderer(entry)
      ? entry.resizer
      : (typeof entry === 'string'
          ? (customElements.get(entry) as { resizer?: NodeResizerDefaults } | undefined)
          : (entry as { resizer?: NodeResizerDefaults })
        )?.resizer;
    // the resizer's controls are siblings of the content, inside the node (single tree)
    const withResizer = (content: unknown): TemplateResult =>
      html`<xy-node-resizer .options=${resizer}></xy-node-resizer>${content}`;
    if (isRenderer(entry)) {
      const content = entry.render(props as never, c.instance);
      return resizer ? withResizer(content) : content;
    }
    const el = this.#contentElement(entry);
    if (!el) return nothing;
    const content = el as HTMLElement & { props?: NodeProps; flow?: unknown };
    content.props = props;
    content.flow = c.instance;
    return resizer ? withResizer(el) : el;
  }
}
