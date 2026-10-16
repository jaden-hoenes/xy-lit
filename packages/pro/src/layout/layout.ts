import { DEFAULT_NODE_SIZE, createId } from '@xy-lit/store';
import type { Edge, InternalNode, NodeOrigin, XYPosition } from '@xy-lit/store';
import { instanceOf, storeOf } from '../common.js';
import type { FlowLike } from '../common.js';
import { animateNodePositions } from '../animation/animate.js';
import { computeLayout } from './algorithms.js';
import type {
  LayoutInputEdge,
  LayoutInputNode,
  LayoutOptions,
  LayoutResult,
} from './algorithms.js';
import type { LayoutReply, LayoutRequest } from './worker.js';

export type { LayoutOptions, LayoutDirection } from './algorithms.js';

/** How and where {@link layout} runs. */
export interface LayoutRunOptions {
  /**
   * `true` (default): a shared module Web Worker, falling back to the main thread when workers
   * are unavailable. `false`: the main thread. Or your own worker (same message protocol as
   * `worker.ts`).
   */
  worker?: boolean | Worker;
  /** Where the top-left corner of the result goes. Default `{ x: 0, y: 0 }`. */
  origin?: XYPosition;
  /** Origin used for nodes that have none of their own. Default `[0, 0]`. */
  nodeOrigin?: NodeOrigin;
}

type Pending = { resolve: (positions: LayoutResult) => void; reject: (error: Error) => void };

interface Shared {
  worker: Worker;
  pending: Map<number, Pending>;
  timer: ReturnType<typeof setTimeout> | undefined;
}

const IDLE_MS = 10_000;
let shared: Shared | null = null;
let nextId = 1;
let workerBroken = false;

/** Terminate the shared layout worker now (it is also terminated after 10 s without use). */
export function disposeLayoutWorker(): void {
  if (!shared) return;
  clearTimeout(shared.timer);
  shared.worker.terminate();
  for (const p of shared.pending.values()) p.reject(new Error('XY Lit: layout worker disposed'));
  shared = null;
}

/**
 * Where layouts run right now: `'worker'` while the shared worker is alive, `'main-thread'` once
 * it failed to start (layouts then fall back), `'idle'` before the first layout or after it was
 * disposed. Mostly for diagnostics and tests.
 */
export function layoutBackend(): 'worker' | 'main-thread' | 'idle' {
  if (workerBroken) return 'main-thread';
  return shared ? 'worker' : 'idle';
}

function sharedWorker(): Shared {
  if (shared) return shared;
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const state: Shared = { worker, pending: new Map(), timer: undefined };
  worker.addEventListener('message', (e: MessageEvent<LayoutReply>) => {
    const reply = e.data;
    const pending = state.pending.get(reply.id);
    if (!pending) return;
    state.pending.delete(reply.id);
    if ('error' in reply) pending.reject(new Error(reply.error));
    else pending.resolve(reply.positions);
  });
  // the worker could not start (blocked, bad URL): everything waiting is retried on the main thread
  worker.addEventListener('error', () => {
    workerBroken = true;
    const waiting = [...state.pending.values()];
    state.pending.clear();
    worker.terminate();
    if (shared === state) shared = null;
    for (const p of waiting) p.reject(new WorkerFailed());
  });
  shared = state;
  return state;
}

class WorkerFailed extends Error {
  constructor() {
    super('XY Lit: the layout worker failed to start');
  }
}

function post(
  worker: Worker,
  pending: Map<number, Pending>,
  request: Omit<LayoutRequest, 'id'>,
): Promise<LayoutResult> {
  const id = nextId++;
  return new Promise<LayoutResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...request });
  });
}

async function run(
  request: Omit<LayoutRequest, 'id'>,
  workerOption: boolean | Worker,
): Promise<LayoutResult> {
  if (typeof workerOption === 'object') {
    const pending = new Map<number, Pending>();
    const onMessage = (e: MessageEvent<LayoutReply>): void => {
      const reply = e.data;
      const p = pending.get(reply.id);
      if (!p) return;
      pending.delete(reply.id);
      if ('error' in reply) p.reject(new Error(reply.error));
      else p.resolve(reply.positions);
    };
    workerOption.addEventListener('message', onMessage);
    try {
      return await post(workerOption, pending, request);
    } finally {
      workerOption.removeEventListener('message', onMessage);
    }
  }
  if (workerOption && !workerBroken && typeof Worker !== 'undefined') {
    try {
      const state = sharedWorker();
      clearTimeout(state.timer);
      try {
        return await post(state.worker, state.pending, request);
      } finally {
        if (shared === state) {
          clearTimeout(state.timer);
          if (state.pending.size === 0) state.timer = setTimeout(disposeLayoutWorker, IDLE_MS);
        }
      }
    } catch (error) {
      if (!(error instanceof WorkerFailed) && !(error instanceof DOMException)) throw error;
      // fall through to the main thread
    }
  }
  return computeLayout(request.nodes, request.edges, request.options);
}

/** The root ancestor of a node among `byId` (a node whose parent is unknown is a root). */
function rootOf(id: string, parentOf: Map<string, string | undefined>): string {
  let current = id;
  const seen = new Set<string>();
  for (;;) {
    const parent = parentOf.get(current);
    if (!parent || !parentOf.has(parent) || seen.has(parent)) return current;
    seen.add(current);
    current = parent;
  }
}

