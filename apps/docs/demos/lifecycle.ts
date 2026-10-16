// init, nodes-initialized and render-complete with real timings; the loading overlay and the
// entrance motion can be replayed.
import { html, render } from 'lit';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import { flowOf, logLine, type Mount } from './_shared';

function graph(count: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cols = Math.ceil(Math.sqrt(count * 1.8));
  for (let i = 0; i < count; i++) {
    nodes.push({ id: `n${i}`, position: { x: (i % cols) * 120, y: Math.floor(i / cols) * 60 }, data: { label: `n${i}` }, width: 90, height: 34 });
    if (i % cols) edges.push({ id: `e${i}`, source: `n${i - 1}`, target: `n${i}` });
  }
  return { nodes, edges };
}

export const mount: Mount = (el) => {
  let count = 24;
  let t0 = performance.now();
  let current: XyFlowElement;

  const draw = (): void => {
    const { nodes, edges } = graph(count);
    // a fresh <xy-flow> each time, so `init` and the first render happen again
    render(
      html`<div class="demo-bar">
          <button id="reload" type="button">Reload ${count} nodes</button>
          <button id="more" type="button">Double the nodes</button>
          <label><input type="checkbox" id="loading" /> <code>loading</code> overlay</label>
          <label><input type="checkbox" id="motion" checked /> <code>motion="enter"</code></label>
        </div>
        <div class="demo-body">
          <xy-flow
            .nodes=${nodes}
            .edges=${edges}
            motion="enter"
            fit-view
            prevent-scrolling="false"
            zoom-on-scroll="false"
          >
            <xy-background></xy-background>
          </xy-flow>
          <div class="demo-log" id="log" aria-label="Lifecycle log"></div>
        </div>`,
      el,
    );
    current = flowOf(el);
    t0 = performance.now();
    const log = el.querySelector<HTMLElement>('#log')!;
    const at = (): string => `+${Math.round(performance.now() - t0)} ms`;
    for (const name of ['init', 'nodes-initialized', 'render-complete'] as const) {
      current.addEventListener(name, (e) => {
        const d = (e as CustomEvent).detail as Record<string, unknown>;
        const extra =
          name === 'render-complete'
            ? `${d.nodeCount} nodes, ${d.edgeCount} edges, flow measured ${Math.round(Number(d.durationMs))} ms`
            : name === 'nodes-initialized'
              ? `${(d.nodes as unknown[]).length} nodes measured`
              : '';
        logLine(log, name, `${at()} ${extra}`);
      });
    }
    el.querySelector('#reload')!.addEventListener('click', draw);
    el.querySelector('#more')!.addEventListener('click', () => {
      count = Math.min(count * 2, 1600);
      draw();
    });
    el.querySelector('#loading')!.addEventListener('change', (e) => {
      current.loading = (e.target as HTMLInputElement).checked;
    });
    el.querySelector('#motion')!.addEventListener('change', (e) => {
      current.motion = (e.target as HTMLInputElement).checked ? 'enter' : 'off';
    });
  };
  draw();
  return () => render(null, el);
};
