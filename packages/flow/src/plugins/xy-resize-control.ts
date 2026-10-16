// Ported from xyflow (MIT) packages/react/src/additional-components/NodeResizer/NodeResizeControl.tsx, packages/svelte/src/lib/plugins/NodeResizer/ResizeControl.svelte@3d35b57
import { ContextConsumer } from '@lit/context';
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { createId } from '@xy-lit/store';
import type {
  FlowStore,
  NodeChange,
  NodeDimensionChange,
  NodePositionChange,
  XYPosition,
} from '@xy-lit/store';
import { XYResizer, evaluateAbsolutePosition, handleExpandParent } from '@xy-lit/store/internal';
import type {
  ControlPosition,
  OnResize,
  OnResizeEnd,
  OnResizeStart,
  ParentExpandChild,
  ShouldResize,
  XYResizerChange,
  XYResizerChildChange,
  XYResizerInstance,
} from '@xy-lit/store/internal';
import { StoreController } from '../controllers/store-controller.js';
import { flowContext, nodeIdContext } from '../context.js';
import type { FlowContextValue } from '../context.js';
import { booleanAttr, numberAttr } from '../elements/xy-flow/attributes.js';

/** `handle` is a small square on a corner, `line` a draggable border. */
export type ResizeControlVariant = 'handle' | 'line';

const DEFAULT_POSITIONS: Record<ResizeControlVariant, ControlPosition> = {
  line: 'right',
  handle: 'bottom-right',
};

/**
 * One draggable control that resizes a node (React `NodeResizeControl`). Use it inside a node, or
 * inside `<xy-node-resizer>`; children replace nothing: put an icon inside to restyle a handle.
 *
 * Renders into its own light DOM (single-tree rule) so the engine can measure it, and creates one
 * `XYResizer` on the rendered control. Resize gestures send `dimensions`/`position` changes with
 * `origin: 'resize'` and phases `start`, `live` and `end`.
 * @tag xy-resize-control
 */
export class XyResizeControlElement extends LitElement {
  static override properties = {
    nodeId: { attribute: 'node-id' },
    position: { reflect: true },
    variant: { reflect: true },
    color: {},
    minWidth: { attribute: 'min-width', converter: numberAttr(10) },
    minHeight: { attribute: 'min-height', converter: numberAttr(10) },
    maxWidth: { attribute: 'max-width', converter: numberAttr(Number.MAX_VALUE) },
    maxHeight: { attribute: 'max-height', converter: numberAttr(Number.MAX_VALUE) },
    keepAspectRatio: { attribute: 'keep-aspect-ratio', converter: booleanAttr(false) },
    resizeDirection: { attribute: 'resize-direction' },
    autoScale: { attribute: 'auto-scale', converter: booleanAttr(true) },
    controlClass: { attribute: 'control-class' },
    controlStyle: { attribute: 'control-style' },
    shouldResize: { attribute: false },
    onResizeStart: { attribute: false },
    onResize: { attribute: false },
    onResizeEnd: { attribute: false },
  };

  /** Id of the node to resize. Default: the enclosing node. */
  declare nodeId: string | undefined;
  /** Where the control sits. Default `bottom-right` (`right` for the line variant). */
  declare position: ControlPosition | undefined;
  /** `handle` (default) or `line`. */
  declare variant: ResizeControlVariant;
  /** Colour of the handle (background) or line (border). */
  declare color: string | undefined;
  /** Minimum width in px. Default 10. */
  declare minWidth: number;
  /** Minimum height in px. Default 10. */
  declare minHeight: number;
  /** Maximum width in px. Default unbounded. */
  declare maxWidth: number;
  /** Maximum height in px. Default unbounded. */
  declare maxHeight: number;
  /** Keep the aspect ratio. */
  declare keepAspectRatio: boolean;
  /** Restrict resizing to one axis. */
  declare resizeDirection: 'horizontal' | 'vertical' | undefined;
  /** Keep a handle at constant screen size when zooming out. Default true. */
  declare autoScale: boolean;
  /** Extra classes of the control element. */
  declare controlClass: string | undefined;
  /** Extra inline style of the control element. */
  declare controlStyle: string | undefined;
  /** Return false to block a resize step. */
  declare shouldResize: ShouldResize | undefined;
  /** Called when a resize starts. */
  declare onResizeStart: OnResizeStart | undefined;
  /** Called on every resize step. */
  declare onResize: OnResize | undefined;
  /** Called when a resize ends. */
  declare onResizeEnd: OnResizeEnd | undefined;

