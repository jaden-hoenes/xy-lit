import { applyEdgeChanges, applyNodeChanges } from '../changes.js';
import type { ChangeMeta, EdgeChange, NodeChange } from '../types/changes.js';
import type { Edge } from '../types/edges.js';
import type { Node } from '../types/nodes.js';
import type { FlowDataSource } from '../types/source.js';

/**
 * The default, in-memory data source: two plain arrays. Changes are applied with
 * `applyNodeChanges` / `applyEdgeChanges` (or taken verbatim from `meta.snapshotNodes` /
 * `meta.snapshotEdges`) and listeners are notified synchronously, so in uncontrolled mode the
 * store is up to date when `triggerNodeChanges` returns.
 */
export class ArraySource<N extends Node = Node, E extends Edge = Edge> implements FlowDataSource<
  N,
  E
> {
  private readonly listeners = new Set<() => void>();

  /**
   * @param nodes - Initial nodes.
   * @param edges - Initial edges.
   */
  constructor(
    public nodes: N[] = [],
    public edges: E[] = [],
  ) {}

  /** Subscribe to changes of `nodes` and/or `edges`. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Assign new nodes and notify (used by the element's `.nodes` setter). */
  replaceNodes(nodes: N[]): void {
    this.nodes = nodes;
    this.notify();
  }

  /** Assign new edges and notify (used by the element's `.edges` setter). */
  replaceEdges(edges: E[]): void {
    this.edges = edges;
    this.notify();
  }

  /** Apply node changes (or take `meta.snapshotNodes` verbatim) and notify. */
  applyNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): void {
    this.nodes = meta.snapshotNodes ?? applyNodeChanges(changes, this.nodes);
    this.notify();
  }

  /** Apply edge changes (or take `meta.snapshotEdges` verbatim) and notify. */
  applyEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>): void {
    this.edges = meta.snapshotEdges ?? applyEdgeChanges(changes, this.edges);
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
