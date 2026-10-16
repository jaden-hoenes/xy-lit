import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { NodeToolbarOptions } from '../src/nodes/node-toolbar.js';
import { nodeToolbar } from '../src/nodes/node-toolbar.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

type ToolbarData = { label: string; toolbar?: NodeToolbarOptions };

const withToolbar = defineNodeType({
  render: ({ data }) =>
    html`${nodeToolbar((data as ToolbarData).toolbar ?? {}, html`<button>tool</button>`)}
      <div class="body" style="width:100px;height:40px">${(data as ToolbarData).label}</div>`,
});

const toolbars = (flow: XyFlowElement): HTMLElement[] => [
  ...flow.renderRoot.querySelectorAll<HTMLElement>('.lit-flow__node-toolbar'),
];

const flowWith = (
  nodes: ReturnType<typeof node>[],
  props: Record<string, unknown> = {},
): Promise<XyFlowElement> =>
  mountFlow({ nodes, props: { nodeTypes: { withToolbar }, ...props }, width: 800, height: 600 });

const tb = (label: string, x: number, y: number, toolbar?: NodeToolbarOptions, extra = {}) =>
  node(label, x, y, { type: 'withToolbar', data: { label, toolbar }, ...extra });

describe('nodeToolbar', () => {
  it('is shown while its node is the only selected node', async () => {
    const flow = await flowWith([tb('a', 100, 100), tb('b', 400, 100)]);
    expect(toolbars(flow)).toHaveLength(0);
    flow.store.addSelectedNodes(['a']);
    await waitFor(() => toolbars(flow).length === 1);
    expect(toolbars(flow)[0]?.getAttribute('data-id')).toBe('a');
    expect(toolbars(flow)[0]?.textContent).toContain('tool');

    // a second selected node hides it (no overlapping toolbars)
    flow.store.setState({ multiSelectionActive: true });
    flow.store.addSelectedNodes(['b']);
    await waitFor(() => toolbars(flow).length === 0);
    flow.store.unselectNodesAndEdges({ nodes: [flow.getNode('b')!] });
    await waitFor(() => toolbars(flow).length === 1);
  });

  it('isVisible overrides the selection rule', async () => {
    const flow = await flowWith([
      tb('a', 100, 100, { isVisible: true }),
      tb('b', 400, 100, { isVisible: false }),
    ]);
    await waitFor(() => toolbars(flow).length === 1);
    expect(toolbars(flow)[0]?.getAttribute('data-id')).toBe('a');
    flow.store.addSelectedNodes(['b']);
    await flow.updateComplete;
    expect(toolbars(flow).map((t) => t.getAttribute('data-id'))).toEqual(['a']);
  });

  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const aligns = ['start', 'center', 'end'] as const;
  for (const position of sides) {
    for (const align of aligns) {
      it(`places the ${position}/${align} toolbar next to the node`, async () => {
        const flow = await flowWith([tb('n', 300, 250, { isVisible: true, position, align })]);
        await waitFor(() => toolbars(flow).length === 1);
        const bar = toolbars(flow)[0]!.getBoundingClientRect();
        const box = nodeEl(flow, 'n').getBoundingClientRect();
        if (position === 'top') expect(bar.bottom).toBeLessThanOrEqual(box.top);
        if (position === 'bottom') expect(bar.top).toBeGreaterThanOrEqual(box.bottom);
        if (position === 'left') expect(bar.right).toBeLessThanOrEqual(box.left);
        if (position === 'right') expect(bar.left).toBeGreaterThanOrEqual(box.right);
        const horizontal = position === 'top' || position === 'bottom';
        const [barStart, barSize, boxStart, boxSize] = horizontal
          ? [bar.left, bar.width, box.left, box.width]
          : [bar.top, bar.height, box.top, box.height];
        const f = { start: 0, center: 0.5, end: 1 }[align];
        expect(Math.round(barStart + barSize * f)).toBe(Math.round(boxStart + boxSize * f));
      });
    }
  }

  it('does not scale with the viewport but follows pan and zoom', async () => {
    const flow = await flowWith([tb('n', 300, 250, { isVisible: true })]);
    await waitFor(() => toolbars(flow).length === 1);
    const width = toolbars(flow)[0]!.getBoundingClientRect().width;
    const before = toolbars(flow)[0]!.getBoundingClientRect();
    await flow.setViewport({ x: 50, y: 20, zoom: 2 });
    await waitFor(
      () => Math.abs(toolbars(flow)[0]!.getBoundingClientRect().left - before.left) > 20,
    );
    const after = toolbars(flow)[0]!.getBoundingClientRect();
    expect(after.width).toBe(width);
    // still centred above the (now larger) node
    const box = nodeEl(flow, 'n').getBoundingClientRect();
    expect(Math.round(after.left + after.width / 2)).toBe(Math.round(box.left + box.width / 2));
    expect(after.bottom).toBeLessThanOrEqual(box.top);
    // and lives outside the viewport element
    expect(toolbars(flow)[0]!.closest('.lit-flow__viewport')).toBeNull();
  });

  it('follows the node when it moves', async () => {
    const flow = await flowWith([tb('n', 300, 250, { isVisible: true })]);
    await waitFor(() => toolbars(flow).length === 1);
    const before = toolbars(flow)[0]!.getBoundingClientRect();
    flow.updateNode('n', { position: { x: 400, y: 300 } });
    await waitFor(() => toolbars(flow)[0]!.getBoundingClientRect().left === before.left + 100);
    expect(toolbars(flow)[0]!.getBoundingClientRect().top).toBe(before.top + 50);
  });

  it('is removed with its node', async () => {
    const flow = await flowWith([
      tb('a', 100, 100, { isVisible: true }),
      tb('b', 400, 100, { isVisible: true }),
    ]);
    await waitFor(() => toolbars(flow).length === 2);
    flow.deleteElements({ nodes: [{ id: 'a' }] });
    await waitFor(() => toolbars(flow).length === 1);
    expect(toolbars(flow)[0]?.getAttribute('data-id')).toBe('b');
    expect(flow.toolbars.size).toBe(1);
  });

  it('can belong to other nodes, several at once; unknown ids show nothing', async () => {
    const flow = await flowWith([
      tb('a', 100, 100, { isVisible: true, nodeId: ['a', 'b', 'nope'] }),
      tb('b', 400, 100),
      tb('c', 100, 300, { isVisible: true, nodeId: 'nope' }),
    ]);
    await waitFor(() => toolbars(flow).length === 1);
    expect(toolbars(flow)[0]?.getAttribute('data-id')).toBe('a b');
    // centred over the union of both nodes
    const bar = toolbars(flow)[0]!.getBoundingClientRect();
    const a = nodeEl(flow, 'a').getBoundingClientRect();
    const b = nodeEl(flow, 'b').getBoundingClientRect();
    const union = { left: a.left, right: b.right };
    expect(Math.round(bar.left + bar.width / 2)).toBe(Math.round((union.left + union.right) / 2));
  });

  it('applies class and style options and keeps the toolbar above its node', async () => {
    const flow = await flowWith([
      tb('n', 100, 100, { isVisible: true, class: 'mine', style: 'color: red' }),
    ]);
    await waitFor(() => toolbars(flow).length === 1);
    const bar = toolbars(flow)[0]!;
    expect(bar.classList.contains('mine')).toBe(true);
    expect(bar.style.color).toBe('red');
    expect(bar.style.position).toBe('absolute');
    expect(Number(bar.style.zIndex)).toBeGreaterThan(flow.getInternalNode('n')!.internals.z);
  });

  it('renders text content as text', async () => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    const text = defineNodeType({
      render: () => html`${nodeToolbar({ isVisible: true }, evil)}<span>node</span>`,
    });
    const flow = await mountFlow({
      nodes: [node('n', 100, 100, { type: 'text' })],
      props: { nodeTypes: { text } },
    });
    await waitFor(() => toolbars(flow).length === 1);
    expect(toolbars(flow)[0]?.textContent).toContain('<img');
    expect(toolbars(flow)[0]?.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('does not re-render the flow on pan while no toolbar is shown, and does while one is', async () => {
    const flow = await flowWith([tb('n', 100, 100)]);
    let updates = 0;
    flow.addController({
      hostUpdated: () => {
        updates++;
      },
    });
    await flow.setViewport({ x: 10, y: 10, zoom: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(updates).toBe(0);

    flow.store.addSelectedNodes(['n']);
    await waitFor(() => toolbars(flow).length === 1);
    updates = 0;
    await flow.setViewport({ x: 30, y: 10, zoom: 1 });
    await waitFor(() => updates > 0);
  });
});
