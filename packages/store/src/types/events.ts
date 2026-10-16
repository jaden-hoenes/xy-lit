import type { Connection, FinalConnectionState, HandleType, Viewport } from '../engine.js';
import type { ChangeMeta, EdgeChange, NodeChange } from './changes.js';
import type { Edge } from './edges.js';
import type { FlowInstance } from './instance.js';
import type { InternalNode, Node } from './nodes.js';

/**
 * Every event is a `CustomEvent<Detail>` dispatched on the `<xy-flow>` host with
 * `bubbles: true, composed: true`. Cancelable events honour `preventDefault()`.
 */
export interface FlowEventMap<N extends Node = Node, E extends Edge = Edge> {
  /** The flow is ready; the instance can be used. */
  init: { instance: FlowInstance<N, E> };
  /** Node changes about to be applied. Cancelable: the app then owns state. */
  'nodes-change': { changes: NodeChange<N>[]; meta: ChangeMeta<N, E> };
  /** Edge changes about to be applied. Cancelable: the app then owns state. */
  'edges-change': { changes: EdgeChange<E>[]; meta: ChangeMeta<N, E> };
  /** A connection was completed. Cancelable; the default action adds `edge`. */
  connect: { connection: Connection; edge: E };
  /** A connection drag started. */
  'connect-start': {
    event: MouseEvent | TouchEvent;
    nodeId: string | null;
    handleId: string | null;
    handleType: HandleType | null;
  };
  /** A connection drag ended. */
  'connect-end': {
    event: MouseEvent | TouchEvent;
    connectionState: FinalConnectionState<InternalNode<N>>;
  };
  /** Click-to-connect started. */
  'click-connect-start': FlowEventMap<N, E>['connect-start'];
  /** Click-to-connect ended. */
  'click-connect-end': FlowEventMap<N, E>['connect-end'];
  /** An edge was reconnected. Cancelable; the default action replaces the edge. */
  reconnect: { oldEdge: E; newConnection: Connection; edge: E };
  /** An edge end drag started. */
  'reconnect-start': { event: MouseEvent | TouchEvent; edge: E; handleType: HandleType };
  /** An edge end drag ended. */
  'reconnect-end': {
    event: MouseEvent | TouchEvent;
    edge: E;
    handleType: HandleType;
    connectionState: FinalConnectionState<InternalNode<N>>;
  };
  /** A node was clicked. */
  'node-click': { event: MouseEvent; node: N };
  /** A node was double-clicked. */
  'node-double-click': { event: MouseEvent; node: N };
  /** The context menu was requested on a node. */
  'node-context-menu': { event: MouseEvent; node: N };
  /** The pointer entered a node. */
  'node-pointer-enter': { event: PointerEvent; node: N };
  /** The pointer moved over a node. */
  'node-pointer-move': { event: PointerEvent; node: N };
  /** The pointer left a node. */
  'node-pointer-leave': { event: PointerEvent; node: N };
  /** A node drag started. */
  'node-drag-start': { event: MouseEvent; node: N; nodes: N[] };
  /** A node is being dragged. */
  'node-drag': { event: MouseEvent; node: N; nodes: N[] };
  /** A node drag ended. */
  'node-drag-stop': { event: MouseEvent; node: N; nodes: N[] };
  /** A selection drag started. */
  'selection-drag-start': { event: MouseEvent; nodes: N[] };
  /** A selection is being dragged. */
  'selection-drag': { event: MouseEvent; nodes: N[] };
  /** A selection drag ended. */
  'selection-drag-stop': { event: MouseEvent; nodes: N[] };
  /** Drawing a selection rectangle started. */
  'selection-start': { event: PointerEvent };
  /** Drawing a selection rectangle ended. */
  'selection-end': { event: PointerEvent };
  /** The selected-nodes box was clicked. */
  'selection-click': { event: MouseEvent; nodes: N[] };
  /** The context menu was requested on the selected-nodes box. */
  'selection-context-menu': { event: MouseEvent; nodes: N[] };
  /** The set of selected nodes or edges changed. */
  'selection-change': { nodes: N[]; edges: E[] };
  /** An edge was clicked. */
  'edge-click': { event: MouseEvent; edge: E };
  /** An edge was double-clicked. */
  'edge-double-click': { event: MouseEvent; edge: E };
  /** The context menu was requested on an edge. */
  'edge-context-menu': { event: MouseEvent; edge: E };
  /** The pointer entered an edge. */
  'edge-pointer-enter': { event: PointerEvent; edge: E };
  /** The pointer moved over an edge. */
  'edge-pointer-move': { event: PointerEvent; edge: E };
  /** The pointer left an edge. */
  'edge-pointer-leave': { event: PointerEvent; edge: E };
  /** The pane was clicked. */
  'pane-click': { event: MouseEvent };
  /** The context menu was requested on the pane. */
  'pane-context-menu': { event: MouseEvent };
  /** The pane was scrolled. */
  'pane-scroll': { event: WheelEvent };
  /** The pointer entered the pane. */
  'pane-pointer-enter': { event: PointerEvent };
  /** The pointer moved over the pane. */
  'pane-pointer-move': { event: PointerEvent };
  /** The pointer left the pane. */
  'pane-pointer-leave': { event: PointerEvent };
  /** A pan/zoom gesture started. */
  'move-start': { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  /** The viewport is moving. */
  move: { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  /** A pan/zoom gesture ended. */
  'move-end': { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  /** The viewport changed. */
  'viewport-change': { viewport: Viewport };
  /** Elements were deleted. */
  delete: { nodes: N[]; edges: E[] };
  /** Nodes are being deleted. */
  'nodes-delete': { nodes: N[] };
  /** Edges are being deleted. */
  'edges-delete': { edges: E[] };
  /** All nodes have been measured (fires once per false to true flip). */
  'nodes-initialized': { nodes: N[] };
  /** The current revision has been fully rendered. */
  'render-complete': { revision: number; nodeCount: number; edgeCount: number; durationMs: number };
  /** A recoverable error. Cancelable; the default action is `console.warn` in dev. */
  'flow-error': { code: string; message: string };
}
