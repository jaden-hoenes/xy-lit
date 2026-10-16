// Ported from xyflow (MIT) packages/react/src/utils/general.ts, utils/edges.ts, components/NodeWrapper/utils.tsx@3d35b57
import {
  addEdgeBase,
  getConnectedEdges as getConnectedEdgesBase,
  getIncomers as getIncomersBase,
  getOutgoers as getOutgoersBase,
  isEdgeBase,
  isNodeBase,
  reconnectEdgeBase,
} from './engine.js';
import type {
  AddEdgeOptions,
  Connection,
  EdgeBase,
  NodeBase,
  ReconnectEdgeOptions,
  XYPosition,
} from './engine.js';
import { devWarn } from './dev.js';
import type { Edge } from './types/edges.js';
import type { Node } from './types/nodes.js';

/**
 * Whether a value is usable as a `Node` (type guard).
 *
 * @param element - Value to test.
 */
export const isNode = <N extends Node = Node>(element: unknown): element is N =>
  isNodeBase<N>(element);

/**
 * Whether a value is usable as an `Edge` (type guard).
 *
 * @param element - Value to test.
 */
export const isEdge = <E extends Edge = Edge>(element: unknown): element is E =>
  isEdgeBase<EdgeBase>(element);

/**
 * Add an edge (or a connection) to an array of edges, ignoring duplicates. Wraps upstream
 * `addEdge` for XY Lit's `Edge` type.
 *
 * @param edgeParams - Edge or connection to add.
 * @param edges - Existing edges.
 * @param options - Upstream options; `onError` defaults to the dev warning.
 * @returns A new array with the edge added, or `edges` when it already exists.
 */
export function addEdge<E extends Edge = Edge>(
  edgeParams: E | Connection,
  edges: E[],
  options: AddEdgeOptions = {},
): E[] {
  return addEdgeBase(edgeParams as EdgeBase | Connection, edges as unknown as EdgeBase[], {
    ...options,
    onError: options.onError ?? devWarn,
  }) as unknown as E[];
}

/**
 * Replace the connection of an existing edge. Wraps upstream `reconnectEdge` for XY Lit's `Edge`.
 *
 * @param oldEdge - Edge to reconnect.
 * @param newConnection - New connection.
 * @param edges - All edges.
 * @param options - Upstream options (`shouldReplaceId` defaults to true).
 * @returns The new edges array.
 */
export function reconnectEdge<E extends Edge = Edge>(
  oldEdge: E,
  newConnection: Connection,
  edges: E[],
  options: ReconnectEdgeOptions = { shouldReplaceId: true },
): E[] {
  return reconnectEdgeBase(
    oldEdge as unknown as EdgeBase,
    newConnection,
    edges as unknown as EdgeBase[],
    { ...options, onError: options.onError ?? devWarn },
  ) as unknown as E[];
}

/**
 * Nodes that are the target of an edge whose source is `node`. Wraps upstream `getOutgoers`.
 *
 * @param node - Node (or id holder) to start from.
 * @param nodes - All nodes.
 * @param edges - All edges.
 */
export function getOutgoers<N extends Node = Node, E extends Edge = Edge>(
  node: N | { id: string },
  nodes: N[],
  edges: E[],
): N[] {
  return getOutgoersBase(node, nodes as NodeBase[], edges as unknown as EdgeBase[]) as N[];
}

/**
 * Nodes that are the source of an edge whose target is `node`. Wraps upstream `getIncomers`.
 *
 * @param node - Node (or id holder) to start from.
 * @param nodes - All nodes.
 * @param edges - All edges.
 */
export function getIncomers<N extends Node = Node, E extends Edge = Edge>(
  node: N | { id: string },
  nodes: N[],
  edges: E[],
): N[] {
  return getIncomersBase(node, nodes as NodeBase[], edges as unknown as EdgeBase[]) as N[];
}

/**
 * Edges that touch any of the given nodes. Wraps upstream `getConnectedEdges`.
 *
 * @param nodes - Nodes to find edges for.
 * @param edges - All edges.
 */
export function getConnectedEdges<N extends Node = Node, E extends Edge = Edge>(
  nodes: N[],
  edges: E[],
): E[] {
  return getConnectedEdgesBase(
    nodes as NodeBase[],
    edges as unknown as EdgeBase[],
  ) as unknown as E[];
}

/** Arrow key to unit direction, used for keyboard moves of nodes. */
export const arrowKeyDiffs: Readonly<Record<string, XYPosition>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Shallow equality for selector results: equal when both are `Object.is`-equal, or when both
 * are arrays/plain objects with `Object.is`-equal entries. (zustand `shallow`.)
 *
 * @param a - First value.
 * @param b - Second value.
 */
export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !Object.is(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Convert a number to a `px` string; strings pass through, `undefined` stays `undefined`.
 *
 * @param value - Number of pixels or a CSS length.
 */
export function toPx(value: number | string | undefined): string | undefined {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * A short random id (10 characters) for gestures. Uses `crypto.randomUUID` where available (it
 * is missing on insecure origins) and falls back to `Math.random`.
 */
export function createId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID().slice(0, 10);
  return Math.random().toString(36).slice(2, 12).padEnd(10, '0');
}
