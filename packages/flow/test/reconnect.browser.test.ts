import { afterEach, describe, expect, it, vi } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, centerOf, dragMouse, edge, frames, mountFlow, node, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nodes = () => [node('a', 0, 0), node('b', 0, 200), node('c', 300, 200)];

const anchors = (flow: XyFlowElement, edgeId: string): SVGCircleElement[] => [
  ...flow.renderRoot.querySelectorAll<SVGCircleElement>(
    `g[data-id="${edgeId}"] .lit-flow__edgeupdater`,
  ),
];

const handleEl = (flow: XyFlowElement, id: string): HTMLElement =>
  flow.renderRoot.querySelector<HTMLElement>(`[data-id="${id}"]`)!;

/** Drag the anchor of one end of an edge to a point. */
async function dragAnchor(
  flow: XyFlowElement,
  edgeId: string,
  end: 'source' | 'target',
  to: { x: number; y: number },
): Promise<void> {
  const anchor = anchors(flow, edgeId).find((a) =>
    a.classList.contains(`lit-flow__edgeupdater-${end}`),
  )!;
  await dragMouse(anchor, centerOf(anchor), to, 8);
}

describe('reconnect anchors', () => {
  it('are absent by default and appear with edges-reconnectable', async () => {
    const flow = await mountFlow({ nodes: nodes(), edges: [edge('e', 'a', 'b')] });
    expect(anchors(flow, 'e')).toHaveLength(0);
    flow.edgesReconnectable = true;
    await waitFor(() => anchors(flow, 'e').length === 2);
    const [source, target] = anchors(flow, 'e');
    expect(source?.classList.contains('lit-flow__edgeupdater-source')).toBe(true);
    expect(target?.classList.contains('lit-flow__edgeupdater-target')).toBe(true);
    expect(source?.classList.contains('nopan')).toBe(true);
    expect(source?.getAttribute('r')).toBe('10');
    expect(source?.getAttribute('fill')).toBe('transparent');
  });

  it('edge.reconnectable overrides the flow default, per end', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      edges: [
        edge('both', 'a', 'b', { reconnectable: true }),
        edge('src', 'a', 'c', { reconnectable: 'source' }),
        edge('tgt', 'b', 'c', { reconnectable: 'target' }),
      ],
    });
    expect(anchors(flow, 'both')).toHaveLength(2);
    expect(
      anchors(flow, 'src').map((a) => a.classList.contains('lit-flow__edgeupdater-source')),
    ).toEqual([true]);
    expect(
      anchors(flow, 'tgt').map((a) => a.classList.contains('lit-flow__edgeupdater-target')),
    ).toEqual([true]);

    flow.edgesReconnectable = true;
    flow.updateEdge('both', { reconnectable: false });
    await waitFor(() => anchors(flow, 'both').length === 0);
    expect(anchors(flow, 'src')).toHaveLength(1);
  });

  it('sit just outside the node on the side the edge leaves', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      edges: [edge('e', 'a', 'b')],
      props: { edgesReconnectable: true, reconnectRadius: 12 },
    });
    await waitFor(() => anchors(flow, 'e').length === 2);
    const laid = flow.store.getLayoutedEdges().get('e')!;
    const [source, target] = anchors(flow, 'e');
    // default nodes have the source handle at the bottom and the target handle at the top
    expect(Number(source!.getAttribute('cx'))).toBeCloseTo(laid.sourceX);
    expect(Number(source!.getAttribute('cy'))).toBeCloseTo(laid.sourceY + 12);
    expect(Number(target!.getAttribute('cy'))).toBeCloseTo(laid.targetY - 12);
    expect(source!.getAttribute('r')).toBe('12');
  });
});

