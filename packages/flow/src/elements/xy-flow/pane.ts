// Ported from xyflow (MIT) packages/svelte/src/lib/container/Pane/Pane.svelte, packages/react/src/container/Pane/index.tsx, packages/react/src/container/FlowRenderer/index.tsx, packages/react/src/components/NodesSelection/index.tsx@3d35b57
import type { ReactiveController } from 'lit';
import { SelectionMode, arrowKeyDiffs, createId, getSelectionChanges } from '@xy-lit/store';
import type { XYDragInstance, XYPosition } from '@xy-lit/store';
import {
  XYDrag,
  calcAutoPan,
  getEventPosition,
  getNodesInside,
  pointToRendererPoint,
  rendererPointToPoint,
} from '@xy-lit/store/internal';
import { createDragStoreItems } from '../../drag.js';
import type { XyFlowElement } from '../xy-flow.js';

/** Selector of the selected-nodes box (the element that carries the drag). */
const NODES_SELECTION_RECT = '.lit-flow__nodesselection-rect';

/** Capture or release a pointer; a refusal (stale or synthetic pointer id) is harmless. */
function capturePointer(target: EventTarget | null, pointerId: number, capture: boolean): void {
  const el = target as Partial<Element> | null;
  try {
    if (capture) el?.setPointerCapture?.(pointerId);
    else el?.releasePointerCapture?.(pointerId);
  } catch {
    // pointer captures are an optimisation; the gesture works without them
  }
}

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
};

/** What the pane derives from the element's properties and the key flags (React `FlowRenderer`). */
export type PaneInteraction = {
  /** The selection key is held. */
  selectionKeyPressed: boolean;
  /** `panOnDrag`, or true while the pan activation key is held. */
  panOnDrag: boolean | number[];
  /** `panOnScroll`, or true while the pan activation key is held. */
  panOnScroll: boolean;
  /** `selectionOnDrag`, which only applies when the primary button does not pan. */
  selectionOnDrag: boolean;
  /** Dragging on the pane draws a selection rectangle right now. */
  isSelecting: boolean;
};

/**
 * Pane interactions of a flow: clicks, context menu, the user selection rectangle (with
 * auto-pan), `pane-*` events, the pointer position in flow coordinates, and the box around the
 * selected nodes (its drag, keyboard and focus).
 *
 * The handlers are bound as Lit event bindings on the pane element by `<xy-flow>`; the
 * controller adds no listeners of its own.
 */
export class PaneController implements ReactiveController {
  #bounds: DOMRect | null = null;
  #selectedNodeIds = new Set<string>();
  #selectedEdgeIds = new Set<string>();
  #connectionEndedOnPane = false;
  /** Prevents the click that follows a selection drag (React `selectionInProgress`). */
  #selectionInProgress = false;
  #position: XYPosition = { x: 0, y: 0 };
  #autoPanId = 0;
  #autoPanRunning = false;
  #gestureId: string | undefined;
  #pointerFrame = 0;
  #lastPointer: { x: number; y: number } | null = null;
  #paneEl: HTMLElement | null = null;
  #rectEl: HTMLElement | null = null;
  #rectDrag: XYDragInstance | null = null;
  #rectDragStore: unknown = null;

  constructor(private readonly host: XyFlowElement) {
    host.addController(this);
  }

  hostConnected(): void {
    // handlers are bound in the pane template
  }

  hostUpdated(): void {
    this.#syncPaneListener();
    this.#syncSelectionBox();
  }