/**
 * Compute positions for the root nodes of a graph, off the main thread. Uses measured sizes
 * (a fallback size for unmeasured nodes), skips hidden nodes and edges, and only lays out root
 * nodes: children keep their relative positions. An edge that ends at a child counts as an
 * edge of the child's root ancestor.
 *
 * The result is positioned so the top-left corner of the whole layout is `options.origin`
 * (default 0, 0) and holds `node.position` values (it accounts for `nodeOrigin`).
 *
 * @param nodes - Internal nodes (e.g. `store.getState().nodeLookup.values()`).
 * @param edges - The edges.
 * @param options - Algorithm and its options.
 * @param run - Worker choice and origin.
 * @returns Node id to position, for the root nodes only.
 * @throws When the algorithm's peer dependency is not installed.
 */
export async function layout(
  nodes: Iterable<InternalNode>,
  edges: Iterable<Edge>,
  options: LayoutOptions,
  run: LayoutRunOptions = {},
): Promise<Map<string, XYPosition>> {
  const list = [...nodes].filter((n) => !n.hidden);
  const parentOf = new Map<string, string | undefined>(list.map((n) => [n.id, n.parentId]));
  const roots = list.filter((n) => !n.parentId || !parentOf.has(n.parentId));
  const rootIds = new Set(roots.map((n) => n.id));

  const input: LayoutInputNode[] = roots.map((n) => ({
    id: n.id,
    width: n.measured.width ?? n.width ?? n.initialWidth ?? DEFAULT_NODE_SIZE.width,
    height: n.measured.height ?? n.height ?? n.initialHeight ?? DEFAULT_NODE_SIZE.height,
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
  }));
  const seen = new Set<string>();
  const lifted: LayoutInputEdge[] = [];
  for (const e of edges) {
    if (e.hidden) continue;
    if (!parentOf.has(e.source) || !parentOf.has(e.target)) continue;
    const source = rootOf(e.source, parentOf);
    const target = rootOf(e.target, parentOf);
    if (source === target || !rootIds.has(source) || !rootIds.has(target)) continue;
    const key = `${source}\u0000${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lifted.push({ id: e.id, source, target });
  }

  const result = await run_(input, lifted, options, run.worker ?? true);
  const origin = run.origin ?? { x: 0, y: 0 };
  const byId = new Map(roots.map((n) => [n.id, n]));
  const out = new Map<string, XYPosition>();
  for (const [id, x, y] of result) {
    const node = byId.get(id)!;
    const o = node.origin ?? run.nodeOrigin ?? [0, 0];
    const size = input.find((i) => i.id === id)!;
    out.set(id, { x: origin.x + x + o[0] * size.width, y: origin.y + y + o[1] * size.height });
  }
  return out;
}

function run_(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  options: LayoutOptions,
  worker: boolean | Worker,
): Promise<LayoutResult> {
  return run({ nodes, edges, options }, worker);
}

/** Options of {@link applyLayout}. */
export type ApplyLayoutOptions = LayoutOptions & {
  /** Animate the move over this many milliseconds. Default 0 (jump). */
  animate?: number;
  /** Fit the viewport to the nodes afterwards. Default false. */
  fitView?: boolean;
  /**
   * Keep the top-left corner of the laid-out nodes where it is now (default true), so the graph
   * does not jump away. `false` places it at (0, 0).
   */
  keepPosition?: boolean;
  /** Worker choice, see {@link LayoutRunOptions.worker}. */
  worker?: boolean | Worker;
};

/**
 * Lay out the flow's visible root nodes and move them there, as one undo step (one `gestureId`;
 * an animation is one gesture). Hidden nodes (collapsed) are ignored. The result is dropped when
 * the node set changed while the worker was busy only for nodes that no longer exist.
 *
 * @param flow - The `<xy-flow>` or its instance.
 * @param options - Algorithm options plus `animate`, `fitView`, `keepPosition`, `worker`.
 */
export async function applyLayout(flow: FlowLike, options: ApplyLayoutOptions): Promise<void> {
  const store = storeOf(flow);
  const { nodeLookup, edges, nodeOrigin } = store.getState();
  const { animate = 0, fitView = false, keepPosition = true, worker, ...algorithm } = options;
  const nodes = [...nodeLookup.values()];

  let origin: XYPosition = { x: 0, y: 0 };
  if (keepPosition) {
    const roots = nodes.filter((n) => !n.hidden && (!n.parentId || !nodeLookup.has(n.parentId)));
    if (roots.length) {
      origin = {
        x: Math.min(...roots.map((n) => n.internals.positionAbsolute.x)),
        y: Math.min(...roots.map((n) => n.internals.positionAbsolute.y)),
      };
    }
  }

  const positions = await layout(nodes, edges, algorithm, {
    worker,
    origin,
    nodeOrigin,
  });
  // nodes may have gone while the layout ran
  const live = store.getState().nodeLookup;
  const targets = new Map([...positions].filter(([id]) => live.has(id)));
  await animateNodePositions(flow, targets, {
    duration: animate,
    origin: 'layout',
    gestureId: createId(),
    respectReducedMotion: false,
  });
  if (fitView) await instanceOf(flow).fitView({ duration: animate > 0 ? 200 : 0 });
}