describe('reconnecting an edge', () => {
  async function setup(props: Record<string, unknown> = {}) {
    const flow = await mountFlow({
      nodes: nodes(),
      edges: [edge('e', 'a', 'b')],
      props: { edgesReconnectable: true, connectionDragThreshold: 0, ...props },
    });
    await waitFor(() => anchors(flow, 'e').length === 2);
    const events: string[] = [];
    for (const type of [
      'reconnect-start',
      'connect-start',
      'reconnect',
      'connect-end',
      'reconnect-end',
    ]) {
      flow.addEventListener(type, () => {
        events.push(type);
      });
    }
    return { flow, events };
  }

  it('moves the target end to another handle, keeps the id, emits the events in order', async () => {
    const { flow, events } = await setup();
    let detail: { oldEdge: { target: string }; edge: { target: string } } | undefined;
    flow.addEventListener('reconnect', (e) => {
      detail = e.detail as never;
    });
    let startType: string | undefined;
    flow.addEventListener('reconnect-start', (e) => {
      startType = e.detail.handleType;
    });
    await dragAnchor(flow, 'e', 'target', centerOf(handleEl(flow, '1-c-null-target')));
    await waitFor(() => flow.getEdge('e')?.target === 'c');
    expect(flow.getEdges()).toHaveLength(1);
    expect(flow.getEdge('e')).toMatchObject({ id: 'e', source: 'a', target: 'c' });
    expect(events).toEqual([
      'reconnect-start',
      'connect-start',
      'reconnect',
      'connect-end',
      'reconnect-end',
    ]);
    expect(detail?.oldEdge.target).toBe('b');
    expect(detail?.edge.target).toBe('c');
    // the handle the new connection is drawn from is the one that stays (the source)
    expect(startType).toBe('source');
  });

  it('moves the source end to another handle', async () => {
    const { flow } = await setup();
    await dragAnchor(flow, 'e', 'source', centerOf(handleEl(flow, '1-c-null-source')));
    await waitFor(() => flow.getEdge('e')?.source === 'c');
    expect(flow.getEdge('e')).toMatchObject({ source: 'c', target: 'b' });
  });

  it('hides the path, marks the edge as updating and shows the connection line while dragging', async () => {
    const { flow } = await setup();
    const anchor = anchors(flow, 'e')[1]!;
    const from = centerOf(anchor);
    const target = centerOf(handleEl(flow, '1-c-null-target'));
    anchor.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: from.x,
        clientY: from.y,
        bubbles: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      }),
    );
    anchor.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: from.x,
        clientY: from.y,
        bubbles: true,
        composed: true,
        button: 0,
      }),
    );
    anchor.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: target.x,
        clientY: target.y,
        bubbles: true,
        composed: true,
        buttons: 1,
      }),
    );
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__connectionline'));
    const g = flow.renderRoot.querySelector('g[data-id="e"]')!;
    await waitFor(() => g.classList.contains('updating'));
    expect(g.querySelector('.lit-flow__edge-path')).toBeNull();
    anchor.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: target.x,
        clientY: target.y,
        bubbles: true,
        composed: true,
      }),
    );
    await waitFor(() => !g.classList.contains('updating'));
    await waitFor(() => g.querySelector('.lit-flow__edge-path'));
    expect(flow.renderRoot.querySelector('.lit-flow__connectionline')).toBeNull();
  });

  it('dropping on empty space leaves the edge as it was but still ends the reconnect', async () => {
    const { flow, events } = await setup();
    await dragAnchor(flow, 'e', 'target', { x: 700, y: 400 });
    await frames(2);
    expect(flow.getEdge('e')).toMatchObject({ source: 'a', target: 'b' });
    expect(events).toEqual(['reconnect-start', 'connect-start', 'connect-end', 'reconnect-end']);
    expect(flow.renderRoot.querySelector('g[data-id="e"] .lit-flow__edge-path')).not.toBeNull();
  });

  it('reconnect is cancelable: the app owns the change', async () => {
    const { flow } = await setup();
    flow.addEventListener('reconnect', (e) => {
      e.preventDefault();
    });
    await dragAnchor(flow, 'e', 'target', centerOf(handleEl(flow, '1-c-null-target')));
    await frames(3);
    expect(flow.getEdge('e')?.target).toBe('b');
  });

  it('onBeforeReconnect can rewrite or veto', async () => {
    const { flow } = await setup({
      onBeforeReconnect: (next: { target: string }, old: { target: string }) => {
        void old;
        return { ...next, label: 'moved' };
      },
    });
    await dragAnchor(flow, 'e', 'target', centerOf(handleEl(flow, '1-c-null-target')));
    await waitFor(() => flow.getEdge('e')?.label === 'moved');
    expect(flow.getEdge('e')?.target).toBe('c');

    const { flow: other } = await setup({ onBeforeReconnect: () => false });
    await dragAnchor(other, 'e', 'target', centerOf(handleEl(other, '1-c-null-target')));
    await frames(3);
    expect(other.getEdge('e')?.target).toBe('b');
  });

  it('honours isValidConnection', async () => {
    const { flow } = await setup({ isValidConnection: () => false });
    await dragAnchor(flow, 'e', 'target', centerOf(handleEl(flow, '1-c-null-target')));
    await frames(3);
    expect(flow.getEdge('e')?.target).toBe('b');
  });

  it('the click that follows a reconnect drag does not select the edge', async () => {
    const { flow } = await setup();
    const anchor = anchors(flow, 'e')[1]!;
    await dragAnchor(flow, 'e', 'target', centerOf(handleEl(flow, '1-c-null-target')));
    await waitFor(() => flow.getEdge('e')?.target === 'c');
    const again =
      anchors(flow, 'e').find((a) => a.classList.contains('lit-flow__edgeupdater-target')) ??
      anchor;
    again.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(flow.getEdge('e')?.selected).toBeFalsy();
    // a later, real click selects as usual
    again.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(flow.getEdge('e')?.selected).toBe(true);
  });

  it('only the primary button starts a reconnect', async () => {
    const { flow, events } = await setup();
    const anchor = anchors(flow, 'e')[1]!;
    const p = centerOf(anchor);
    anchor.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: p.x,
        clientY: p.y,
        bubbles: true,
        composed: true,
        button: 2,
      }),
    );
    await frames(1);
    expect(events).toEqual([]);
  });

  it('handleReconnect applies the same rules when called directly', async () => {
    const { flow } = await setup();
    flow.handleReconnect(flow.getEdge('e')!, {
      source: 'a',
      target: 'c',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(flow.getEdge('e')?.target).toBe('c');
  });
});
