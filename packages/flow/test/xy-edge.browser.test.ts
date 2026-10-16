import { html, svg } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkerType, Position, getBezierPath } from '@xy-lit/store';
import type { Edge } from '@xy-lit/store';
import { baseEdge } from '../src/edges/base-edge.js';
import { defineEdgeType } from '../src/edges/define-edge-type.js';
import { edgeLabel, edgeText } from '../src/edges/edge-text.js';
import { getSimpleBezierPath } from '../src/edges/simple-bezier.js';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, edge, frames, mountFlow, node, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nodes = [node('a'), node('b', 300, 150)];
const gEl = (flow: XyFlowElement, id: string): SVGGElement =>
  flow.renderRoot.querySelector(`.lit-flow__edge[data-id="${id}"]`) as SVGGElement;
const labels = (flow: XyFlowElement): HTMLElement[] => [
  ...flow.renderRoot.querySelectorAll<HTMLElement>(
    '.lit-flow__edgelabel-renderer .lit-flow__edge-label',
  ),
];

describe('<xy-edge> structure', () => {
  it('renders an svg wrapper with a g that carries the data-id', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { zIndex: 7, class: 'extra' })],
    });
    const g = gEl(flow, 'e1');
    expect(g.getAttribute('class')).toBe('lit-flow__edge extra selectable');
    expect(g.getAttribute('part')).toBe('edge');
    expect(g.getAttribute('role')).toBe('group');
    expect(g.getAttribute('aria-roledescription')).toBe('edge');
    expect(g.getAttribute('aria-label')).toBe('Edge from a to b');
    expect(g.getAttribute('aria-describedby')).toBe('lit-flow__edge-desc-1');
    expect(g.getAttribute('tabindex')).toBe('0');
    const svgEl = g.parentElement as unknown as SVGElement;
    expect(svgEl.getAttribute('class')).toBe('lit-flow__edge-wrapper');
    expect((svgEl as unknown as HTMLElement).style.zIndex).toBe('7');
    // the host carries no data-id: [data-id] matches exactly one element
    expect(flow.renderRoot.querySelectorAll('[data-id="e1"]')).toHaveLength(1);
    const host = flow.renderRoot.querySelector('xy-edge') as HTMLElement;
    expect(host.hasAttribute('data-id')).toBe(false);
    expect(getComputedStyle(host).display).toBe('contents');
    expect(host.shadowRoot).toBeNull();
    // the visible path and the interaction path
    expect(g.querySelectorAll('path.lit-flow__edge-path')).toHaveLength(1);
    expect(g.querySelector('path.lit-flow__edge-interaction')?.getAttribute('stroke-width')).toBe(
      '20',
    );
  });

  it('reflects animated, selected and non-selectable states', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        edge('e1', 'a', 'b', { animated: true, selected: true }),
        edge('e2', 'a', 'b', {
          selectable: false,
          focusable: false,
          ariaLabel: null as never,
          ariaRole: 'presentation',
        }),
      ],
    });
    expect(gEl(flow, 'e1').classList.contains('animated')).toBe(true);
    expect(gEl(flow, 'e1').classList.contains('selected')).toBe(true);
    const e2 = gEl(flow, 'e2');
    expect(e2.classList.contains('inactive')).toBe(true);
    expect(e2.classList.contains('selectable')).toBe(false);
    expect(e2.hasAttribute('tabindex')).toBe(false);
    expect(e2.hasAttribute('aria-label')).toBe(false);
    expect(e2.getAttribute('role')).toBe('presentation');
  });

  it('applies domAttributes to the g and removes them again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { domAttributes: { 'data-foo': 'x', onclick: 'bad' } })],
    });
    expect(gEl(flow, 'e1').getAttribute('data-foo')).toBe('x');
    expect(gEl(flow, 'e1').hasAttribute('onclick')).toBe(false);
    expect(warn).toHaveBeenCalled();
    flow.updateEdge('e1', { domAttributes: {} });
    await waitFor(() => !gEl(flow, 'e1').hasAttribute('data-foo'));
  });

  it('selects on click, emits edge-click, and keyboard selects/escapes', async () => {
    const flow = await mountFlow({ nodes, edges: [edge('e1', 'a', 'b')] });
    const clicks: string[] = [];
    flow.addEventListener('edge-click', (e) => {
      clicks.push(e.detail.edge.id);
    });
    await frames(1);
    const g = gEl(flow, 'e1');
    g.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(clicks).toEqual(['e1']);
    expect(flow.getEdge('e1')?.selected).toBe(true);
    await waitFor(() => gEl(flow, 'e1').classList.contains('selected'));
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(flow.getEdge('e1')?.selected).toBeFalsy();
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(flow.getEdge('e1')?.selected).toBe(true);
  });

  it('the arrowhead tip sits on the outer edge of the target handle, as in React Flow', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0, { sourcePosition: Position.Right, targetPosition: Position.Left }),
        node('b', 300, 0, { sourcePosition: Position.Right, targetPosition: Position.Left }),
      ],
      edges: [edge('e1', 'a', 'b', { markerEnd: { type: MarkerType.ArrowClosed } })],
    });
    await frames(2);
    const path = gEl(flow, 'e1').querySelector<SVGPathElement>('path.lit-flow__edge-path')!;
    const end = path.getPointAtLength(path.getTotalLength());
    const ctm = path.getScreenCTM()!;
    const screen = { x: end.x * ctm.a + ctm.e, y: end.y * ctm.d + ctm.f };
    const handle = flow.renderRoot
      .querySelector('xy-node[data-id="b"] .lit-flow__handle.target')!
      .getBoundingClientRect();
    // the edge ends on the outer (left) edge of the handle box, which includes its border
    expect(screen.x).toBeCloseTo(handle.left, 0);
    expect(screen.y).toBeCloseTo(handle.top + handle.height / 2, 0);
    // the marker is anchored at its tip (React: refX = refY = 0, viewBox -10 -10 20 20)
    const marker = flow.renderRoot.querySelector('marker.lit-flow__arrowhead')!;
    expect(marker.getAttribute('refX')).toBe('0');
    expect(marker.getAttribute('refY')).toBe('0');
    expect(marker.getAttribute('viewBox')).toBe('-10 -10 20 20');
    expect(marker.getAttribute('orient')).toBe('auto-start-reverse');
  });

  it('Escape on a focused edge unselects every node and that edge (React parity)', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { selected: true }), node('b', 300, 150, { selected: true })],
      edges: [edge('e1', 'a', 'b', { selected: true }), edge('e2', 'a', 'b', { selected: true })],
    });
    await frames(1);
    gEl(flow, 'e1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    expect(flow.getNode('a')?.selected).toBeFalsy();
    expect(flow.getNode('b')?.selected).toBeFalsy();
    expect(flow.getEdge('e1')?.selected).toBeFalsy();
    // React only passes the focused edge, so another selected edge stays selected
    expect(flow.getEdge('e2')?.selected).toBe(true);
  });

  it('is removed with its labels and does not render when an endpoint is missing', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { label: 'hello' }), edge('e2', 'a', 'missing')],
    });
    expect(flow.renderRoot.querySelectorAll('.lit-flow__edge')).toHaveLength(1);
    expect(labels(flow).map((l) => l.textContent)).toEqual(['hello']);
    flow.setEdges([]);
    await waitFor(() => !flow.renderRoot.querySelector('.lit-flow__edge'));
    await waitFor(() => labels(flow).length === 0);
  });

  it('falls back to the default type and reports 011 once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:600px;height:400px';
    const codes: string[] = [];
    flow.addEventListener('flow-error', (e) => {
      codes.push(e.detail.code);
    });
    flow.nodes = nodes;
    flow.edges = [edge('e1', 'a', 'b', { type: 'nope' })];
    document.body.append(flow);
    try {
      await flow.whenRendered();
      expect(codes.filter((c) => c === '011')).toHaveLength(1);
      expect(gEl(flow, 'e1').querySelector('.lit-flow__edge-path')).not.toBeNull();
    } finally {
      flow.remove();
    }
  });
});

