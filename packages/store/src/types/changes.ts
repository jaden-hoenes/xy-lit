import type { EdgeSelectionChange, EdgeRemoveChange } from '../engine.js';
import type { Edge } from './edges.js';
import type { Node } from './nodes.js';

export type {
  NodeChange,
  NodeDimensionChange,
  NodePositionChange,
  NodeSelectionChange,
  NodeRemoveChange,
  NodeAddChange,
  NodeReplaceChange,
  EdgeSelectionChange,
  EdgeRemoveChange,
} from '../engine.js';

/** Edge `add` change. Same shape as upstream, constrained to XY Lit's `Edge`. */
export type EdgeAddChange<E extends Edge = Edge> = { item: E; type: 'add'; index?: number };
/** Edge `replace` change. Same shape as upstream, constrained to XY Lit's `Edge`. */
export type EdgeReplaceChange<E extends Edge = Edge> = { id: string; item: E; type: 'replace' };
/** Any change to an edge. Same union as upstream, constrained to XY Lit's `Edge`. */
export type EdgeChange<E extends Edge = Edge> =
  EdgeSelectionChange | EdgeRemoveChange | EdgeAddChange<E> | EdgeReplaceChange<E>;

/** Position of a change inside a gesture. */
export type ChangePhase = 'start' | 'live' | 'end' | 'discrete';

/** What produced a change. */
export type ChangeOrigin =
  | 'drag'
  | 'resize'
  | 'keyboard'
  | 'select'
  | 'measure'
  | 'connect'
  | 'reconnect'
  | 'delete'
  | 'api'
  | 'paste'
  | 'undo'
  | 'layout'
  | 'remote';

/** Context that travels with every change batch through middlewares, events and the source. */
export type ChangeMeta<N extends Node = Node, E extends Edge = Edge> = {
  /** Gesture phase. */
  phase: ChangePhase;
  /** What produced the change. */
  origin: ChangeOrigin;
  /** Stable id for one gesture (drag/resize), same across start/live/end. Also shared by multi-trigger operations. */
  gestureId?: string;
  /** For origin `'api'` setNodes: the full next array, so `ArraySource` can take it verbatim. */
  snapshotNodes?: N[];
  /** For origin `'api'` setEdges: the full next array, so `ArraySource` can take it verbatim. */
  snapshotEdges?: E[];
};