  hostDisconnected(): void {
    this.#paneEl?.removeEventListener('click', this.#onClickCapture, { capture: true });
    this.#paneEl = null;
    this.#cleanupAutoPan();
    if (this.#pointerFrame) cancelAnimationFrame(this.#pointerFrame);
    this.#pointerFrame = 0;
    this.#destroyRectDrag();
  }

  // --- derived values ---------------------------------------------------------------------------

  /**
   * The values React's `FlowRenderer` derives from the props and the key flags. Used by the
   * pane (this controller) and by the pan/zoom engine.
   */
  get interaction(): PaneInteraction {
    const { host } = this;
    const s = host.store.getState();
    const panOnDrag: boolean | number[] = s.panActivationKeyPressed ? true : host.panOnDrag;
    const panOnScroll = s.panActivationKeyPressed || host.panOnScroll;
    const selectionOnDrag = host.selectionOnDrag && panOnDrag !== true;
    const isSelecting = s.selectionKeyPressed || s.userSelectionActive || selectionOnDrag;
    return {
      selectionKeyPressed: s.selectionKeyPressed,
      panOnDrag,
      panOnScroll,
      selectionOnDrag,
      isSelecting,
    };
  }

  /** `elementsSelectable` and a selection in progress or possible. */
  get #isSelectionEnabled(): boolean {
    const s = this.host.store.getState();
    return s.elementsSelectable && (this.interaction.isSelecting || s.userSelectionActive);
  }