describe('markers', () => {
  it('uses exact marker urls and renders the defs', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [
        edge('e1', 'a', 'b', {
          markerEnd: { type: MarkerType.ArrowClosed },
          markerStart: { type: MarkerType.Arrow, color: '#f00' },
        }),
      ],
    });
    const path = gEl(flow, 'e1').querySelector('.lit-flow__edge-path') as SVGPathElement;
    expect(path.getAttribute('marker-end')).toBe("url('#1__type=arrowclosed')");
    expect(path.getAttribute('marker-start')).toMatch(/^url\('#1__.*type=arrow/);
    const markers = [...flow.renderRoot.querySelectorAll('marker')];
    expect(markers).toHaveLength(2);
    expect(markers.every((m) => m.classList.contains('lit-flow__arrowhead'))).toBe(true);
    expect(flow.renderRoot.querySelector('marker polyline.arrowclosed')).not.toBeNull();
    // the marker referenced by the edge exists in the same tree
    expect(flow.renderRoot.querySelector('[id="1__type=arrowclosed"]')).not.toBeNull();
  });

  it('two flows can use the same marker id', async () => {
    const mk = () => [edge('e1', 'a', 'b', { markerEnd: { type: MarkerType.ArrowClosed } })];
    const one = await mountFlow({ nodes, edges: mk() });
    const two = await mountFlow({ nodes, edges: mk() });
    expect(one.renderRoot.querySelector('[id="1__type=arrowclosed"]')).not.toBeNull();
    expect(two.renderRoot.querySelector('[id="1__type=arrowclosed"]')).not.toBeNull();
  });

  it('renders custom markers once per distinct spec', async () => {
    const custom = {
      type: 'custom' as const,
      path: 'M-5,-5 L5,0 L-5,5 Z',
      color: '#0a0',
      fill: 'stroke',
    };
    const flow = await mountFlow({
      nodes: [...nodes, node('c', 0, 300)],
      edges: [
        edge('e1', 'a', 'b', { markerEnd: custom }),
        edge('e2', 'a', 'c', { markerEnd: { ...custom } }),
      ],
    });
    const markers = [...flow.renderRoot.querySelectorAll('marker')];
    expect(markers).toHaveLength(1);
    expect(markers[0]?.querySelector('path')?.getAttribute('d')).toBe(custom.path);
    const url = gEl(flow, 'e1').querySelector('.lit-flow__edge-path')?.getAttribute('marker-end');
    expect(url).toBe(`url('#${markers[0]?.id}')`);
  });
});

