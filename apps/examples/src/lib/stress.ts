/**
 * Stress page: a grid of `count` default nodes joined by `count - 1` edges (each node to its left
 * neighbour, the first node of a row to the node above it), fitted into the viewport. Used by
 * `/stress/:count`, `/examples/stress` and the budgets in `tests/perf`.
 *
 * The page records what the perf specs read on `window.__stress`.
 */
import '@xy-lit/flow/define.js';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';

/** What the perf specs read from the page. */
export interface StressHandle {
  flow: XyFlowElement;
  count: number;
  /** Milliseconds from assigning the nodes to the `render-complete` event of that revision. */
  ready: Promise<number>;
}

declare global {
  interface Window {
    __stress?: StressHandle;
  }
}

export const STRESS_SPACING = { x: 180, y: 80 };

/** The grid: `count` nodes and `count - 1` edges. */
export function stressData(count: number): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (STRESS_SPACING.y / STRESS_SPACING.x))));
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: String(i),
      position: { x: (i % cols) * STRESS_SPACING.x, y: Math.floor(i / cols) * STRESS_SPACING.y },
      data: { label: `Node ${i}` },
    });
    if (i > 0) {
      const from = i % cols !== 0 ? i - 1 : i - cols;
      edges.push({ id: `e${from}-${i}`, source: String(from), target: String(i) });
    }
  }
  return { nodes, edges };
}

export type StressOptions = {
  /** Render only the nodes and edges in the viewport. */
  onlyVisible?: boolean;
  /** Add the minimap (heavy with thousands of nodes). */
  minimap?: boolean;
};

/**
 * Create a full-page flow with the stress data. Nodes are assigned after the element is connected,
 * so `ready` measures the first render of the whole graph and nothing else.
 */
export function createStressFlow(count: number, o: StressOptions = {}): StressHandle {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  // the grid of a few thousand nodes must fit: the default minimum zoom of 0.5 would cut it off
  flow.setAttribute('min-zoom', '0.02');
  flow.setAttribute('fit-view', '');
  if (o.onlyVisible) flow.setAttribute('only-render-visible-elements', '');
  flow.append(document.createElement('xy-controls'));
  if (o.minimap) flow.append(document.createElement('xy-minimap'));
  const { nodes, edges } = stressData(count);

  const ready = new Promise<number>((resolve) => {
    flow.addEventListener('render-complete', () => resolve(performance.now() - t0), { once: true });
  });
  const handle: StressHandle = { flow, count, ready };
  window.__stress = handle;
  Object.assign(window, { flow });
  document.getElementById('app')?.replaceChildren(flow);
  const t0 = performance.now();
  flow.nodes = nodes;
  flow.edges = edges;
  return handle;
}
