// Performance on your machine: render time and frame times while panning, with and without
// culling. The numbers in the guide come from the repository's perf suite; this is a live probe.
import { html, render } from 'lit';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import { flowOf, type Mount } from './_shared';

function grid(count: number): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(count));
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({ id: `n${i}`, position: { x: (i % cols) * 180, y: Math.floor(i / cols) * 70 }, data: { label: `Node ${i}` } });
    if (i > 0) edges.push({ id: `e${i}`, source: `n${i - 1}`, target: `n${i}` });
  }
  return { nodes, edges };
}

export const mount: Mount = (el) => {
  let count = 500;
  let culling = true;
  let flow: XyFlowElement;
  let busy = false;

  const draw = async (): Promise<void> => {
    const { nodes, edges } = grid(count);
    render(
      html`<div class="demo-bar">
          <label>nodes
            <select id="count">
              ${[100, 500, 1000, 2000, 5000].map((n) => html`<option ?selected=${n === count}>${n}</option>`)}
            </select>
          </label>
          <label><input type="checkbox" id="cull" ?checked=${culling} /> <code>only-render-visible-elements</code></label>
          <button type="button" id="run">Measure pan (2 s)</button>
          <span class="spacer"></span>
          <span id="out" aria-live="polite">loading…</span>
        </div>
        <xy-flow
          .nodes=${nodes}
          .edges=${edges}
          ?only-render-visible-elements=${culling}
          min-zoom="0.02"
          .defaultViewport=${{ x: 20, y: 20, zoom: 0.9 }}
          hide-attribution
          prevent-scrolling="false"
          zoom-on-scroll="false"
        >
          <xy-background></xy-background>
        </xy-flow>`,
      el,
    );
    flow = flowOf(el);
    const out = el.querySelector<HTMLElement>('#out')!;
    const t0 = performance.now();
    const done = await flow.whenRendered();
    out.textContent = `${count} nodes rendered ${Math.round(performance.now() - t0)} ms after assignment (flow: ${Math.round(done.durationMs)} ms)`;
    el.querySelector('#count')!.addEventListener('change', (e) => {
      count = Number((e.target as HTMLSelectElement).value);
      void draw();
    });
    el.querySelector('#cull')!.addEventListener('change', (e) => {
      culling = (e.target as HTMLInputElement).checked;
      void draw();
    });
    el.querySelector('#run')!.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      out.textContent = 'measuring…';
      // pan at the zoom the user sees, like tests/perf does for the windowed variant
      const start = flow.getViewport();
      const deltas: number[] = [];
      let last = performance.now();
      const begin = last;
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          deltas.push(now - last);
          last = now;
          const t = (now - begin) / 2000;
          flow.setViewport({ x: start.x - t * 600, y: start.y - t * 200, zoom: start.zoom });
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await flow.setViewport(start);
      deltas.shift();
      const sorted = [...deltas].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
      out.textContent = `pan: p95 frame ${p95.toFixed(1)} ms, mean ${mean.toFixed(1)} ms (${(1000 / mean).toFixed(0)} fps) with ${count} nodes${culling ? ', culled' : ''}`;
      busy = false;
    });
  };
  void draw();
  return () => render(null, el);
};