  readonly #flow = new ContextConsumer(this, {
    context: flowContext,
    subscribe: true,
    callback: (value) => {
      this.#flowValue = value;
    },
  });
  readonly #idContext = new ContextConsumer(this, {
    context: nodeIdContext,
    subscribe: true,
    callback: (value) => {
      this.#contextNodeId = value;
      this.requestUpdate();
    },
  });
  readonly #zoom = new StoreController<number>(this, (s) => s.transform[2]);
  readonly #controlRef = createRef<HTMLDivElement>();
  #flowValue: FlowContextValue | undefined;
  #contextNodeId: string | undefined;
  #resizer: XYResizerInstance | null = null;
  #resizerFor: { el: HTMLElement; id: string } | null = null;
  #gestureId: string | null = null;
  #changes = 0;
  #initialChildren: ChildNode[] | null = null;

  constructor() {
    super();
    this.nodeId = undefined;
    this.position = undefined;
    this.variant = 'handle';
    this.color = undefined;
    this.minWidth = 10;
    this.minHeight = 10;
    this.maxWidth = Number.MAX_VALUE;
    this.maxHeight = Number.MAX_VALUE;
    this.keepAspectRatio = false;
    this.resizeDirection = undefined;
    this.autoScale = true;
    this.controlClass = undefined;
    this.controlStyle = undefined;
    this.shouldResize = undefined;
    this.onResizeStart = undefined;
    this.onResize = undefined;
    this.onResizeEnd = undefined;
    this.style.display = 'contents';
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** @internal Keeps the consumers referenced (they register themselves on the host). */
  get consumers(): readonly unknown[] {
    return [this.#flow, this.#idContext];
  }

  /** The id of the node being resized. */
  get resolvedNodeId(): string | undefined {
    return typeof this.nodeId === 'string' ? this.nodeId : this.#contextNodeId;
  }

  override connectedCallback(): void {
    // children given in the markup (an icon) move inside the control on the first render
    this.#initialChildren ??= [...this.childNodes];
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizer?.destroy();
    this.#resizer = null;
    this.#resizerFor = null;
  }

  get #store(): FlowStore | undefined {
    return this.#flowValue?.store;
  }

  #begin(): void {
    const store = this.#store;
    if (!store) return;
    this.#gestureId = createId();
    this.#changes = 0;
    store.setState({ activeGesture: { kind: 'resize', id: this.#gestureId } });
  }

  #onChange(id: string, change: XYResizerChange, childChanges: XYResizerChildChange[]): void {
    const store = this.#store;
    if (!store) return;
    const { nodeLookup, parentLookup, nodeOrigin } = store.getState();
    const changes: NodeChange[] = [];
    const nextPosition: { x?: number; y?: number } = { x: change.x, y: change.y };
    const node = nodeLookup.get(id);

    if (node?.expandParent && node.parentId) {
      const origin = node.origin ?? nodeOrigin;
      const width = change.width ?? node.measured.width ?? 0;
      const height = change.height ?? node.measured.height ?? 0;
      const child: ParentExpandChild = {
        id: node.id,
        parentId: node.parentId,
        rect: {
          width,
          height,
          ...evaluateAbsolutePosition(
            { x: change.x ?? node.position.x, y: change.y ?? node.position.y },
            { width, height },
            node.parentId,
            nodeLookup,
            origin,
          ),
        },
      };
      changes.push(...handleExpandParent([child], nodeLookup, parentLookup, nodeOrigin));
      // when the child expanded its parent, the position is clamped at 0,0 (origin 0,0) or width,height (1,1)
      nextPosition.x = change.x ? Math.max(origin[0] * width, change.x) : undefined;
      nextPosition.y = change.y ? Math.max(origin[1] * height, change.y) : undefined;
    }

    if (nextPosition.x !== undefined && nextPosition.y !== undefined) {
      const positionChange: NodePositionChange = {
        id,
        type: 'position',
        position: { ...(nextPosition as XYPosition) },
      };
      changes.push(positionChange);
    }

    if (change.width !== undefined && change.height !== undefined) {
      const direction = this.resizeDirection;
      const dimensionChange: NodeDimensionChange = {
        id,
        type: 'dimensions',
        resizing: true,
        setAttributes: !direction ? true : direction === 'horizontal' ? 'width' : 'height',
        dimensions: { width: change.width, height: change.height },
      };
      changes.push(dimensionChange);
    }

    for (const childChange of childChanges) {
      changes.push({ ...childChange, type: 'position' });
    }

    const phase = this.#changes++ === 0 ? 'start' : 'live';
    store.triggerNodeChanges(changes, {
      phase,
      origin: 'resize',
      gestureId: this.#gestureId ?? undefined,
    });
  }

  #onEnd(id: string, { width, height }: Required<XYResizerChange>): void {
    const store = this.#store;
    if (!store) return;
    const dimensionChange: NodeDimensionChange = {
      id,
      type: 'dimensions',
      resizing: false,
      dimensions: { width, height },
    };
    store.triggerNodeChanges([dimensionChange], {
      phase: 'end',
      origin: 'resize',
      gestureId: this.#gestureId ?? undefined,
    });
    this.#gestureId = null;
    if (store.getState().activeGesture?.kind === 'resize') store.setState({ activeGesture: null });
  }

  #syncResizer(): void {
    const el = this.#controlRef.value;
    const id = this.resolvedNodeId;
    const store = this.#store;
    if (!el || !id || !store) return;
    if (this.#resizer && (this.#resizerFor?.el !== el || this.#resizerFor.id !== id)) {
      this.#resizer.destroy();
      this.#resizer = null;
    }
    this.#resizer ??= XYResizer({
      domNode: el,
      nodeId: id,
      getStoreItems: () => {
        const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, domNode } =
          store.getState();
        return { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, paneDomNode: domNode };
      },
      onChange: (change, childChanges) => {
        this.#onChange(id, change, childChanges);
      },
      onEnd: (change) => {
        this.#onEnd(id, change);
      },
    });
    this.#resizerFor = { el, id };
    const variant = this.variant;
    this.#resizer.update({
      controlPosition: this.position ?? DEFAULT_POSITIONS[variant],
      boundaries: {
        minWidth: this.minWidth,
        minHeight: this.minHeight,
        maxWidth: this.maxWidth,
        maxHeight: this.maxHeight,
      },
      keepAspectRatio: this.keepAspectRatio,
      resizeDirection: this.resizeDirection,
      onResizeStart: (event, params) => {
        this.#begin();
        this.onResizeStart?.(event, params);
      },
      onResize: this.onResize,
      onResizeEnd: this.onResizeEnd,
      shouldResize: this.shouldResize,
    });
  }

  protected override updated(): void {
    this.#syncResizer();
  }

  protected override render(): TemplateResult | typeof nothing {
    const store = this.#store;
    if (!store) return nothing;
    const variant = this.variant;
    const isHandle = variant === 'handle';
    const position = this.position ?? DEFAULT_POSITIONS[variant];
    const scale = isHandle && this.autoScale ? Math.max(1 / this.#zoom.value, 1) : undefined;
    const style =
      (this.controlStyle ? `${this.controlStyle};` : '') +
      (scale !== undefined ? `scale:${scale};` : '') +
      (this.color ? `${isHandle ? 'background-color' : 'border-color'}:${this.color};` : '');
    const classes = [
      'lit-flow__resize-control',
      store.getState().noDragClassName,
      ...position.split('-'),
      variant,
      this.controlClass,
    ]
      .filter(Boolean)
      .join(' ');
    const children = this.#initialChildren ?? [];
    return html`<div ${ref(this.#controlRef)} class=${classes} style=${style}>${children}</div>`;
  }
}