describe('labels', () => {
  it('renders center, start and end labels in the label layer as text', async () => {
    const xss = '<img src=x onerror=window.__pwned=1>';
    const flow = await mountFlow({
      nodes,
      edges: [
        edge('e1', 'a', 'b', {
          label: xss,
          startLabel: 'S',
          endLabel: 'E',
          labelStyle: 'color: red;',
        }),
      ],
    });
    const list = labels(flow);
    expect(list.map((l) => l.textContent).sort()).toEqual([xss, 'E', 'S'].sort());
    expect(flow.renderRoot.querySelector('.lit-flow__edgelabel-renderer img')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    const center = list.find((l) => l.textContent === xss)!;
    expect(center.style.color).toBe('red');
    expect(center.getAttribute('data-edge-id')).toBe('e1');
    expect(center.classList.contains('nopan')).toBe(true);
    expect(center.style.transform.replace(/\s/g, '')).toContain('translate(-50%,-50%)');
    // labels are in flow coordinates: inside the viewport, outside the edge svg
    expect(center.closest('.lit-flow__viewport')).not.toBeNull();
    expect(center.closest('svg')).toBeNull();
  });

  it('puts start and end labels next to their ends', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { startLabel: 'S', endLabel: 'E' })],
    });
    const e = flow.store.getLayoutedEdges().get('e1')!;
    const pos = (text: string) => {
      const l = labels(flow).find((x) => x.textContent === text)!;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)$/.exec(l.style.transform)!;
      return { x: Number(m[1]), y: Number(m[2]) };
    };
    const s = pos('S');
    const t = pos('E');
    expect(Math.hypot(s.x - e.sourceX, s.y - e.sourceY)).toBeLessThan(40);
    expect(Math.hypot(t.x - e.targetX, t.y - e.targetY)).toBeLessThan(40);
    expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeGreaterThan(100);
  });

  it('clicking a text label selects the edge', async () => {
    const flow = await mountFlow({ nodes, edges: [edge('e1', 'a', 'b', { label: 'x' })] });
    labels(flow)[0]!.click();
    expect(flow.getEdge('e1')?.selected).toBe(true);
  });

  it('updates and removes a label when the edge changes', async () => {
    const flow = await mountFlow({ nodes, edges: [edge('e1', 'a', 'b', { label: 'one' })] });
    flow.updateEdge('e1', { label: 'two' });
    await waitFor(() => labels(flow)[0]?.textContent === 'two');
    flow.updateEdge('e1', { label: undefined });
    await waitFor(() => labels(flow).length === 0);
  });
});

