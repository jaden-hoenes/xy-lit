import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_LOG_LIMIT } from '../src/index.js';
import type { XyDevtoolsElement } from '../src/index.js';
import { cleanup, frames, mountFlow, node, rendered, waitFor } from './helpers.js';

afterEach(cleanup);

async function mount(attrs: Record<string, string> = {}) {
  const dev = document.createElement('xy-devtools') as XyDevtoolsElement;
  for (const [k, v] of Object.entries(attrs)) dev.setAttribute(k, v);
  const flow = await mountFlow({
    nodes: [node('a', 0, 0), node('b', 300, 100, { type: 'input' })],
    children: [dev],
  });
  await rendered(dev);
  const root = dev.shadowRoot!;
  const toggle = (name: string): HTMLButtonElement =>
    [...root.querySelectorAll<HTMLButtonElement>('button[role="switch"]')].find((b) =>
      b.textContent?.includes(name),
    )!;
  const inspector = () =>
    flow.querySelector('xy-devtools-inspector') as
      (HTMLElement & { shadowRoot: ShadowRoot }) | null;
  return { dev, flow, root, toggle, inspector };
}

describe('<xy-devtools>', () => {
  it('has three switches, all off by default, bottom-right', async () => {
    const { dev, root } = await mount();
    expect(dev.position).toBe('bottom-right');
    const switches = [...root.querySelectorAll('button[role="switch"]')];
    expect(switches.map((s) => s.textContent?.trim())).toEqual([
      'Viewport logger',
      'Node inspector',
      'Change logger',
    ]);
    expect(switches.every((s) => s.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('starts from the attributes', async () => {
    const { dev, toggle } = await mount({ 'viewport-logger': '', 'change-logger': '' });
    expect(dev.viewportLogger).toBe(true);
    expect(toggle('Viewport logger').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Node inspector').getAttribute('aria-checked')).toBe('false');
  });

  it('viewport logger shows x, y and zoom live', async () => {
    const { flow, toggle, root } = await mount();
    expect(root.querySelector('[data-testid="viewport-readout"]')).toBeNull();
    toggle('Viewport logger').click();
    const readout = await waitFor(() =>
      root.querySelector<HTMLElement>('[data-testid="viewport-readout"]'),
    );
    expect(readout.textContent?.replace(/\s+/g, ' ')).toContain('zoom 1');
    await flow.setViewport({ x: 40, y: -20, zoom: 2 }, { duration: 0 });
    await waitFor(() => /x\s*40\s*y\s*-20\s*zoom\s*2/.test(readout.textContent ?? ''));
  });

  it('node inspector adds one box per visible node in the viewport-front slot, and removes it again', async () => {
    const { flow, toggle, inspector } = await mount();
    expect(inspector()).toBeNull();
    toggle('Node inspector').click();
    const el = await waitFor(() => inspector());
    expect(el.getAttribute('slot')).toBe('viewport-front');
    const boxes = await waitFor(() => {
      const found = el.shadowRoot.querySelectorAll<HTMLElement>('.xy-ui-inspector__box');
      return found.length === 2 ? [...found] : undefined;
    });
    const a = boxes.find((b) => b.dataset.nodeId === 'a')!;
    expect(a.textContent).toContain('a');
    expect(a.textContent).toContain('default');
    expect(boxes.find((b) => b.dataset.nodeId === 'b')?.textContent).toContain('input');
    // the boxes sit inside the transformed viewport, below their node
    expect(el.assignedSlot?.closest('.lit-flow__viewport')).not.toBeNull();
    const nodeBox = flow.renderRoot.querySelector('xy-node[data-id="a"]')!.getBoundingClientRect();
    expect(a.getBoundingClientRect().top).toBeGreaterThanOrEqual(nodeBox.bottom);
    // it follows the node
    flow.updateNode('a', { position: { x: 100, y: 200 } });
    await waitFor(() => /x 100\s+y 200/.test(a.textContent ?? ''));
    toggle('Node inspector').click();
    await waitFor(() => inspector() === null);
  });

  it('removes the inspector when the devtools element leaves', async () => {
    const { dev, inspector } = await mount({ 'node-inspector': '' });
    await waitFor(() => inspector());
    dev.remove();
    expect(inspector()).toBeNull();
  });

  it('change logger records nodes-change and edges-change with phase and origin, newest first', async () => {
    const { flow, dev, toggle, root } = await mount();
    toggle('Change logger').click();
    await dev.updateComplete;
    flow.updateNode('a', { position: { x: 10, y: 20 } });
    await waitFor(() => dev.entries.length > 0);
    flow.addEdges({ id: 'e', source: 'a', target: 'b' });
    await waitFor(() => dev.entries.some((e) => e.kind === 'edges'));
    const [newest] = dev.entries;
    expect(newest?.kind).toBe('edges');
    expect(newest?.changes[0]).toBe('add e');
    const nodesEntry = dev.entries.find((e) => e.kind === 'nodes')!;
    expect(nodesEntry.changes).toEqual(['replace a']);
    expect(nodesEntry.meta).toEqual({ phase: 'discrete', origin: 'api' });
    flow.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 3.4, y: 4 }, dragging: true }],
      { phase: 'live', origin: 'drag' },
    );
    await waitFor(() => dev.entries[0]?.changes[0] === 'position a (3, 4)');
    expect(dev.entries[0]?.meta).toEqual({ phase: 'live', origin: 'drag' });
    await dev.updateComplete;
    const items = [...root.querySelectorAll('.xy-ui-dev__log li')];
    expect(items.length).toBe(dev.entries.length);
    expect(items[0]?.textContent).toContain('nodes');
    expect(items[1]?.textContent).toContain('edges');
  });

  it('does not record while the switch is off, does not make the flow controlled, and keeps the last 50', async () => {
    const { flow, dev, toggle } = await mount();
    flow.updateNode('a', { position: { x: 1, y: 1 } });
    await frames(2);
    expect(dev.entries).toHaveLength(0);
    toggle('Change logger').click();
    await dev.updateComplete;
    for (let i = 0; i < CHANGE_LOG_LIMIT + 10; i++) {
      flow.updateNode('a', { position: { x: i + 100, y: 0 } });
      await frames(1);
    }
    await waitFor(() => dev.entries.length === CHANGE_LOG_LIMIT);
    // uncontrolled: the flow applied every change itself
    expect(flow.getNode('a')?.position.x).toBe(CHANGE_LOG_LIMIT + 9 + 100);
    dev.clearLog();
    expect(dev.entries).toHaveLength(0);
    toggle('Change logger').click();
    await dev.updateComplete;
    flow.updateNode('a', { position: { x: 5, y: 5 } });
    await frames(2);
    expect(dev.entries).toHaveLength(0);
  });
});
