import { ArraySource } from '@xy-lit/store';
import type { FlowEventMap } from '@xy-lit/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, edge, frames, mountFlow, node, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Detail = FlowEventMap['render-complete'];

/** Create a flow that is not mounted yet, with a recorder for `render-complete`. */
function create(
  nodes = [node('a'), node('b', 250, 0)],
  edges = [edge('e', 'a', 'b')],
): { flow: XyFlowElement; events: Detail[] } {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = 'display:block;width:800px;height:500px';
  flow.nodes = nodes;
  flow.edges = edges;
  const events: Detail[] = [];
  flow.addEventListener('render-complete', (e) => {
    events.push(e.detail);
  });
  return { flow, events };
}

const overlay = (flow: XyFlowElement): HTMLElement =>
  flow.renderRoot.querySelector<HTMLElement>('.lit-flow__loading')!;

describe('RenderCompleteController', () => {
  it('emits render-complete once for the first revision, with the counts', async () => {
    const { flow, events } = create();
    document.body.append(flow);
    try {
      const detail = await flow.whenRendered();
      await frames(4);
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(detail);
      expect(detail.nodeCount).toBe(2);
      expect(detail.edgeCount).toBe(1);
      expect(detail.durationMs).toBeGreaterThanOrEqual(0);
      expect(detail.revision).toBe(flow.store.getState().structureRevision);
    } finally {
      flow.remove();
    }
  });

  it('waits until every node is measured and every edge rendered', async () => {
    const holder = document.createElement('div');
    holder.style.display = 'none';
    document.body.append(holder);
    const { flow, events } = create();
    holder.append(flow);
    try {
      await flow.updateComplete;
      await frames(6);
      expect(events).toHaveLength(0);
      expect(overlay(flow).hidden).toBe(false);
      holder.style.display = 'block';
      await flow.whenRendered();
      expect(events).toHaveLength(1);
      expect(flow.querySelector('.lit-flow__edge')).toBeNull();
      expect(flow.renderRoot.querySelectorAll('g.lit-flow__edge')).toHaveLength(1);
      for (const n of flow.getNodes()) expect(n.measured?.width).toBeGreaterThan(0);
    } finally {
      holder.remove();
    }
  });

  it('emits again per structure revision, not for data-only changes', async () => {
    const { flow, events } = create();
    document.body.append(flow);
    try {
      const first = await flow.whenRendered();
      flow.updateNodeData('a', { label: 'changed' });
      flow.updateNode('a', { position: { x: 10, y: 10 } });
      await frames(5);
      expect(events).toHaveLength(1);

      flow.addNodes([node('c', 0, 200)]);
      await waitFor(() => events.length === 2);
      expect(events[1]!.revision).toBeGreaterThan(first.revision);
      expect(events[1]!.nodeCount).toBe(3);

      flow.addEdges([edge('e2', 'b', 'c')]);
      await waitFor(() => events.length === 3);
      expect(events[2]!.edgeCount).toBe(2);

      flow.deleteElements({ nodes: [{ id: 'c' }] });
      await waitFor(() => events.length === 4);
      expect(events[3]!.nodeCount).toBe(2);
      expect(events[3]!.edgeCount).toBe(1);
    } finally {
      flow.remove();
    }
  });

  it('a newer revision cancels the pending emit', async () => {
    const { flow, events } = create();
    document.body.append(flow);
    try {
      await flow.whenRendered();
      events.length = 0;
      flow.addNodes([node('c', 0, 200)]);
      await frames(1);
      flow.addNodes([node('d', 250, 200)]);
      await waitFor(() => events.length > 0);
      await frames(6);
      expect(events).toHaveLength(1);
      expect(events[0]!.nodeCount).toBe(4);
    } finally {
      flow.remove();
    }
  });

  it('whenRendered resolves at once when complete and on the next event otherwise', async () => {
    const { flow } = create();
    document.body.append(flow);
    try {
      const first = await flow.whenRendered();
      expect(await flow.whenRendered()).toBe(first);
      flow.addNodes([node('c', 0, 200)]);
      await frames(1);
      const next = await flow.whenRendered();
      expect(next.revision).toBeGreaterThan(first.revision);
      expect(next.nodeCount).toBe(3);
    } finally {
      flow.remove();
    }
  });

  it('an empty flow completes after two frames', async () => {
    const { flow, events } = create([], []);
    document.body.append(flow);
    try {
      const detail = await flow.whenRendered();
      expect(detail).toMatchObject({ nodeCount: 0, edgeCount: 0 });
      expect(events).toHaveLength(1);
    } finally {
      flow.remove();
    }
  });

  it('waits for fit-view, so the viewport is final when it fires', async () => {
    const { flow } = create([node('a', 3000, 2000), node('b', 3300, 2000)], []);
    flow.setAttribute('fit-view', '');
    document.body.append(flow);
    try {
      await flow.whenRendered();
      const [x, y, zoom] = flow.store.getState().transform;
      expect(zoom).toBeLessThanOrEqual(2);
      expect(x).toBeLessThan(0);
      expect(y).toBeLessThan(0);
      expect(flow.store.getState().fitViewQueued).toBe(false);
    } finally {
      flow.remove();
    }
  });

  it('completes with only-render-visible-elements although far nodes never get measured', async () => {
    const { flow } = create([node('a'), node('far', 20000, 20000)], []);
    flow.setAttribute('only-render-visible-elements', '');
    document.body.append(flow);
    try {
      const detail = await flow.whenRendered();
      expect(detail.nodeCount).toBe(2);
      expect(flow.renderRoot.querySelectorAll('xy-node')).toHaveLength(1);
    } finally {
      flow.remove();
    }
  });

  it('hides the loading overlay after the first completion', async () => {
    const { flow } = create();
    document.body.append(flow);
    try {
      await flow.updateComplete;
      expect(overlay(flow).hidden).toBe(false);
      await flow.whenRendered();
      await flow.updateComplete;
      expect(overlay(flow).hidden).toBe(true);
    } finally {
      flow.remove();
    }
  });

  it('`loading` keeps the overlay and `no-loading-overlay` never shows it', async () => {
    const forced = await mountFlow({ nodes: [node('a')], attributes: { loading: '' } });
    expect(overlay(forced).hidden).toBe(false);
    forced.loading = false;
    await forced.updateComplete;
    expect(overlay(forced).hidden).toBe(true);

    const { flow } = create();
    flow.setAttribute('no-loading-overlay', '');
    document.body.append(flow);
    try {
      await flow.updateComplete;
      expect(overlay(flow).hidden).toBe(true);
    } finally {
      flow.remove();
    }
  });

  it('shows the overlay again and completes again when a new source is attached', async () => {
    const { flow, events } = create();
    document.body.append(flow);
    try {
      await flow.whenRendered();
      await flow.updateComplete;
      expect(overlay(flow).hidden).toBe(true);
      flow.source = new ArraySource([node('x'), node('y', 250, 0)], []);
      await flow.updateComplete;
      expect(overlay(flow).hidden).toBe(false);
      await waitFor(() => events.length === 2);
      await flow.updateComplete;
      expect(events[1]!.nodeCount).toBe(2);
      expect(overlay(flow).hidden).toBe(true);
    } finally {
      flow.remove();
    }
  });

  it('keeps its state when the element is moved', async () => {
    const { flow, events } = create();
    const other = document.createElement('div');
    document.body.append(flow, other);
    try {
      await flow.whenRendered();
      other.append(flow);
      await frames(5);
      expect(events).toHaveLength(1);
      await flow.whenRendered();
    } finally {
      flow.remove();
      other.remove();
    }
  });
});
