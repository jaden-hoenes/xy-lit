import { html, svg } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChangeMeta, NodeChange } from '@xy-lit/store';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
import { baseEdge } from '../src/edges/base-edge.js';
import { defineEdgeType } from '../src/edges/define-edge-type.js';
import { edgeToolbar } from '../src/edges/edge-toolbar.js';
import type { XyBackgroundElement } from '../src/plugins/xy-background.js';
import type { XyControlsElement } from '../src/plugins/xy-controls.js';
import type { XyMinimapElement } from '../src/plugins/xy-minimap.js';
import {
  cleanup,
  centerOf,
  dragMouse,
  edge,
  frames,
  mountFlow,
  node,
  nodeEl,
  waitFor,
} from './helpers.js';

afterEach(cleanup);

/** Append plugins to a flow and wait until each has rendered. */
async function withPlugins<T extends HTMLElement>(flow: XyFlowElement, ...els: T[]): Promise<T[]> {
  flow.append(...els);
  await Promise.all(
    els.map((el) => (el as unknown as { updateComplete: Promise<unknown> }).updateComplete),
  );
  await frames(2);
  return els;
}

const inPlugin = <T extends Element>(el: Element, selector: string): T =>
  el.shadowRoot?.querySelector(selector) as T;

describe('<xy-panel> and attribution', () => {
  it('maps position to classes and projects its content', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const panel = document.createElement('xy-panel');
    panel.textContent = 'hello';
    await withPlugins(flow, panel);
    const div = inPlugin<HTMLElement>(panel, '.lit-flow__panel');
    expect([...div.classList].sort()).toEqual(['lit-flow__panel', 'right', 'top']);
    expect(div.getAttribute('part')).toBe('panel');
    panel.position = 'bottom-center';
    await panel.updateComplete;
    expect([...div.classList].sort()).toEqual(['bottom', 'center', 'lit-flow__panel']);
    // the panel host takes no box and the panel sits in the flow's corner
    expect(getComputedStyle(panel).display).toBe('contents');
    const slot = inPlugin<HTMLSlotElement>(panel, 'slot');
    expect(slot.assignedNodes().map((n) => n.textContent)).toEqual(['hello']);
    const flowBox = flow.getBoundingClientRect();
    const box = div.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(flowBox.bottom);
    expect(box.top).toBeGreaterThan(flowBox.top + flowBox.height / 2);
  });

  it('renders the attribution unless hidden, at attribution-position', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const link = flow.renderRoot.querySelector<HTMLAnchorElement>('.lit-flow__attribution a');
    expect(link?.textContent).toBe('XY Lit · xyflow');
    expect(link?.href).toBe('https://xyflow.com/');
    expect(link?.rel).toContain('noopener');
    flow.attributionPosition = 'top-left';
    await flow.updateComplete;
    expect(flow.renderRoot.querySelector('.lit-flow__attribution')?.className).toContain(
      'top left',
    );
    flow.hideAttribution = true;
    await flow.updateComplete;
    expect(flow.renderRoot.querySelector('.lit-flow__attribution')).toBeNull();
  });

  it('renders nothing outside a flow', async () => {
    const panel = document.createElement('xy-panel');
    document.body.append(panel);
    await panel.updateComplete;
    expect(panel.shadowRoot?.querySelector('.lit-flow__panel')).toBeNull();
    panel.remove();
  });
});

