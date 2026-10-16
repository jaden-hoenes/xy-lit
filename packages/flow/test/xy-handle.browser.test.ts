import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionMode } from '@xy-lit/store';
import { ConnectionHub, handleKey } from '../src/elements/xy-flow/connection-hub.js';
import type { ConnectionHubState } from '../src/elements/xy-flow/connection-hub.js';
import { XyHandleElement } from '../src/elements/xy-handle.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
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
import type { XyFlowElement } from '../src/elements/xy-flow.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const handle = (flow: XyFlowElement, nodeId: string, type: string, id = 'null'): XyHandleElement =>
  flow.renderRoot.querySelector(`[data-id="1-${nodeId}-${id}-${type}"]`) as XyHandleElement;

describe('<xy-handle> engine contract', () => {
  it('writes the exact attributes and classes the engine reads', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const h = handle(flow, 'a', 'source');
    expect(h.getAttribute('data-id')).toBe('1-a-null-source');
    expect(h.getAttribute('data-nodeid')).toBe('a');
    expect(h.hasAttribute('data-handleid')).toBe(false);
    expect(h.getAttribute('data-handlepos')).toBe('bottom');
    expect(h.getAttribute('role')).toBe('button');
    expect(h.getAttribute('aria-label')).toBe('Handle');
    expect(h.getAttribute('tabindex')).toBe('-1');
    expect(h.getAttribute('part')).toBe('handle');
    for (const c of [
      'lit-flow__handle',
      'lit-flow__handle-bottom',
      'bottom',
      'nodrag',
      'nopan',
      'source',
      'connectablestart',
      'connectableend',
      'connectable',
      'connectionindicator',
    ]) {
      expect(h.classList.contains(c), c).toBe(true);
    }
    expect(h.classList.contains('target')).toBe(false);
    const t = handle(flow, 'a', 'target');
    expect(t.classList.contains('target')).toBe(true);
    expect(t.classList.contains('lit-flow__handle-top')).toBe(true);
    expect(h.shadowRoot).toBeNull();
  });

  it('writes handle ids and gets measured into handleBounds', async () => {
    const two = defineNodeType({
      render: () =>
        html`<div style="width:100px;height:40px"></div>
          <xy-handle type="source" position="right" handle-id="r1"></xy-handle>
          <xy-handle type="source" position="right" handle-id="r2" style="top:80%"></xy-handle>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'two' })],
      props: { nodeTypes: { two } },
    });
    const h = handle(flow, 'a', 'source', 'r1');
    expect(h.getAttribute('data-handleid')).toBe('r1');
    await waitFor(() => flow.getInternalNode('a')?.internals.handleBounds?.source?.length === 2);
    const ids = flow.getInternalNode('a')?.internals.handleBounds?.source?.map((b) => b.id);
    expect(ids).toEqual(['r1', 'r2']);
  });

  it('keeps user classes and swaps position classes on change, re-measuring', async () => {
    const holder = defineNodeType({
      render: (p) =>
        html`<div style="width:100px;height:40px"></div>
          <xy-handle
            class="mine"
            type="source"
            position=${(p.data as { pos: string }).pos}
          ></xy-handle>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'holder', data: { pos: 'left' } })],
      props: { nodeTypes: { holder } },
    });
    const h = flow.renderRoot.querySelector('xy-handle') as XyHandleElement;
    expect(h.classList.contains('mine')).toBe(true);
    expect(h.classList.contains('left')).toBe(true);
    await waitFor(
      () => flow.getInternalNode('a')?.internals.handleBounds?.source?.[0]?.position === 'left',
    );
    flow.updateNodeData('a', { pos: 'right' });
    await waitFor(() => h.classList.contains('right'));
    expect(h.classList.contains('left')).toBe(false);
    expect(h.classList.contains('lit-flow__handle-left')).toBe(false);
    expect(h.classList.contains('mine')).toBe(true);
    await waitFor(
      () => flow.getInternalNode('a')?.internals.handleBounds?.source?.[0]?.position === 'right',
    );
  });

  it('a handle added after the first render gets measured, so its edge appears', async () => {
    const late = defineNodeType({
      render: (p) =>
        html`<div style="width:100px;height:40px"></div>
          ${(p.data as { extra: boolean }).extra ? html`<xy-handle type="source" handle-id="late" position="right"></xy-handle>` : ''}`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'late', data: { extra: false } }), node('b', 300, 0)],
      edges: [edge('e', 'a', 'b', { sourceHandle: 'late' })],
      props: { nodeTypes: { late } },
    });
    expect(flow.renderRoot.querySelector('.lit-flow__edge')).toBeNull();
    flow.updateNodeData('a', { extra: true });
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__edge'));
  });

  it('is-connectable="false" makes the handle unconnectable', async () => {
    const custom = defineNodeType({
      render: () =>
        html`<div style="width:50px;height:20px"></div>
          <xy-handle type="source" is-connectable="false"></xy-handle>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'c' })],
      props: { nodeTypes: { c: custom } },
    });
    const h = flow.renderRoot.querySelector('xy-handle') as XyHandleElement;
    expect(h.classList.contains('connectable')).toBe(false);
    expect(h.classList.contains('connectionindicator')).toBe(false);
  });

  it('follows the node connectable flag', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0, { connectable: false })] });
    expect(handle(flow, 'a', 'source').classList.contains('connectable')).toBe(false);
  });
});

describe('ConnectionHub', () => {
  const fakeHandle = () => ({ applyConnectionState: vi.fn<(s: ConnectionHubState) => void>() });

  it('updates all handles when a connection starts, then only the affected ones', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 0), node('c', 600, 0)] });
    const store = flow.store;
    const hub = new ConnectionHub();
    hub.attach(store);
    const ha = fakeHandle();
    const hb = fakeHandle();
    const hc = fakeHandle();
    hub.register(handleKey('a', 'source', null), ha);
    hub.register(handleKey('b', 'target', null), hb);
    hub.register(handleKey('c', 'target', null), hc);
    for (const h of [ha, hb, hc]) h.applyConnectionState.mockClear();

    const internal = (id: string) => flow.getInternalNode(id)!;
    const from = {
      id: null,
      nodeId: 'a',
      type: 'source' as const,
      position: 'bottom' as never,
      x: 0,
      y: 0,
      width: 6,
      height: 6,
    };
    const start = {
      inProgress: true as const,
      isValid: null,
      from: { x: 0, y: 0 },
      fromHandle: from,
      fromPosition: 'bottom' as never,
      fromNode: internal('a'),
      to: { x: 5, y: 5 },
      toHandle: null,
      toPosition: 'top' as never,
      toNode: null,
      pointer: { x: 5, y: 5 },
    };
    store.updateConnection(start);
    store.flush();
    expect(ha.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(hb.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(hc.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(ha.applyConnectionState.mock.calls[0]?.[0]).toMatchObject({
      inProgress: true,
      fromKey: 'a-source-null',
    });

    // moving without a handle under the pointer touches nobody
    for (const h of [ha, hb, hc]) h.applyConnectionState.mockClear();
    store.updateConnection({ ...start, to: { x: 9, y: 9 } });
    store.flush();
    expect(hb.applyConnectionState).not.toHaveBeenCalled();
    expect(hc.applyConnectionState).not.toHaveBeenCalled();

    // hovering b's handle updates b only
    const to = { ...from, nodeId: 'b', type: 'target' as const };
    store.updateConnection({ ...start, toHandle: to, toNode: internal('b'), isValid: true });
    store.flush();
    expect(hb.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(hb.applyConnectionState.mock.calls[0]?.[0]).toMatchObject({
      toKey: 'b-target-null',
      isValid: true,
    });
    expect(hc.applyConnectionState).not.toHaveBeenCalled();

    // moving on to c: b (previous) and c (new)
    for (const h of [ha, hb, hc]) h.applyConnectionState.mockClear();
    store.updateConnection({
      ...start,
      toHandle: { ...to, nodeId: 'c' },
      toNode: internal('c'),
      isValid: true,
    });
    store.flush();
    expect(hb.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(hc.applyConnectionState).toHaveBeenCalledTimes(1);

    // ending the connection updates everybody
    for (const h of [ha, hb, hc]) h.applyConnectionState.mockClear();
    store.cancelConnection();
    store.flush();
    for (const h of [ha, hb, hc]) expect(h.applyConnectionState).toHaveBeenCalledTimes(1);
    expect(hub.state.inProgress).toBe(false);
    hub.detach();
  });

  it('tells a late handle the current state when it registers, and forgets unregistered ones', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const hub = new ConnectionHub();
    hub.attach(flow.store);
    const h = fakeHandle();
    hub.register('a-source-null', h);
    expect(h.applyConnectionState).toHaveBeenCalledWith(hub.state);
    hub.unregister('a-source-null', h);
    h.applyConnectionState.mockClear();
    flow.store.setState({ connectionClickStartHandle: { nodeId: 'a', type: 'source', id: null } });
    flow.store.flush();
    expect(h.applyConnectionState).not.toHaveBeenCalled();
    expect(hub.state.clickStart).toBe(true);
    hub.detach();
  });

  it('styles real handles during a drag connection', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 0)] });
    const src = handle(flow, 'a', 'source');
    const dst = handle(flow, 'b', 'target');
    const other = handle(flow, 'b', 'source');
    const from = centerOf(src);
    src.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: from.x,
        clientY: from.y,
      }),
    );
    src.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        composed: true,
        button: 0,
        clientX: from.x,
        clientY: from.y,
        view: window,
      }),
    );
    const to = centerOf(dst);
    src.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        composed: true,
        clientX: to.x,
        clientY: to.y,
        buttons: 1,
        view: window,
      }),
    );
    await waitFor(() => src.classList.contains('connectingfrom'));
    await waitFor(() => dst.classList.contains('connectingto') && dst.classList.contains('valid'));
    // strict mode: a source handle is no target while connecting from a source
    expect(other.classList.contains('connectionindicator')).toBe(false);
    expect(dst.classList.contains('connectionindicator')).toBe(true);
    src.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        composed: true,
        clientX: to.x,
        clientY: to.y,
        view: window,
      }),
    );
    await waitFor(() => !src.classList.contains('connectingfrom'));
    expect(flow.getEdges()).toHaveLength(1);
    expect(flow.store.getState().connectionMode).toBe(ConnectionMode.Strict);
  });
});

describe('<xy-handle> connecting', () => {
  it('a mouse drag from a source to a target handle adds an edge and emits events', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    const events: string[] = [];
    for (const t of ['connect-start', 'connect', 'connect-end'] as const) {
      flow.addEventListener(t, () => events.push(t));
    }
    const src = handle(flow, 'a', 'source');
    const dst = handle(flow, 'b', 'target');
    await dragMouse(src, centerOf(src), centerOf(dst));
    expect(events).toEqual(['connect-start', 'connect', 'connect-end']);
    expect(flow.getEdges()).toHaveLength(1);
    expect(flow.getEdges()[0]).toMatchObject({ source: 'a', target: 'b' });
    expect(flow.store.getState().connection.inProgress).toBe(false);
  });

  it('dropping on nothing ends the connection without an edge; connect-end carries the state', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    let end: { connectionState: { toHandle: unknown } } | null = null;
    flow.addEventListener('connect-end', (e) => {
      end = e.detail as never;
    });
    const src = handle(flow, 'a', 'source');
    const c = centerOf(src);
    await dragMouse(src, c, { x: c.x + 5, y: c.y + 200 });
    expect(flow.getEdges()).toHaveLength(0);
    expect(end).not.toBeNull();
    expect(end!.connectionState.toHandle).toBeNull();
  });

  it('isValidConnection on the flow can reject a connection', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 300, 100)],
      props: { isValidConnection: () => false },
    });
    const src = handle(flow, 'a', 'source');
    const dst = handle(flow, 'b', 'target');
    await dragMouse(src, centerOf(src), centerOf(dst));
    expect(flow.getEdges()).toHaveLength(0);
  });

  it('a connection drag does not start a click-connect afterwards (suppressNextClick)', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    const src = handle(flow, 'a', 'source');
    const c = centerOf(src);
    await dragMouse(src, c, { x: c.x + 5, y: c.y + 100 });
    // pointer capture makes the browser click the handle after the drag
    src.click();
    expect(flow.store.getState().connectionClickStartHandle).toBeNull();
    // the next real click works again
    src.click();
    expect(flow.store.getState().connectionClickStartHandle).toEqual({
      nodeId: 'a',
      type: 'source',
      id: null,
    });
  });

  it('click-connect: click a source then a target adds an edge', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    const events: string[] = [];
    flow.addEventListener('click-connect-start', () => events.push('start'));
    flow.addEventListener('click-connect-end', () => events.push('end'));
    handle(flow, 'a', 'source').click();
    expect(flow.store.getState().connectionClickStartHandle).toEqual({
      nodeId: 'a',
      type: 'source',
      id: null,
    });
    await waitFor(() => handle(flow, 'b', 'target').classList.contains('connectionindicator'));
    handle(flow, 'b', 'target').click();
    expect(flow.getEdges()).toHaveLength(1);
    expect(flow.store.getState().connectionClickStartHandle).toBeNull();
    expect(events).toEqual(['start', 'end']);
  });

  it('click-connect is off with connect-on-click="false"', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 300, 100)],
      attributes: { 'connect-on-click': 'false' },
    });
    handle(flow, 'a', 'source').click();
    expect(flow.store.getState().connectionClickStartHandle).toBeNull();
  });

  it('draws the connection line while dragging', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    const src = handle(flow, 'a', 'source');
    const c = centerOf(src);
    src.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: c.x,
        clientY: c.y,
      }),
    );
    src.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        composed: true,
        button: 0,
        clientX: c.x,
        clientY: c.y,
        view: window,
      }),
    );
    src.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        composed: true,
        clientX: c.x + 30,
        clientY: c.y + 80,
        buttons: 1,
        view: window,
      }),
    );
    const path = await waitFor(() => flow.renderRoot.querySelector('.lit-flow__connection-path'));
    expect(path.getAttribute('d')).toMatch(/^M/);
    src.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, view: window }));
    await waitFor(() => !flow.renderRoot.querySelector('.lit-flow__connectionline'));
  });

  it('emits handle-connect / handle-disconnect when edges change', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 100)] });
    const h = handle(flow, 'a', 'source');
    const log: string[] = [];
    h.addEventListener('handle-connect', () => log.push('connect'));
    h.addEventListener('handle-disconnect', () => log.push('disconnect'));
    await frames(2);
    flow.addEdges(edge('e', 'a', 'b'));
    await waitFor(() => log.includes('connect'));
    flow.setEdges([]);
    await waitFor(() => log.includes('disconnect'));
  });
});

describe('connection line renderer', () => {
  it('uses a custom renderer', async () => {
    const { svg } = await import('lit');
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 300, 100)],
      props: {
        connectionLineRenderer: (p) =>
          svg`<circle class="custom-line" cx=${p.toX} cy=${p.toY} r="4"></circle>`,
      },
    });
    const src = handle(flow, 'a', 'source');
    const c = centerOf(src);
    src.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: c.x,
        clientY: c.y,
      }),
    );
    src.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        composed: true,
        button: 0,
        clientX: c.x,
        clientY: c.y,
        view: window,
      }),
    );
    src.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        composed: true,
        clientX: c.x + 30,
        clientY: c.y + 80,
        buttons: 1,
        view: window,
      }),
    );
    await waitFor(() => flow.renderRoot.querySelector('.custom-line'));
    src.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, view: window }));
    await waitFor(() => !flow.renderRoot.querySelector('.custom-line'));
    void nodeEl;
  });
});