describe('edge types', () => {
  it('renders every built-in type with a path', async () => {
    const types = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'];
    const flow = await mountFlow({
      nodes,
      edges: types.map((type) => edge(`e-${type}`, 'a', 'b', { type })),
    });
    const d = (type: string) =>
      gEl(flow, `e-${type}`).querySelector('.lit-flow__edge-path')?.getAttribute('d') ?? '';
    for (const type of types) expect(d(type)).toMatch(/^M/);
    expect(d('default')).toContain('C');
    expect(d('simplebezier')).toContain('C');
    expect(d('straight')).not.toContain('C');
    // step is smoothstep with a border radius of 0
    expect(d('step')).not.toBe(d('smoothstep'));
    expect(d('step')).toContain('L');
  });

  it('renders a custom type with a label and its styles', async () => {
    const { css } = await import('lit');
    const buttonEdge = defineEdgeType({
      styles: css`
        .my-edge-btn {
          outline: 2px solid rgb(4, 5, 6);
        }
      `,
      render: (p, flow) => {
        const [path, x, y] = getBezierPath(p);
        return {
          path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style }),
          label: edgeLabel(
            flow,
            { edgeId: p.id, x, y },
            html`<button class="my-edge-btn nodrag nopan">x</button>`,
          ),
        };
      },
    });
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { type: 'button' })],
      props: { edgeTypes: { button: buttonEdge } },
    });
    const btn = flow.renderRoot.querySelector('.my-edge-btn') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(getComputedStyle(btn).outlineWidth).toBe('2px');
    expect(gEl(flow, 'e1').querySelector('path[id="e1"]')).not.toBeNull();
  });

  it('baseEdge omits the interaction path with width 0', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { type: 'thin', interactionWidth: 0 })],
      props: {
        edgeTypes: {
          thin: defineEdgeType({
            render: (p) => ({
              path: baseEdge({ path: 'M0,0 L10,10', interactionWidth: p.interactionWidth }),
            }),
          }),
        },
      },
    });
    expect(gEl(flow, 'e1').querySelector('.lit-flow__edge-interaction')).toBeNull();
    void svg;
  });

  it('edgeText renders text positioned at the given point', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e1', 'a', 'b', { type: 't' })],
      props: {
        edgeTypes: {
          t: defineEdgeType<Edge>({
            render: (p, f) => ({
              path: baseEdge({ path: 'M0,0 L10,10' }),
              label: edgeText(f, p, 'at 10,20', { x: 10, y: 20 }),
            }),
          }),
        },
      },
    });
    const l = labels(flow)[0]!;
    expect(l.textContent).toBe('at 10,20');
    expect(l.style.transform).toBe('translate(-50%, -50%) translate(10px, 20px)');
    expect(l.style.cursor).toBe('pointer');
  });
});

describe('getSimpleBezierPath', () => {
  it('uses horizontal controls for left/right and vertical for top/bottom', () => {
    const [h] = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 50,
      targetPosition: Position.Left,
    });
    expect(h).toBe('M0,0 C50,0 50,50 100,50');
    const [v, lx, ly] = getSimpleBezierPath({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 50 });
    expect(v).toBe('M0,0 C0,25 100,25 100,50');
    expect([lx, ly]).toEqual([50, 25]);
  });
});

