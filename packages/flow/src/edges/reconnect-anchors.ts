// Ported from xyflow (MIT) packages/react/src/components/EdgeWrapper/EdgeUpdateAnchors.tsx, packages/react/src/components/Edges/EdgeAnchor.tsx, packages/svelte/src/lib/components/EdgeReconnectAnchor/EdgeReconnectAnchor.svelte@3d35b57
import { svg } from 'lit';
import type { SVGTemplateResult } from 'lit';
import { Position } from '@xy-lit/store';
import type { EdgeLayouted, FinalConnectionState, HandleType } from '@xy-lit/store';
import { XYHandle, isMouseEvent } from '@xy-lit/store/internal';
import type { XyFlowElement } from '../elements/xy-flow.js';

/** Which end of an edge an anchor drags. */
export type EdgeEnd = 'source' | 'target';

const shiftX = (x: number, shift: number, position: Position): number => {
  if (position === Position.Left) return x - shift;
  if (position === Position.Right) return x + shift;
  return x;
};

const shiftY = (y: number, shift: number, position: Position): number => {
  if (position === Position.Top) return y - shift;
  if (position === Position.Bottom) return y + shift;
  return y;
};

/** Inputs of {@link reconnectAnchors}. */
export type ReconnectAnchorsOptions = {
  /** The laid-out edge (end positions and sides). */
  edge: EdgeLayouted;
  /** `true` shows both anchors, `'source'` / `'target'` one of them. */
  reconnectable: boolean | 'source' | 'target';
  /** Radius of the anchors, in flow pixels. */
  radius: number;
  /** Extra class that keeps panning from starting on an anchor (`noPanClassName`). */
  noPanClassName: string;
  /** A press on an anchor: start dragging that end. */
  onStart: (event: MouseEvent | TouchEvent, end: EdgeEnd) => void;
  /** The pointer entered or left an anchor. */
  onHover: (hover: boolean) => void;
};

/**
 * The two transparent circles around the ends of a reconnectable edge (React `EdgeUpdateAnchors`).
 * Each sits just outside its node, on the side the edge leaves. Pressing one lets the user drag
 * that end of the edge to another handle.
 *
 * @param o - See {@link ReconnectAnchorsOptions}.
 */
export function reconnectAnchors(o: ReconnectAnchorsOptions): SVGTemplateResult {
  const { edge, radius } = o;
  const anchor = (
    end: EdgeEnd,
    x: number,
    y: number,
    position: Position,
  ): SVGTemplateResult => svg`<circle
    class="lit-flow__edgeupdater lit-flow__edgeupdater-${end} ${o.noPanClassName}"
    cx=${shiftX(x, radius, position)}
    cy=${shiftY(y, radius, position)}
    r=${radius}
    stroke="transparent"
    fill="transparent"
    @pointerdown=${capturePointer}
    @mousedown=${(e: MouseEvent) => {
      o.onStart(e, end);
    }}
    @touchstart=${(e: TouchEvent) => {
      o.onStart(e, end);
    }}
    @mouseenter=${() => {
      o.onHover(true);
    }}
    @mouseout=${() => {
      o.onHover(false);
    }}
  ></circle>`;
  return svg`${
    o.reconnectable === true || o.reconnectable === 'source'
      ? anchor('source', edge.sourceX, edge.sourceY, edge.sourcePosition)
      : ''
  }${
    o.reconnectable === true || o.reconnectable === 'target'
      ? anchor('target', edge.targetX, edge.targetY, edge.targetPosition)
      : ''
  }`;
}

/**
 * Pointer capture keeps the mouse events of the drag coming even when the pointer leaves the
 * flow (see spec/06 §Pointer capture); the engine listens on the flow's root.
 */
function capturePointer(event: PointerEvent): void {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  try {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  } catch {
    // capture is an optimisation for pointers that leave the flow; a refusal is harmless
  }
}

/** Callbacks and context of {@link startReconnect}. */
export type StartReconnectOptions = {
  /** The flow the edge lives in. */
  flow: XyFlowElement;
  /** Id of the edge. */
  edgeId: string;
  /** The end the user pressed (the one that moves). */
  end: EdgeEnd;
  /** The anchor element that was pressed. */
  anchor: Element;
  /** The drag really started (past the drag threshold). */
  onStart: () => void;
  /** The drag ended. */
  onEnd: () => void;
};

/**
 * Start dragging one end of an edge (React `handleEdgeUpdater`, Svelte
 * `EdgeReconnectAnchor.onPointerDown`). The *opposite* end stays where it is and is the handle
 * the new connection is drawn from. A valid drop calls `flow.handleReconnect()`.
 *
 * Emits `connect-start`, `reconnect-start` when the drag starts and `connect-end`,
 * `reconnect-end` when it ends.
 *
 * @param event - The `mousedown` or `touchstart` that began the gesture.
 * @param o - See {@link StartReconnectOptions}.
 */
export function startReconnect(event: MouseEvent | TouchEvent, o: StartReconnectOptions): void {
  // only the primary button drags an anchor
  if (isMouseEvent(event) && event.button !== 0) return;
  const { flow } = o;
  const { store } = flow;
  const s = store.getState();
  const edge = s.edgeLookup.get(o.edgeId);
  if (!edge) return;

  const opposite: { nodeId: string; handleId: string | null; type: HandleType } =
    o.end === 'source'
      ? { nodeId: edge.target, handleId: edge.targetHandle ?? null, type: 'target' }
      : { nodeId: edge.source, handleId: edge.sourceHandle ?? null, type: 'source' };

  XYHandle.onPointerDown(event, {
    autoPanOnConnect: s.autoPanOnConnect,
    autoPanSpeed: s.autoPanSpeed,
    connectionMode: s.connectionMode,
    connectionRadius: s.connectionRadius,
    domNode: s.domNode,
    handleId: opposite.handleId,
    nodeId: opposite.nodeId,
    nodeLookup: s.nodeLookup,
    isTarget: opposite.type === 'target',
    edgeUpdaterType: opposite.type,
    lib: 'lit',
    flowId: s.flowId,
    cancelConnection: () => {
      store.cancelConnection();
    },
    panBy: (delta) => store.panBy(delta),
    isValidConnection: (connection) => store.getState().isValidConnection?.(connection) ?? true,
    updateConnection: (connection) => {
      store.updateConnection(connection);
    },
    getTransform: () => store.getState().transform,
    getFromHandle: () => store.getState().connection.fromHandle,
    dragThreshold: s.connectionDragThreshold,
    handleDomNode: o.anchor,
    onConnectStart: (e, params) => {
      o.onStart();
      flow.emit('reconnect-start', { event: e, edge: edge, handleType: opposite.type });
      flow.emit('connect-start', { event: e, ...params });
    },
    onConnect: (connection) => {
      flow.handleReconnect(edge, connection);
    },
    onConnectEnd: (e, connectionState: FinalConnectionState) => {
      flow.emit('connect-end', { event: e, connectionState });
    },
    onReconnectEnd: (e, connectionState: FinalConnectionState) => {
      o.onEnd();
      flow.emit('reconnect-end', {
        event: e,
        edge: edge,
        handleType: opposite.type,
        connectionState,
      });
    },
  });
}
