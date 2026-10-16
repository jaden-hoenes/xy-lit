/*
 * Module worker entry of the layout: receives `{ id, nodes, edges, options }`, answers
 * `{ id, positions }` or `{ id, error }`. Peer dependencies are loaded on demand.
 */
import { computeLayout } from './algorithms.js';
import type {
  LayoutInputEdge,
  LayoutInputNode,
  LayoutOptions,
  LayoutResult,
} from './algorithms.js';

/** Request posted to the worker. */
export interface LayoutRequest {
  id: number;
  nodes: LayoutInputNode[];
  edges: LayoutInputEdge[];
  options: LayoutOptions;
}

/** Reply of the worker. */
export type LayoutReply = { id: number; positions: LayoutResult } | { id: number; error: string };

interface WorkerScope {
  addEventListener(type: 'message', listener: (e: MessageEvent<LayoutRequest>) => void): void;
  postMessage(message: LayoutReply): void;
}
const scope = self as unknown as WorkerScope;

// addEventListener, not onmessage: elkjs's bundle assigns `self.onmessage` when it is imported
scope.addEventListener('message', (e) => {
  const { id, nodes, edges, options } = e.data;
  computeLayout(nodes, edges, options).then(
    (positions) => scope.postMessage({ id, positions }),
    (error: unknown) =>
      scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }),
  );
});
