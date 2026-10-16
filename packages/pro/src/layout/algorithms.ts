/*
 * The layout algorithms. Pure functions over plain data, so the same code runs in the worker
 * (`worker.ts`) and on the main thread (fallback). Peer dependencies are imported lazily: a
 * flow that only uses dagre never loads elkjs.
 */

import type * as DagreModule from '@dagrejs/dagre';
import type ElkModule from 'elkjs/lib/elk.bundled.js';
import type * as D3Hierarchy from 'd3-hierarchy';
import type * as D3Force from 'd3-force';

/** Direction of dagre and tree layouts. */
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

/** Which algorithm to run and its options. */
export type LayoutOptions =
  | { algorithm: 'dagre'; direction?: LayoutDirection; nodesep?: number; ranksep?: number }
  | { algorithm: 'elk'; elkOptions?: Record<string, string> }
  | { algorithm: 'tree'; direction?: 'TB' | 'LR'; nodeSize?: [number, number] }
  | { algorithm: 'force'; iterations?: number; strength?: number };

/** A node as the algorithms see it: centre-independent top-left and size. */
export interface LayoutInputNode {
  id: string;
  width: number;
  height: number;
  /** Current top-left (used as the starting point of `force`). */
  x: number;
  y: number;
}

/** An edge between two laid-out nodes. */
export interface LayoutInputEdge {
  id: string;
  source: string;
  target: string;
}

/** Top-left positions by node id, normalised so the bounding box starts at (0, 0). */
export type LayoutResult = [id: string, x: number, y: number][];

const PEERS = {
  dagre: '@dagrejs/dagre',
  elk: 'elkjs',
  tree: 'd3-hierarchy',
  force: 'd3-force',
} as const;

/** The error for a layout peer dependency that is not installed. */
export function missingPeer(algorithm: keyof typeof PEERS, cause: unknown): Error {
  const peer = PEERS[algorithm];
  const detail = cause instanceof Error ? ` (${cause.message})` : '';
  return new Error(
    `XY Lit: the "${algorithm}" layout needs the optional peer dependency "${peer}". Install it with "npm install ${peer}"${detail}.`,
  );
}

function normalise(
  raw: Map<string, { x: number; y: number }>,
  nodes: LayoutInputNode[],
): LayoutResult {
  let minX = Infinity;
  let minY = Infinity;
  for (const p of raw.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  if (!Number.isFinite(minX)) return [];
  return nodes.flatMap((n): LayoutResult => {
    const p = raw.get(n.id);
    return p ? [[n.id, p.x - minX, p.y - minY]] : [];
  });
}

async function dagreLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  o: Extract<LayoutOptions, { algorithm: 'dagre' }>,
): Promise<LayoutResult> {
  let dagre: typeof DagreModule;
  try {
    dagre = await import('@dagrejs/dagre');
  } catch (error) {
    throw missingPeer('dagre', error);
  }
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: o.direction ?? 'TB',
    nodesep: o.nodesep ?? 50,
    ranksep: o.ranksep ?? 50,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const raw = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id) as { x: number; y: number };
    raw.set(n.id, { x: p.x - n.width / 2, y: p.y - n.height / 2 });
  }
  return normalise(raw, nodes);
}

let elkUsers = 0;

async function elkLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  o: Extract<LayoutOptions, { algorithm: 'elk' }>,
): Promise<LayoutResult> {
  let ELK: typeof ElkModule;
  /*
   * elk's bundle contains its own worker bootstrap, which decides by `typeof document` whether it
   * runs inside a dedicated worker (it then takes over `self.onmessage` and does not export the
   * in-thread "fake worker" the bundle needs). Inside ours it must not, so while elk loads and
   * runs, pretend there is a document. The bootstrap also runs lazily, hence the counter.
   */
  const scope = self as unknown as { document?: unknown };
  const inWorker = typeof document === 'undefined' && typeof self !== 'undefined';
  if (inWorker) {
    scope.document ??= {};
    elkUsers++;
  }
  try {
    try {
      ELK = (await import('elkjs/lib/elk.bundled.js')).default;
    } catch (error) {
      throw missingPeer('elk', error);
    }
    const elk = new ELK();
    const result = await elk.layout({
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '60',
        ...o.elkOptions,
      },
      children: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
      edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    });
    const raw = new Map<string, { x: number; y: number }>();
    for (const c of result.children ?? []) raw.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
    return normalise(raw, nodes);
  } finally {
    if (inWorker && --elkUsers === 0) delete scope.document;
  }
}
interface TreeDatum {
  id: string | null;
  children: TreeDatum[];
}