describe('<xy-background>', () => {
  const patternOf = (bg: Element): SVGPatternElement => inPlugin(bg, 'pattern');

  it('uses React maths for default dots and for gap + offset', async () => {
    const flow = await mountFlow({ nodes: [node('a')], attributes: { id: 'f' } });
    const dots = document.createElement('xy-background') as XyBackgroundElement;
    const lines = document.createElement('xy-background') as XyBackgroundElement;
    lines.setAttribute('bg-id', '1');
    lines.setAttribute('variant', 'lines');
    lines.setAttribute('gap', '100');
    lines.setAttribute('offset', '2');
    await withPlugins(flow, dots, lines);
    expect(patternOf(dots).id).toBe('pattern-f');
    expect(patternOf(dots).getAttribute('patternTransform')).toBe('translate(-10,-10)');
    expect(patternOf(lines).id).toBe('pattern-f1');
    expect(patternOf(lines).getAttribute('patternTransform')).toBe('translate(-52,-52)');
    // dots: radius = size / 2
    expect(inPlugin(dots, 'circle').getAttribute('r')).toBe('0.5');
  });

  it('cross uses a size of 6 and its own cell; lines draw a path', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const cross = document.createElement('xy-background') as XyBackgroundElement;
    cross.setAttribute('variant', 'cross');
    cross.setAttribute('gap', '40 20');
    const lines = document.createElement('xy-background') as XyBackgroundElement;
    lines.setAttribute('variant', 'lines');
    lines.setAttribute('bg-id', 'l');
    lines.setAttribute('line-width', '3');
    await withPlugins(flow, cross, lines);
    // cross: the cell (and so the centring) is the arm size 6
    expect(patternOf(cross).getAttribute('patternTransform')).toBe('translate(-3,-3)');
    expect(patternOf(cross).getAttribute('width')).toBe('40');
    expect(patternOf(cross).getAttribute('height')).toBe('20');
    const path = inPlugin<SVGPathElement>(lines, 'path.lit-flow__background-pattern');
    expect(path.getAttribute('d')).toBe('M10 0 V20 M0 10 H20');
    expect(path.getAttribute('stroke-width')).toBe('3');
    expect(path.getAttribute('class')).toContain('lines');
  });

  it('follows pan and zoom, and takes colours as custom properties', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const bg = document.createElement('xy-background') as XyBackgroundElement;
    bg.setAttribute('color', '#f00');
    bg.setAttribute('bg-color', '#00f');
    await withPlugins(flow, bg);
    await flow.setViewport({ x: 45, y: 30, zoom: 2 });
    await waitFor(() => patternOf(bg).getAttribute('width') === '40');
    expect(patternOf(bg).getAttribute('x')).toBe('5');
    expect(patternOf(bg).getAttribute('y')).toBe('30');
    const svgEl = inPlugin<SVGElement>(bg, 'svg');
    expect(svgEl.style.getPropertyValue('--xy-background-pattern-color-props')).toBe('#f00');
    expect(svgEl.style.getPropertyValue('--xy-background-color-props')).toBe('#00f');
  });
});

describe('<xy-controls>', () => {
  const button = (c: Element, name: string): HTMLButtonElement =>
    inPlugin(c, `.lit-flow__controls-${name}`);

  it('zooms, fits and disables the zoom buttons at the extents', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0), node('b', 300, 200)],
      props: { minZoom: 0.5, maxZoom: 2 },
    });
    const controls = document.createElement('xy-controls') as XyControlsElement;
    const events: string[] = [];
    for (const type of ['zoom-in', 'zoom-out', 'fit-view', 'interactive-change']) {
      controls.addEventListener(type, () => events.push(type));
    }
    await withPlugins(flow, controls);
    const panel = inPlugin<HTMLElement>(controls, '.lit-flow__controls');
    expect(panel.getAttribute('data-testid')).toBe('rf__controls');
    expect(panel.getAttribute('aria-label')).toBe('Control Panel');
    expect(panel.classList.contains('vertical')).toBe(true);
    expect(panel.classList.contains('bottom')).toBe(true);

    button(controls, 'zoomin').click();
    await waitFor(() => flow.getZoom() > 1.1);
    await flow.setViewport({ x: 0, y: 0, zoom: 2 });
    await waitFor(() => button(controls, 'zoomin').disabled);
    expect(button(controls, 'zoomout').disabled).toBe(false);
    await flow.setViewport({ x: 0, y: 0, zoom: 0.5 });
    await waitFor(() => button(controls, 'zoomout').disabled);
    expect(button(controls, 'zoomin').disabled).toBe(false);

    button(controls, 'fitview').click();
    await waitFor(() => flow.getZoom() > 0.9);
    expect(events).toContain('zoom-in');
    expect(events).toContain('fit-view');
    expect(button(controls, 'zoomout').title).toBe('Zoom Out');
  });

  it('lock toggles the interactivity options and reflects them on the flow element', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const controls = document.createElement('xy-controls') as XyControlsElement;
    const details: unknown[] = [];
    controls.addEventListener('interactive-change', (e) => details.push((e as CustomEvent).detail));
    await withPlugins(flow, controls);
    button(controls, 'interactive').click();
    await waitFor(() => !flow.store.getState().nodesDraggable);
    expect(flow.nodesDraggable).toBe(false);
    expect(flow.nodesConnectable).toBe(false);
    expect(flow.elementsSelectable).toBe(false);
    expect(flow.store.getState().elementsSelectable).toBe(false);
    button(controls, 'interactive').click();
    await waitFor(() => flow.store.getState().nodesDraggable);
    expect(flow.elementsSelectable).toBe(true);
    expect(details).toEqual([{ interactive: false }, { interactive: true }]);
  });

  it('show-* attributes hide buttons; orientation and slots work', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const controls = document.createElement('xy-controls') as XyControlsElement;
    controls.setAttribute('show-zoom', 'false');
    controls.setAttribute('show-interactive', 'false');
    controls.setAttribute('orientation', 'horizontal');
    const custom = document.createElement('xy-control-button');
    custom.textContent = 'x';
    controls.append(custom);
    await withPlugins(flow, controls);
    expect(button(controls, 'zoomin')).toBeNull();
    expect(button(controls, 'interactive')).toBeNull();
    expect(button(controls, 'fitview')).not.toBeNull();
    expect(inPlugin(controls, '.lit-flow__controls').classList.contains('horizontal')).toBe(true);
    await (custom as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const inner = inPlugin<HTMLButtonElement>(custom, 'button.lit-flow__controls-button');
    expect(inner.getAttribute('part')).toBe('button');
    expect(
      controls.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])')?.assignedElements(),
    ).toEqual([custom]);
  });

  it('<xy-control-button> forwards aria-label and title to its inner button', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const controls = document.createElement('xy-controls') as XyControlsElement;
    const custom = document.createElement('xy-control-button');
    custom.setAttribute('aria-label', 'Star it');
    custom.setAttribute('title', 'Star tooltip');
    controls.append(custom);
    await withPlugins(flow, controls);
    await (custom as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const inner = inPlugin<HTMLButtonElement>(custom, 'button.lit-flow__controls-button');
    expect(inner.getAttribute('aria-label')).toBe('Star it');
    expect(inner.getAttribute('title')).toBe('Star tooltip');
    custom.setAttribute('aria-label', 'Renamed');
    await (custom as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(inner.getAttribute('aria-label')).toBe('Renamed');
    custom.removeAttribute('title');
    await (custom as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(inner.hasAttribute('title')).toBe(false);
  });
});

