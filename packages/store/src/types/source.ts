import type { FlowStore } from '../flow-store.js';
import type { ChangeMeta, EdgeChange, NodeChange } from './changes.js';
import type { Edge } from './edges.js';
import type { Node } from './nodes.js';

/**
 * Where the nodes and edges live. The default is an in-memory `ArraySource`; collaborative
 * sources (Yjs) implement the same interface.
 */
export interface FlowDataSource<N extends Node = Node, E extends Edge = Edge> {
  /** Current arrays. Must keep object identity for unchanged elements between notifications. */
  readonly nodes: N[];
  /** Current edges. Must keep object identity for unchanged elements between notifications. */
  readonly edges: E[];
  /** Called after nodes and/or edges changed. Synchronous or async is fine. */
  subscribe(listener: () => void): () => void;
  /** Apply node changes produced by the flow. */
  applyNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): void;
  /** Apply edge changes produced by the flow. */
  applyEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>): void;
  /** Precise data update; when absent the store sends a `replace` change instead. */
  updateNodeData?(id: string, patch: Partial<N['data']>, meta: ChangeMeta<N, E>): void;
  /** Precise data update; when absent the store sends a `replace` change instead. */
  updateEdgeData?(id: string, patch: Partial<NonNullable<E['data']>>, meta: ChangeMeta<N, E>): void;
  /** Group several applies into one atomic unit (one undo step for Yjs). */
  transact?(fn: () => void, origin?: unknown): void;
  /** Bumped when the source wants render-complete to re-arm (e.g. a remote structural change). */
  readonly structureVersion?: number;
  /** True while the source notifies about a change that came from another client (motion). */
  readonly lastUpdateRemote?: boolean;
  /** Undo/redo the source supports (Yjs). The flow binds Mod+Z / Mod+Shift+Z / Mod+Y to it. */
  readonly history?: FlowHistory;
  /** Called by the flow when it stops using the source. */
  detach?(): void;
  /** Called by the flow when it starts using the source. */
  attach?(store: FlowStore<N, E>): void;
}

/** Undo/redo stack, provided by a source or registered with `store.setHistory()`. */
export interface FlowHistory {
  /** Undo the last step. */
  undo(): void;
  /** Redo the last undone step. */
  redo(): void;
  /** Whether `undo()` would do something. */
  canUndo(): boolean;
  /** Whether `redo()` would do something. */
  canRedo(): boolean;
  /** Notifies when `canUndo`/`canRedo` may have changed. */
  subscribe(listener: () => void): () => void;
}
