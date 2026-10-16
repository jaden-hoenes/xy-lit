import { afterEach, describe, expect, it } from 'vitest';
import { uiEdgeTypes } from '../src/index.js';
import { cleanup, mountFlow, node, waitFor } from './helpers.js';

afterEach(cleanup);

const nodes = [node('a', 0, 0), node('b', 300, 120, { data: { label: 'b', weight: 42 } })];
const edgePath = (flow: Element & { renderRoot: ParentNode }, id: string) =>
  flow.renderRoot.querySelector<SVGPathElement>(`g[data-id="${id}"] path.lit-flow__edge-path`);

describe('buttonEdge', () => {
  it('draws a bezier path and a delete button at its label point that removes the edge', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [{ id: 'e', source: 'a', target: 'b', type: 'button' }],
      props: { edgeTypes: uiEdgeTypes },
    });
    await waitFor(() => edgePath(flow, 'e')?.getAttribute('d'));
    const button = await waitFor(() =>
      flow.renderRoot.querySelector<HTMLButtonElement>('.xy-ui-edge-button'),
    );
    expect(button.getAttribute('aria-label')).toBe('Delete edge');
    expect(button.classList.contains('nodrag')).toBe(true);
    expect(button.closest('.lit-flow__edge-label')?.getAttribute('data-edge-id')).toBe('e');
    // the button sits on the path's midpoint
    const path = edgePath(flow, 'e')!;
    const mid = path.getPointAtLength(path.getTotalLength() / 2);
    const m = path.getScreenCTM()!;
    const box = button.getBoundingClientRect();
    expect(box.left + box.width / 2).toBeCloseTo(m.a * mid.x + m.e, -1);
    expect(box.top + box.height / 2).toBeCloseTo(m.d * mid.y + m.f, -1);
    button.click();
    await waitFor(() => flow.getEdges().length === 0);
    expect(flow.renderRoot.querySelector('.xy-ui-edge-button')).toBeNull();
  });

  it('honours data.pathType', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        { id: 'bezier', source: 'a', target: 'b', type: 'button' },
        {
          id: 'straight',
          source: 'a',
          target: 'b',
          type: 'button',
          data: { pathType: 'straight' },
        },
      ],
      props: { edgeTypes: uiEdgeTypes },
    });
    const bezier = await waitFor(() => edgePath(flow, 'bezier')?.getAttribute('d'));
    const straight = await waitFor(() => edgePath(flow, 'straight')?.getAttribute('d'));
    expect(bezier).toContain('C');
    expect(straight).not.toContain('C');
  });
});

describe('dataEdge', () => {
  const label = (flow: Element & { renderRoot: ParentNode }) =>
    flow.renderRoot.querySelector<HTMLElement>('.xy-ui-data-edge');

  it('shows edge.data[key] as the label', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        {
          id: 'e',
          source: 'a',
          target: 'b',
          type: 'data',
          data: { key: 'rate', rate: '120 req/s' },
        },
      ],
      props: { edgeTypes: uiEdgeTypes },
    });
    const el = await waitFor(() => label(flow));
    expect(el.querySelector('.xy-ui-data-edge__key')?.textContent).toBe('rate');
    expect(el.querySelector('.xy-ui-data-edge__value')?.textContent).toBe('120 req/s');
  });

  it('falls back to the source node data, and shows nothing when the key is missing', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { data: { label: 'a', weight: 7 } }), node('b', 300, 120)],
      edges: [
        { id: 'e1', source: 'a', target: 'b', type: 'data', data: { key: 'weight' } },
        { id: 'e2', source: 'b', target: 'a', type: 'data', data: { key: 'missing' } },
      ],
      props: { edgeTypes: uiEdgeTypes },
    });
    const els = await waitFor(() => {
      const all = flow.renderRoot.querySelectorAll('.xy-ui-data-edge');
      return all.length ? all : undefined;
    });
    expect(els).toHaveLength(1);
    expect(els[0]?.textContent).toContain('7');
  });

  it('renders the value as text, never as HTML', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        {
          id: 'e',
          source: 'a',
          target: 'b',
          type: 'data',
          data: { key: 'v', v: '<img src=x onerror=alert(1)>' },
        },
      ],
      props: { edgeTypes: uiEdgeTypes },
    });
    const el = await waitFor(() => label(flow));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.xy-ui-data-edge__value')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});

describe('animatedSvgEdge', () => {
  it('has a circle with <animateMotion> along the edge path', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [{ id: 'e', source: 'a', target: 'b', type: 'animatedSvg', data: { duration: '3s' } }],
      props: { edgeTypes: uiEdgeTypes },
    });
    const d = await waitFor(() => edgePath(flow, 'e')?.getAttribute('d'));
    const motion = await waitFor(() =>
      flow.renderRoot.querySelector('g[data-id="e"] circle animateMotion'),
    );
    expect(motion.getAttribute('dur')).toBe('3s');
    expect(motion.getAttribute('repeatCount')).toBe('indefinite');
    expect(motion.getAttribute('path')).toBe(d);
    expect(motion.parentElement?.getAttribute('r')).toBe('4');
  });

  it('defaults to 2s and accepts a number of seconds', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        { id: 'a1', source: 'a', target: 'b', type: 'animatedSvg' },
        { id: 'a2', source: 'a', target: 'b', type: 'animatedSvg', data: { duration: 5 } },
      ],
      props: { edgeTypes: uiEdgeTypes },
    });
    const dur = (id: string) =>
      flow.renderRoot.querySelector(`g[data-id="${id}"] animateMotion`)?.getAttribute('dur');
    await waitFor(() => dur('a1') && dur('a2'));
    expect(dur('a1')).toBe('2s');
    expect(dur('a2')).toBe('5s');
  });
});