async function treeLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  o: Extract<LayoutOptions, { algorithm: 'tree' }>,
): Promise<LayoutResult> {
  let d3: typeof D3Hierarchy;
  try {
    d3 = await import('d3-hierarchy');
  } catch (error) {
    throw missingPeer('tree', error);
  }
  // the first edge into a node makes its source the parent; edges that would close a cycle are ignored
  const parentOf = new Map<string, string>();
  const known = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (e.source === e.target || parentOf.has(e.target)) continue;
    if (!known.has(e.source) || !known.has(e.target)) continue;
    let p: string | undefined = e.source;
    let cycle = false;
    for (; p !== undefined; p = parentOf.get(p)) {
      if (p === e.target) {
        cycle = true;
        break;
      }
    }
    if (!cycle) parentOf.set(e.target, e.source);
  }
  const data = new Map<string, TreeDatum>(nodes.map((n) => [n.id, { id: n.id, children: [] }]));
  const roots: TreeDatum[] = [];
  for (const n of nodes) {
    const parent = parentOf.get(n.id);
    if (parent) data.get(parent)!.children.push(data.get(n.id)!);
    else roots.push(data.get(n.id)!);
  }
  const root: TreeDatum = roots.length === 1 ? roots[0]! : { id: null, children: roots };

  const horizontal = o.direction === 'LR';
  const maxW = Math.max(...nodes.map((n) => n.width));
  const maxH = Math.max(...nodes.map((n) => n.height));
  const [cellW, cellH] = o.nodeSize ?? [maxW + 40, maxH + 60];
  // d3: x is the breadth axis, y the depth axis
  const tree = d3.tree<TreeDatum>().nodeSize(horizontal ? [cellH, cellW] : [cellW, cellH]);
  const laid = tree(d3.hierarchy(root, (d) => d.children));
  const size = new Map(nodes.map((n) => [n.id, n]));
  const raw = new Map<string, { x: number; y: number }>();
  for (const d of laid.descendants()) {
    const id = d.data.id;
    if (id === null) continue;
    const n = size.get(id)!;
    const cx = horizontal ? d.y : d.x;
    const cy = horizontal ? d.x : d.y;
    raw.set(id, { x: cx - n.width / 2, y: cy - n.height / 2 });
  }
  return normalise(raw, nodes);
}

async function forceLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  o: Extract<LayoutOptions, { algorithm: 'force' }>,
): Promise<LayoutResult> {
  let d3: typeof D3Force;
  try {
    d3 = await import('d3-force');
  } catch (error) {
    throw missingPeer('force', error);
  }
  type Sim = D3Force.SimulationNodeDatum & { id: string; r: number };
  const sim: Sim[] = nodes.map((n) => ({
    id: n.id,
    x: n.x + n.width / 2,
    y: n.y + n.height / 2,
    r: Math.hypot(n.width, n.height) / 2,
  }));
  const ids = new Set(sim.map((s) => s.id));
  const links = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));
  const cx = sim.reduce((s, n) => s + (n.x ?? 0), 0) / Math.max(1, sim.length);
  const cy = sim.reduce((s, n) => s + (n.y ?? 0), 0) / Math.max(1, sim.length);
  const simulation = d3
    .forceSimulation(sim)
    .force(
      'link',
      d3
        .forceLink<Sim, { source: string; target: string }>(links)
        .id((d) => d.id)
        .distance(160),
    )
    .force('charge', d3.forceManyBody().strength(o.strength ?? -400))
    .force('center', d3.forceCenter(cx, cy))
    .force(
      'collide',
      d3.forceCollide<Sim>((d) => d.r + 10),
    )
    .stop();
  simulation.tick(o.iterations ?? 300);
  const size = new Map(nodes.map((n) => [n.id, n]));
  const raw = new Map<string, { x: number; y: number }>();
  for (const s of sim) {
    const n = size.get(s.id)!;
    raw.set(s.id, { x: (s.x ?? 0) - n.width / 2, y: (s.y ?? 0) - n.height / 2 });
  }
  return normalise(raw, nodes);
}

/**
 * Run a layout algorithm over plain data. Used by the worker and by the main-thread fallback.
 *
 * @throws When the algorithm's peer dependency is not installed (message names the package).
 */
export function computeLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
  options: LayoutOptions,
): Promise<LayoutResult> {
  if (!nodes.length) return Promise.resolve([]);
  switch (options.algorithm) {
    case 'dagre':
      return dagreLayout(nodes, edges, options);
    case 'elk':
      return elkLayout(nodes, edges, options);
    case 'tree':
      return treeLayout(nodes, edges, options);
    case 'force':
      return forceLayout(nodes, edges, options);
    default:
      return Promise.reject(
        new Error(
          `XY Lit: unknown layout algorithm "${(options as { algorithm: string }).algorithm}"`,
        ),
      );
  }
}