  /** Extra classes of `.lit-flow__pane`: `draggable`, `dragging`, `selection`. */
  get paneClasses(): string {
    const s = this.host.store.getState();
    const { panOnDrag, isSelecting } = this.interaction;
    const classes: string[] = [];
    if (panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(0))) {
      classes.push('draggable');
    }
    if (s.paneDragging) classes.push('dragging');
    if (isSelecting) classes.push('selection');
    return classes.join(' ');
  }

  // --- handlers (bound by the pane template) ----------------------------------------------------

  /**
   * `pointerdown` on the pane, capture phase: starts the user selection (so that a node or edge
   * under the pointer cannot swallow it while the selection key is held).
   */
  readonly onPointerDownCapture = {
    capture: true,
    handleEvent: (event: Event): void => {
      this.#pointerDownCapture(event as PointerEvent);
    },
  };

  /**
   * `click` on the pane, capture phase: swallows the click that ends a selection drag. Added by
   * the controller itself (a template cannot bind `click` twice, once per phase).
   */
  readonly #onClickCapture = (event: Event): void => {
    if (!this.#isSelectionEnabled) return;
    if (this.#selectionInProgress) {
      event.stopPropagation();
      this.#selectionInProgress = false;
    }
  };

  /** `pointermove` on the pane: selection rectangle, `pane-pointer-move`, pointer position. */
  readonly onPointerMove = (event: PointerEvent): void => {
    this.#trackPointer(event);
    if (this.#isSelectionEnabled) this.#selectionMove(event);
    else if (this.host.hasListener('pane-pointer-move')) {
      this.host.emit('pane-pointer-move', { event });
    }
  };

  /** `pointerup` on the pane: ends the selection, or notes a connection that ended here. */
  readonly onPointerUp = (event: PointerEvent): void => {
    const { host } = this;
    const store = host.store;
    const s = store.getState();
    if (!this.#isSelectionEnabled) {
      if (event.target === host.paneRef.value && s.connection.inProgress) {
        this.#connectionEndedOnPane = true;
      }
      // a selection that never started moving leaves its rectangle behind when the key is gone
      if (s.userSelectionRect) store.setState({ userSelectionRect: null });
      return;
    }
    if (event.button !== 0) return;
    capturePointer(event.target, event.pointerId, false);

    // only a click when the pointer did not move (the selection never became active)
    if (!s.userSelectionActive && event.target === host.paneRef.value && s.userSelectionRect) {
      this.#paneClick(event);
    }

    store.setState({ userSelectionActive: false, userSelectionRect: null });

    if (this.#selectionInProgress) {
      host.emit('selection-end', { event });
      store.setState({ nodesSelectionActive: this.#selectedNodeIds.size > 0 });
    }
    this.#cleanupAutoPan();
  };

  /** `pointercancel` on the pane. */
  readonly onPointerCancel = (event: PointerEvent): void => {
    if (!this.#isSelectionEnabled) return;
    capturePointer(event.target, event.pointerId, false);
    this.#cleanupAutoPan();
  };

  /** `click` on the pane (only clicks on the pane itself, not on its children). */
  readonly onClick = (event: MouseEvent): void => {
    if (this.#isSelectionEnabled) return;
    if (event.target !== this.host.paneRef.value) return;
    this.#paneClick(event);
  };

  /** `contextmenu` on the pane. */
  readonly onContextMenu = (event: MouseEvent): void => {
    if (event.target !== this.host.paneRef.value) return;
    const { panOnDrag } = this.interaction;
    if (Array.isArray(panOnDrag) && panOnDrag.includes(2)) {
      event.preventDefault();
      return;
    }
    if (this.host.hasListener('pane-context-menu')) this.host.emit('pane-context-menu', { event });
  };

  /** `wheel` on the pane. */
  readonly onWheel = (event: WheelEvent): void => {
    if (event.target !== this.host.paneRef.value) return;
    if (this.host.hasListener('pane-scroll')) this.host.emit('pane-scroll', { event });
  };

  /** `pointerenter` on the pane. */
  readonly onPointerEnter = (event: PointerEvent): void => {
    if (this.#isSelectionEnabled) return;
    if (this.host.hasListener('pane-pointer-enter')) {
      this.host.emit('pane-pointer-enter', { event });
    }
  };

  /** `pointerleave` on the pane. */
  readonly onPointerLeave = (event: PointerEvent): void => {
    if (this.host.hasListener('pane-pointer-leave')) {
      this.host.emit('pane-pointer-leave', { event });
    }
  };

  // --- click --------------------------------------------------------------------------------------

  #paneClick(event: MouseEvent): void {
    const { host } = this;
    const store = host.store;
    // no click after a selection ended with the key released, or after a connection ended here
    if (
      this.#selectionInProgress ||
      this.#connectionEndedOnPane ||
      store.getState().connection.inProgress
    ) {
      this.#selectionInProgress = false;
      this.#connectionEndedOnPane = false;
      return;
    }
    if (host.hasListener('pane-click')) host.emit('pane-click', { event });
    store.resetSelectedElements();
    store.setState({ nodesSelectionActive: false });
  }

  // --- pointer position -------------------------------------------------------------------------

  /** Remember the pointer; `lastPointerFlowPosition` is written once per frame. */
  #trackPointer(event: PointerEvent): void {
    this.#lastPointer = { x: event.clientX, y: event.clientY };
    if (this.#pointerFrame) return;
    this.#pointerFrame = requestAnimationFrame(() => {
      this.#pointerFrame = 0;
      const pointer = this.#lastPointer;
      const store = this.host.hasStore ? this.host.store : null;
      const domNode = store?.getState().domNode;
      if (!pointer || !store || !domNode) return;
      const bounds = domNode.getBoundingClientRect();
      const position = pointToRendererPoint(
        { x: pointer.x - bounds.left, y: pointer.y - bounds.top },
        store.getState().transform,
      );
      const previous = store.getState().lastPointerFlowPosition;
      if (previous?.x === position.x && previous.y === position.y) return;
      store.setState({ lastPointerFlowPosition: position });
    });
  }

  // --- user selection ---------------------------------------------------------------------------

  #pointerDownCapture(event: PointerEvent): void {
    const { host } = this;
    if (!this.#isSelectionEnabled) return;
    const store = host.store;
    const s = store.getState();
    const { selectionKeyPressed, selectionOnDrag, panOnDrag, isSelecting } = this.interaction;

    // Mouse button arrays only restrict mouse input. Let touch panning handle this gesture
    // unless the user explicitly activated selection with the selection key.
    if (event.pointerType === 'touch' && panOnDrag !== false && !selectionKeyPressed) return;

    this.#bounds = s.domNode?.getBoundingClientRect() ?? null;
    if (!this.#bounds) return;

    const targetIsPane = event.target === host.paneRef.value;
    // a child with the `nokey` class does not start a selection
    const isNoKeyEvent = !targetIsPane && !!(event.target as Element).closest('.nokey');
    const isSelectionActive = (selectionOnDrag && targetIsPane) || selectionKeyPressed;

    if (
      isNoKeyEvent ||
      !isSelecting ||
      !isSelectionActive ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    capturePointer(event.target, event.pointerId, true);

    this.#selectionInProgress = false;
    this.#gestureId = undefined;

    const { x, y } = getEventPosition(event, this.#bounds);
    // stored in flow coordinates so the start stays put on the canvas while auto-panning
    const start = pointToRendererPoint({ x, y }, s.transform);
    store.setState({
      userSelectionRect: { width: 0, height: 0, startX: start.x, startY: start.y, x, y },
    });

    if (!targetIsPane) {
      // a node or edge under the pointer must not start its own gesture
      event.stopPropagation();
      event.preventDefault();
    }
  }

  #selectionMove(event: PointerEvent): void {
    const { host } = this;
    const store = host.store;
    const s = store.getState();
    const rect = s.userSelectionRect;
    if (!this.#bounds || !rect) return;

    const { x: mouseX, y: mouseY } = getEventPosition(event, this.#bounds);
    this.#position = { x: mouseX, y: mouseY };

    const screenStart = rendererPointToPoint({ x: rect.startX, y: rect.startY }, s.transform);

    if (!this.#selectionInProgress) {
      const requiredDistance = s.selectionKeyPressed ? 0 : host.paneClickDistance;
      const distance = Math.hypot(mouseX - screenStart.x, mouseY - screenStart.y);
      if (distance <= requiredDistance) return;
      store.resetSelectedElements();
      host.emit('selection-start', { event });
    }

    this.#selectionInProgress = true;

    if (!this.#autoPanRunning) {
      this.#autoPanRunning = true;
      this.#autoPan();
    }

    this.#commitUserSelectionRect(mouseX, mouseY);
  }

  /** Commit the rectangle to the store, on pointer move and while auto-panning. */
  #commitUserSelectionRect(mouseX: number, mouseY: number): void {
    const store = this.host.store;
    const s = store.getState();
    const rect = s.userSelectionRect;
    if (!rect) return;
    const { transform, nodeLookup, edgeLookup, connectionLookup, defaultEdgeOptions } = s;

    const start = { x: rect.startX, y: rect.startY };
    const { x: screenStartX, y: screenStartY } = rendererPointToPoint(start, transform);
    // screen coordinates; only the start is kept in flow coordinates (see pointer down)
    const next = {
      startX: start.x,
      startY: start.y,
      x: mouseX < screenStartX ? mouseX : screenStartX,
      y: mouseY < screenStartY ? mouseY : screenStartY,
      width: Math.abs(mouseX - screenStartX),
      height: Math.abs(mouseY - screenStartY),
    };

    const prevNodeIds = this.#selectedNodeIds;
    const prevEdgeIds = this.#selectedEdgeIds;

    this.#selectedNodeIds = new Set(
      getNodesInside(
        nodeLookup,
        next,
        transform,
        s.selectionMode === SelectionMode.Partial,
        true,
      ).map((node) => node.id),
    );

    this.#selectedEdgeIds = new Set();
    const edgesSelectable = defaultEdgeOptions?.selectable ?? true;
    // edges connected to selected nodes
    for (const nodeId of this.#selectedNodeIds) {
      const connections = connectionLookup.get(nodeId);
      if (!connections) continue;
      for (const { edgeId } of connections.values()) {
        const edge = edgeLookup.get(edgeId);
        if (edge && (edge.selectable ?? edgesSelectable)) this.#selectedEdgeIds.add(edgeId);
      }
    }

    this.#gestureId ??= createId();
    const meta = { phase: 'discrete', origin: 'select', gestureId: this.#gestureId } as const;
    if (!sameIds(prevNodeIds, this.#selectedNodeIds)) {
      store.triggerNodeChanges(getSelectionChanges(nodeLookup, this.#selectedNodeIds, true), meta);
    }
    if (!sameIds(prevEdgeIds, this.#selectedEdgeIds)) {
      store.triggerEdgeChanges(getSelectionChanges(edgeLookup, this.#selectedEdgeIds), meta);
    }

    store.setState({
      userSelectionRect: next,
      userSelectionActive: true,
      nodesSelectionActive: false,
    });
  }

  /** Pan while the pointer is near the edge of the flow, and keep the rectangle in step. */
  #autoPan(): void {
    const store = this.host.store;
    const s = store.getState();
    if (!this.#autoPanRunning || !s.autoPanOnSelection || !this.#bounds) {
      this.#autoPanRunning = false;
      return;
    }
    const [x, y] = calcAutoPan(this.#position, this.#bounds, s.autoPanSpeed);
    const next = (): void => {
      if (this.#autoPanRunning) this.#autoPanId = requestAnimationFrame(() => this.#autoPan());
    };
    void store.panBy({ x: x ?? 0, y: y ?? 0 }).then((panned) => {
      if (this.#autoPanRunning && this.#selectionInProgress && panned) {
        this.#commitUserSelectionRect(this.#position.x, this.#position.y);
      }
      next();
    });
  }

  #cleanupAutoPan(): void {
    cancelAnimationFrame(this.#autoPanId);
    this.#autoPanId = 0;
    this.#autoPanRunning = false;
  }

  // --- the box around the selected nodes --------------------------------------------------------

  /** Keydown on the selected-nodes box: arrow keys move the selection. */
  readonly onSelectionKeyDown = (event: KeyboardEvent): void => {
    if (!Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) return;
    event.preventDefault();
    this.host.store.moveSelectedNodes(
      arrowKeyDiffs[event.key] as XYPosition,
      event.shiftKey ? 4 : 1,
    );
  };

  /** Click on the selected-nodes box. */
  readonly onSelectionClick = (event: MouseEvent): void => {
    if (!this.host.hasListener('selection-click')) return;
    const nodes = this.host.store.getState().nodes.filter((n) => n.selected);
    this.host.emit('selection-click', { event, nodes });
  };

  /** Context menu on the selected-nodes box. */
  readonly onSelectionContextMenu = (event: MouseEvent): void => {
    if (!this.host.hasListener('selection-context-menu')) return;
    const nodes = this.host.store.getState().nodes.filter((n) => n.selected);
    this.host.emit('selection-context-menu', { event, nodes });
  };

  /** Keep the capture-phase click listener on the current pane element. */
  #syncPaneListener(): void {
    const pane = this.host.paneRef.value ?? null;
    if (pane === this.#paneEl) return;
    this.#paneEl?.removeEventListener('click', this.#onClickCapture, { capture: true });
    this.#paneEl = pane;
    pane?.addEventListener('click', this.#onClickCapture, { capture: true });
  }

  /** Attach `XYDrag` to the box while it exists; focus it when it appears. */
  #syncSelectionBox(): void {
    const { host } = this;
    if (!host.hasStore) return;
    const root = host.renderRoot as ParentNode | undefined;
    const rect = root?.querySelector<HTMLElement>(NODES_SELECTION_RECT) ?? null;
    const store = host.store;
    if (rect !== this.#rectEl || (rect && this.#rectDragStore !== store)) {
      this.#destroyRectDrag();
      this.#rectEl = rect;
      if (rect) {
        this.#rectDragStore = store;
        this.#rectDrag = XYDrag({ getStoreItems: createDragStoreItems(store, host) });
        if (!store.getState().disableKeyboardA11y) rect.focus({ preventScroll: true });
      }
    }
    this.#rectDrag?.update({ domNode: rect as HTMLElement });
  }

  #destroyRectDrag(): void {
    this.#rectDrag?.destroy();
    this.#rectDrag = null;
    this.#rectEl = null;
    this.#rectDragStore = null;
  }
}
