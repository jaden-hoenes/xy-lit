import type {
  Dimensions,
  FitBoundsOptions,
  HandleConnection,
  HandleType,
  NodeConnection,
  Rect,
  SetCenterOptions,
  SnapGrid,
  Viewport,
  ViewportHelperFunctionOptions,
  XYPosition,
} from '../engine.js';
import type { Edge } from './edges.js';
import type { InternalNode, Node } from './nodes.js';
import type { FitViewOptions } from './options.js';

/** A node whose `position` may be omitted; the store then finds a free spot. */
export type PlaceableNode<N extends Node> = Omit<N, 'position'> & { position?: XYPosition };

/** Where and how `addNodes` / `findFreePosition` place nodes without a position. */
export type PlacementOptions = {
  /** Centre of the search: viewport centre (default), last pointer position, or a flow position. */
  around?: 'viewport-center' | 'pointer' | XYPosition;
  /** Spacing kept around existing nodes. Default 20. */
  gap?: number;
  /** Spiral step. Default: the snap grid width when snapping, else 20. */
  step?: number;
  /** Maximum number of spiral rings. Default 200. */
  maxRings?: number;
};

/**
 * The imperative API of a flow. A port of React Flow's `ReactFlowInstance` with XY Lit
 * additions (`findFreePosition`, placement for `addNodes`, data fast paths).
 */
export interface FlowInstance<N extends Node = Node, E extends Edge = Edge> {
  // graph
  /** Shallow copies of all nodes. */
  getNodes(): N[];
  /** Replace the nodes, or update them with a function. Batched per microtask. */
  setNodes(payload: N[] | ((nodes: N[]) => N[])): void;
  /** Append nodes; nodes without `position` are placed in free space. */
  addNodes(
    payload: N | N[] | PlaceableNode<N> | PlaceableNode<N>[],
    options?: { placement?: PlacementOptions },
  ): void;
  /** The user node with this id. */
  getNode(id: string): N | undefined;
  /** The engine's internal node with this id (absolute position, handle bounds, ...). */
  getInternalNode(id: string): InternalNode<N> | undefined;
  /** Shallow copies of all edges. */
  getEdges(): E[];
  /** Replace the edges, or update them with a function. Batched per microtask. */
  setEdges(payload: E[] | ((edges: E[]) => E[])): void;
  /** Append edges. */
  addEdges(payload: E | E[]): void;
  /** The edge with this id. */
  getEdge(id: string): E | undefined;
  /** Serialisable snapshot of the flow. */
  toObject(): { nodes: N[]; edges: E[]; viewport: Viewport };
  /** Delete nodes and edges (and their connected edges / children), honouring `onBeforeDelete`. */
  deleteElements(params: {
    nodes?: { id: string }[];
    edges?: { id: string }[];
  }): Promise<{ deletedNodes: N[]; deletedEdges: E[] }>;
  /** Nodes intersecting the given node or rectangle. */
  getIntersectingNodes(node: N | { id: string } | Rect, partially?: boolean, nodes?: N[]): N[];
  /** Whether the node or rectangle intersects `area`. */
  isNodeIntersecting(node: N | { id: string } | Rect, area: Rect, partially?: boolean): boolean;
  /** Update a node (merge by default, replace with `options.replace`). */
  updateNode(
    id: string,
    update: Partial<N> | ((node: N) => Partial<N>),
    options?: { replace: boolean },
  ): void;
  /** Update a node's `data`. Uses the source's precise update when it has one. */
  updateNodeData(
    id: string,
    update: Partial<N['data']> | ((node: N) => Partial<N['data']>),
    options?: { replace: boolean },
  ): void;
  /** Update an edge (merge by default, replace with `options.replace`). */
  updateEdge(
    id: string,
    update: Partial<E> | ((edge: E) => Partial<E>),
    options?: { replace: boolean },
  ): void;
  /** Update an edge's `data`. Uses the source's precise update when it has one. */
  updateEdgeData(
    id: string,
    update: Partial<E['data']> | ((edge: E) => Partial<E['data']>),
    options?: { replace: boolean },
  ): void;
  /** Bounding rectangle of the given nodes. */
  getNodesBounds(nodes: (N | InternalNode<N> | string)[]): Rect;
  /** Connections attached to one handle. */
  getHandleConnections(p: {
    type: HandleType;
    nodeId: string;
    id?: string | null;
  }): HandleConnection[];
  /** Connections attached to a node (optionally one handle type / handle). */
  getNodeConnections(p: {
    type?: HandleType;
    handleId?: string | null;
    nodeId: string;
  }): NodeConnection[];
  /** Re-measure nodes. Needs the flow element; a no-op without one. */
  updateNodeInternals(ids: string | string[]): void;
  /** Find free space for a node of the given size. */
  findFreePosition(size: Dimensions, options?: PlacementOptions): XYPosition;
  // viewport
  /** Zoom in by 1.2x. */
  zoomIn(o?: ViewportHelperFunctionOptions): Promise<boolean>;
  /** Zoom out by 1/1.2x. */
  zoomOut(o?: ViewportHelperFunctionOptions): Promise<boolean>;
  /** Zoom to a level. */
  zoomTo(zoom: number, o?: ViewportHelperFunctionOptions): Promise<boolean>;
  /** Current zoom. */
  getZoom(): number;
  /** Set the viewport; missing fields keep their current value. */
  setViewport(v: Partial<Viewport>, o?: ViewportHelperFunctionOptions): Promise<boolean>;
  /** Current viewport. */
  getViewport(): Viewport;
  /** Centre the viewport on a flow position. */
  setCenter(x: number, y: number, o?: SetCenterOptions): Promise<boolean>;
  /** Fit the viewport to the nodes. Queued until nodes are measured (with timeout fallback). */
  fitView(o?: FitViewOptions<N>): Promise<boolean>;
  /** Fit the viewport to a rectangle. */
  fitBounds(bounds: Rect, o?: FitBoundsOptions): Promise<boolean>;
  /** Convert a client (screen) position to flow coordinates. */
  screenToFlowPosition(
    p: XYPosition,
    o?: { snapToGrid?: boolean; snapGrid?: SnapGrid },
  ): XYPosition;
  /** Convert a flow position to client (screen) coordinates. */
  flowToScreenPosition(p: XYPosition): XYPosition;
  /** True once the pan/zoom engine is attached. */
  readonly viewportInitialized: boolean;
}