describe('<xy-minimap>', () => {
  const nodes = [
    node('a', 0, 0, { width: 100, height: 50 }),
    node('b', 300, 200, { width: 100, height: 50 }),
  ];

  it('computes the view box from the node bounds and the viewport', async () => {
    const flow = await mountFlow({ nodes, width: 800, height: 500 });
    const minimap = document.createElement('xy-minimap') as XyMinimapElement;
    await withPlugins(flow, minimap);
    const svgEl = inPlugin<SVGSVGElement>(minimap, 'svg.lit-flow__minimap-svg');
    expect(svgEl.getAttribute('width')).toBe('200');
    expect(svgEl.getAttribute('height')).toBe('150');
    // viewBB = (0,0,800,500); node bounds (0,0)-(400,250) -> union (0,0,800,500)
    const viewScale = Math.max(800 / 200, 500 / 150);
    const offset = 5 * viewScale;
    const vw = viewScale * 200;
    const vh = viewScale * 150;
    const x = 0 - (vw - 800) / 2 - offset;
    const y = 0 - (vh - 500) / 2 - offset;
    const expected = [x, y, vw + offset * 2, vh + offset * 2];
    const actual = svgEl.getAttribute('viewBox')!.split(' ').map(Number);
    actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 5));
    expect(svgEl.querySelectorAll('rect.lit-flow__minimap-node')).toHaveLength(2);
    const mask = svgEl.querySelector('path.lit-flow__minimap-mask');
    expect(mask?.getAttribute('fill-rule')).toBe('evenodd');
    expect(svgEl.querySelector('title')?.textContent).toBe('Mini Map');
    expect(svgEl.getAttribute('role')).toBe('img');
  });

  it('marks selected nodes, colours nodes and ignores hidden ones', async () => {
    const flow = await mountFlow({
      nodes: [...nodes, node('h', 100, 100, { hidden: true, width: 10, height: 10 })],
      width: 800,
      height: 500,
    });
    const minimap = document.createElement('xy-minimap') as XyMinimapElement;
    minimap.nodeColor = (n) => (n.id === 'a' ? '#ff0000' : '#00ff00');
    minimap.nodeClass = 'mine';
    await withPlugins(flow, minimap);
    const rects = () => [
      ...minimap.shadowRoot!.querySelectorAll<SVGRectElement>('rect.lit-flow__minimap-node'),
    ];
    expect(rects()).toHaveLength(2);
    expect(rects()[0]?.style.fill).toBe('rgb(255, 0, 0)');
    expect(rects()[0]?.classList.contains('mine')).toBe(true);
    flow.store.addSelectedNodes(['b']);
    await waitFor(() => rects()[1]?.classList.contains('selected'));
    expect(rects()[0]?.classList.contains('selected')).toBe(false);
  });

  it('supports a custom node renderer and emits click events', async () => {
    const flow = await mountFlow({ nodes, width: 800, height: 500 });
    const minimap = document.createElement('xy-minimap') as XyMinimapElement;
    minimap.nodeRenderer = (p) =>
      svg`<circle class="custom" cx=${p.x} cy=${p.y} r="4" @click=${(e: MouseEvent) => p.onClick?.(e, p.id)}></circle>`;
    const clicks: unknown[] = [];
    const nodeClicks: string[] = [];
    minimap.addEventListener('minimap-click', (e) =>
      clicks.push((e as CustomEvent).detail.position),
    );
    minimap.addEventListener('minimap-node-click', (e) =>
      nodeClicks.push((e as CustomEvent).detail.node.id),
    );
    await withPlugins(flow, minimap);
    const circles = minimap.shadowRoot!.querySelectorAll<SVGCircleElement>('circle.custom');
    expect(circles).toHaveLength(2);
    circles[1]?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, clientX: 10, clientY: 10 }),
    );
    expect(nodeClicks).toEqual(['b']);
    expect(clicks).toHaveLength(1);
  });

  it('is pannable: dragging the minimap moves the flow viewport', async () => {
    const flow = await mountFlow({ nodes, width: 800, height: 500 });
    const minimap = document.createElement('xy-minimap') as XyMinimapElement;
    minimap.pannable = true;
    await withPlugins(flow, minimap);
    const svgEl = inPlugin<SVGSVGElement>(minimap, 'svg.lit-flow__minimap-svg');
    await waitFor(() => flow.store.getState().panZoom);
    const before = flow.getViewport();
    const c = centerOf(svgEl);
    await dragMouse(svgEl, c, { x: c.x + 30, y: c.y + 10 });
    const after = flow.getViewport();
    // dragging right moves the view right, i.e. the flow translates left
    expect(after.x).toBeLessThan(before.x - 10);
    expect(after.y).not.toBe(before.y);
  });

  it('zoomable: wheel over the minimap zooms the flow', async () => {
    const flow = await mountFlow({ nodes, width: 800, height: 500 });
    const minimap = document.createElement('xy-minimap') as XyMinimapElement;
    minimap.zoomable = true;
    await withPlugins(flow, minimap);
    const svgEl = inPlugin<SVGSVGElement>(minimap, 'svg.lit-flow__minimap-svg');
    const z = flow.getZoom();
    svgEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true, composed: true }),
    );
    await waitFor(() => flow.getZoom() > z);
  });
});