describe('parallel edges', () => {
  const pathOf = (flow: XyFlowElement, id: string): string =>
    gEl(flow, id).querySelector('.lit-flow__edge-path')?.getAttribute('d') ?? '';
  const sideHandles = { sourcePosition: Position.Right, targetPosition: Position.Left };
  const pair = [node('a', 0, 0, sideHandles), node('b', 300, 150, sideHandles)];

  it('off (default): identical paths for edges between the same handles', async () => {
    const flow = await mountFlow({
      nodes: pair,
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
    });
    expect(pathOf(flow, 'e1')).toBe(pathOf(flow, 'e2'));
  });

  for (const type of ['default', 'straight', 'step', 'smoothstep'] as const) {
    it(`spread: ${type} edges get distinct paths for 2 and 3 edges`, async () => {
      const edges = [
        edge('e1', 'a', 'b', { type }),
        edge('e2', 'a', 'b', { type }),
        edge('e3', 'a', 'b', { type }),
      ];
      const flow = await mountFlow({
        nodes: pair,
        edges: edges.slice(0, 2),
        attributes: { 'parallel-edges': 'spread' },
      });
      expect(new Set([pathOf(flow, 'e1'), pathOf(flow, 'e2')]).size).toBe(2);
      flow.edges = edges;
      await waitFor(() => gEl(flow, 'e3'));
      expect(new Set(['e1', 'e2', 'e3'].map((id) => pathOf(flow, id))).size).toBe(3);
    });
  }

  it('spread: opposite directions keep distinct lanes', async () => {
    const flow = await mountFlow({
      nodes: pair,
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
      attributes: { 'parallel-edges': 'spread' },
    });
    expect(pathOf(flow, 'e1')).not.toBe(pathOf(flow, 'e2'));
  });

  it('bezier offset moves the label sideways by about the offset', async () => {
    const flow = await mountFlow({
      nodes: pair,
      edges: [edge('e1', 'a', 'b', { label: 'x' }), edge('e2', 'a', 'b', { label: 'y' })],
      attributes: { 'parallel-edges': 'spread', 'parallel-edge-gap': '20' },
    });
    const at = (text: string): number => {
      const el = labels(flow).find((l) => l.textContent === text)!;
      return el.getBoundingClientRect().top;
    };
    // two lanes at -10 and +10 around the unshifted label: a gap of about 1.125 * 20 = 22.5 px
    expect(Math.abs(at('x') - at('y'))).toBeGreaterThan(15);
    expect(Math.abs(at('x') - at('y'))).toBeLessThan(35);
  });

  it('an explicit edge.offset wins and a single edge is unchanged', async () => {
    const single = await mountFlow({
      nodes: pair,
      edges: [edge('e1', 'a', 'b')],
      attributes: { 'parallel-edges': 'spread' },
    });
    const plain = await mountFlow({ nodes: pair, edges: [edge('e1', 'a', 'b')] });
    expect(pathOf(single, 'e1')).toBe(pathOf(plain, 'e1'));
    const shifted = await mountFlow({ nodes: pair, edges: [edge('e1', 'a', 'b', { offset: 30 })] });
    expect(pathOf(shifted, 'e1')).not.toBe(pathOf(plain, 'e1'));
  });
});

describe('custom markers', () => {
  it('draw fill and stroke from the spec and fall back to the default marker colour', async () => {
    const flow = await mountFlow({
      nodes: [...nodes, node('c', 0, 300)],
      edges: [
        edge('e1', 'a', 'b', {
          markerEnd: {
            type: 'custom',
            path: 'M-4,-4 L4,0 L-4,4 Z',
            color: '#f00',
            fill: 'none',
            strokeWidth: 2,
          },
        }),
        edge('e2', 'a', 'c', {
          markerStart: {
            type: 'custom',
            path: 'M-4,-4 L4,0 L-4,4 Z',
            fill: '#00f',
            width: 20,
            height: 10,
          },
        }),
      ],
      props: { defaultMarkerColor: '#123456' },
    });
    const markers = [...flow.renderRoot.querySelectorAll('marker')];
    expect(markers).toHaveLength(2);
    const byColor = (c: string) =>
      markers.find((m) => m.querySelector('path')?.getAttribute('style')?.includes(c));
    const red = byColor('#f00')!;
    expect(red.querySelector('path')?.getAttribute('style')).toContain('fill:none');
    expect(red.querySelector('path')?.getAttribute('stroke-width')).toBe('2');
    const blue = markers.find((m) => m !== red)!;
    expect(blue.querySelector('path')?.getAttribute('style')).toContain('fill:#00f');
    expect(blue.getAttribute('markerWidth')).toBe('20');
    expect(blue.querySelector('path')?.getAttribute('style')).toContain('stroke:#123456');
    // a hostile path string stays inside the attribute
    const hostile = await mountFlow({
      nodes,
      edges: [
        edge('h', 'a', 'b', {
          markerEnd: { type: 'custom', path: 'M0,0"/><script>window.__pwned=1</script>' },
        }),
      ],
    });
    expect(hostile.renderRoot.querySelector('marker script')).toBeNull();
  });
});