describe('<xy-node-resizer> and <xy-resize-control>', () => {
  const resizable = defineNodeType({
    render: () =>
      html`<xy-node-resizer min-width="40" min-height="30"></xy-node-resizer>
        <div>content</div>`,
  });
  const base = (extra: Record<string, unknown> = {}) =>
    node('a', 100, 100, { type: 'resizable', width: 120, height: 60, ...extra });

  const controls = (flow: XyFlowElement, id = 'a') => [
    ...nodeEl(flow, id).querySelectorAll<HTMLElement>('.lit-flow__resize-control'),
  ];

  it('renders 4 lines and 4 handles while selected', async () => {
    const flow = await mountFlow({ nodes: [base()], props: { nodeTypes: { resizable } } });
    expect(controls(flow)).toHaveLength(0);
    flow.store.addSelectedNodes(['a']);
    await waitFor(() => controls(flow).length === 8);
    expect(controls(flow).filter((c) => c.classList.contains('line'))).toHaveLength(4);
    expect(controls(flow).filter((c) => c.classList.contains('handle'))).toHaveLength(4);
    expect(controls(flow).every((c) => c.classList.contains('nodrag'))).toBe(true);
  });

  it('resizes through the bottom-right handle with start/live/end phases', async () => {
    const flow = await mountFlow({
      nodes: [base({ selected: true })],
      props: { nodeTypes: { resizable } },
      width: 800,
      height: 600,
    });
    const batches: { changes: NodeChange[]; meta: ChangeMeta }[] = [];
    flow.addEventListener('nodes-change', (e) => {
      const d = (e as CustomEvent).detail;
      if (d.meta.origin === 'resize') batches.push(d);
    });
    await waitFor(() => controls(flow).length === 8);
    const handle = controls(flow).find(
      (c) =>
        c.classList.contains('handle') &&
        c.classList.contains('bottom') &&
        c.classList.contains('right'),
    )!;
    const c = centerOf(handle);
    await dragMouse(handle, c, { x: c.x + 60, y: c.y + 30 }, 5);
    const n = flow.getNode('a')!;
    expect(n.width).toBeGreaterThan(160);
    expect(n.height).toBeGreaterThan(80);
    expect(n.resizing).toBeFalsy();
    const phases = batches.map((b) => b.meta.phase);
    expect(phases[0]).toBe('start');
    expect(phases.at(-1)).toBe('end');
    expect(phases.slice(1, -1).every((p) => p === 'live')).toBe(true);
    expect(new Set(batches.map((b) => b.meta.gestureId)).size).toBe(1);
    expect(flow.store.getState().activeGesture).toBeNull();
    const last = batches.at(-1)!.changes[0] as { type: string; resizing: boolean };
    expect(last).toMatchObject({ type: 'dimensions', resizing: false });
  });

  it('respects min size and moves the position for top-left', async () => {
    const flow = await mountFlow({
      nodes: [base({ selected: true })],
      props: { nodeTypes: { resizable } },
      width: 800,
      height: 600,
    });
    await waitFor(() => controls(flow).length === 8);
    const handle = controls(flow).find(
      (c) =>
        c.classList.contains('handle') &&
        c.classList.contains('top') &&
        c.classList.contains('left'),
    )!;
    const c = centerOf(handle);
    await dragMouse(handle, c, { x: c.x + 500, y: c.y + 400 }, 5);
    const n = flow.getNode('a')!;
    expect(n.width).toBe(40);
    expect(n.height).toBe(30);
    // the opposite corner stays put
    expect(n.position.x + 40).toBeCloseTo(220, 0);
    expect(n.position.y + 30).toBeCloseTo(160, 0);
  });

  it('keep-aspect-ratio keeps the ratio', async () => {
    const keep = defineNodeType({
      render: () => html`<xy-node-resizer keep-aspect-ratio></xy-node-resizer>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { type: 'keep', width: 120, height: 60, selected: true })],
      props: { nodeTypes: { keep } },
      width: 800,
      height: 600,
    });
    await waitFor(() => controls(flow).length === 8);
    const handle = controls(flow).find(
      (c) =>
        c.classList.contains('handle') &&
        c.classList.contains('bottom') &&
        c.classList.contains('right'),
    )!;
    const c = centerOf(handle);
    await dragMouse(handle, c, { x: c.x + 60, y: c.y + 5 }, 5);
    const n = flow.getNode('a')!;
    expect((n.width ?? 0) / (n.height ?? 1)).toBeCloseTo(2, 1);
  });

  it('compensates child nodes when the parent grows at the top-left', async () => {
    const flow = await mountFlow({
      nodes: [
        base({ selected: true }),
        node('child', 10, 10, { parentId: 'a', width: 20, height: 20 }),
      ],
      props: { nodeTypes: { resizable } },
      width: 800,
      height: 600,
    });
    await waitFor(() => controls(flow).length === 8);
    const handle = controls(flow).find(
      (c) =>
        c.classList.contains('handle') &&
        c.classList.contains('top') &&
        c.classList.contains('left'),
    )!;
    const c = centerOf(handle);
    await dragMouse(handle, c, { x: c.x - 40, y: c.y - 20 }, 5);
    const child = flow.getNode('child')!;
    const parent = flow.getNode('a')!;
    expect(parent.position.x).toBeLessThan(100);
    // the child keeps its absolute position: parent moved left, so its relative x grew
    expect(child.position.x).toBeGreaterThan(10);
  });

  it('resizer defaults on the node type render the variants', async () => {
    const hover = defineNodeType({
      render: () => html`<div>x</div>`,
      resizer: { variant: 'hover-corner' },
    });
    const lines = defineNodeType({
      render: () => html`<div>x</div>`,
      resizer: { variant: 'lines' },
    });
    const plain = defineNodeType({ render: () => html`<div>x</div>`, resizer: { minWidth: 70 } });
    const flow = await mountFlow({
      nodes: [
        node('h', 0, 0, { type: 'hover', width: 100, height: 50 }),
        node('l', 200, 0, { type: 'lines', width: 100, height: 50, selected: true }),
        node('p', 400, 0, { type: 'plain', width: 100, height: 50, selected: true }),
      ],
      props: { nodeTypes: { hover, lines, plain } },
    });
    // hover-corner: always rendered (one handle), hidden until the node is hovered
    await waitFor(() => controls(flow, 'h').length === 1);
    const corner = controls(flow, 'h')[0]!;
    expect(corner.classList.contains('bottom') && corner.classList.contains('right')).toBe(true);
    expect(getComputedStyle(corner).opacity).toBe('0');
    expect(controls(flow, 'l')).toHaveLength(4);
    expect(controls(flow, 'l').every((c) => c.classList.contains('line'))).toBe(true);
    expect(controls(flow, 'p')).toHaveLength(8);
    const resizer = nodeEl(flow, 'p').querySelector('xy-node-resizer') as unknown as {
      minWidth: number;
    };
    expect(resizer.minWidth).toBe(70);
  });
});

describe('<xy-viewport-portal>', () => {
  it('projects content into the viewport layers and moves it with the viewport', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const front = document.createElement('xy-viewport-portal');
    const back = document.createElement('xy-viewport-portal');
    back.setAttribute('target', 'back');
    const f = document.createElement('div');
    f.style.cssText = 'position:absolute;left:100px;top:50px;width:20px;height:20px';
    front.append(f);
    const b = document.createElement('div');
    b.style.cssText = 'position:absolute;left:0;top:0;width:10px;height:10px';
    back.append(b);
    flow.append(front, back);
    await frames(2);
    expect(front.getAttribute('slot')).toBe('viewport-front');
    expect(back.getAttribute('slot')).toBe('viewport-back');
    const box = flow.getBoundingClientRect();
    const rect = () => f.getBoundingClientRect();
    expect(rect().left - box.left).toBeCloseTo(100, 0);
    await flow.setViewport({ x: 40, y: 10, zoom: 2 });
    await waitFor(() => Math.abs(rect().left - box.left - 240) < 1);
    expect(rect().width).toBeCloseTo(40, 0);
    expect(rect().top - box.top).toBeCloseTo(110, 0);
  });
});

describe('edgeToolbar', () => {
  const custom = defineEdgeType({
    render: (p, flow) => ({
      path: baseEdge({ id: p.id, path: `M${p.sourceX},${p.sourceY} L${p.targetX},${p.targetY}` }),
      label: edgeToolbar(
        flow,
        {
          edgeId: p.id,
          x: 200,
          y: 100,
          selected: p.selected,
          alignX: 'left',
          alignY: 'top',
          class: 'tb',
        },
        html`<button>edit</button>`,
      ),
    }),
  });

  it('is shown while the edge is selected and keeps its size when zooming', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0), node('b', 300, 200)],
      edges: [edge('e', 'a', 'b', { type: 'custom' })],
      props: { edgeTypes: { custom } },
      width: 800,
      height: 600,
    });
    const toolbar = () => flow.renderRoot.querySelector<HTMLElement>('.lit-flow__edge-toolbar');
    expect(toolbar()).toBeNull();
    flow.store.addSelectedEdges(['e']);
    await waitFor(() => toolbar());
    expect(toolbar()?.getAttribute('data-id')).toBe('e');
    expect(toolbar()?.classList.contains('tb')).toBe(true);
    const button = () => toolbar()!.querySelector('button')!;
    const w1 = button().getBoundingClientRect().width;
    await flow.setViewport({ x: 0, y: 0, zoom: 2 });
    await frames(2);
    expect(button().getBoundingClientRect().width).toBeCloseTo(w1, 1);
    // `--xy-zoom` inherits, so it must sit on the label layer: on the viewport every zoom frame
    // would restyle all nodes and edges (about 90 ms per frame with 5000 nodes)
    const viewport = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__viewport')!;
    const labels = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__edgelabel-renderer')!;
    expect(labels.style.getPropertyValue('--xy-zoom')).toBe('2');
    expect(viewport.style.getPropertyValue('--xy-zoom')).toBe('');
    // anchored at the edge label position (200, 100) in flow space: left/top aligned
    const flowBox = flow.getBoundingClientRect();
    const b = button().getBoundingClientRect();
    expect(b.left - flowBox.left).toBeCloseTo(400, 0);
    expect(b.top - flowBox.top).toBeCloseTo(200, 0);
    flow.store.unselectNodesAndEdges({ edges: [flow.getEdge('e')!] });
    await waitFor(() => !toolbar());
  });
});
