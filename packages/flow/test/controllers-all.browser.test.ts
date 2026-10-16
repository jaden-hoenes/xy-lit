import { LitElement, html } from 'lit';
import { FlowStore } from '@xy-lit/store';
import type { Connection, Edge, FlowStore as Store, Node } from '@xy-lit/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConnectionController,
  EdgesController,
  FlowInstanceController,
  InternalNodeController,
  NodeIdController,
  NodesController,
  NodesDataController,
  NodesInitializedController,
  StoreApiController,
  ViewportController,
} from '../src/controllers/flow-controllers.js';
import {
  HandleConnectionsController,
  NodeConnectionsController,
} from '../src/controllers/connections.js';
import {
  OnSelectionChangeController,
  OnViewportChangeController,
} from '../src/controllers/events.js';
import { KeyPressController } from '../src/controllers/key-press.js';
import { FlowNodeElement } from '../src/nodes/flow-node-element.js';
import { cleanup as cleanupFlows, frames, mountFlow, node, nodeEl, waitFor } from './helpers.js';

const n = (id: string, x = 0): Node => ({ id, position: { x, y: 0 }, data: { v: id } });
const e = (id: string, source: string, target: string): Edge => ({ id, source, target });

const attached: Element[] = [];
afterEach(() => {
  for (const el of attached.splice(0)) el.remove();
  cleanupFlows();
});

/** A host that counts its updates and renders nothing of interest. */
function makeHost<T extends Record<string, unknown>>(
  build: (host: LitElement) => T,
): { host: LitElement & { updates: number }; ctl: T } {
  const tag = `test-host-${Math.random().toString(36).slice(2)}`;
  let ctl: T | undefined;
  class Host extends LitElement {
    updates = 0;
    constructor() {
      super();
      ctl = build(this);
    }
    override updated(): void {
      this.updates++;
    }
    override render() {
      return html``;
    }
  }
  customElements.define(tag, Host);
  const host = document.createElement(tag) as Host;
  attached.push(host);
  return { host, ctl: ctl ?? (undefined as never) };
}

async function mount(host: LitElement): Promise<void> {
  document.body.append(host);
  await host.updateComplete;
}

const settle = async (store: Store): Promise<void> => {
  store.flush();
  await frames(1);
};

describe('data controllers (explicit store)', () => {
  it('Nodes/Edges/Viewport/Instance/StoreApi', async () => {
    const store = new FlowStore({ nodes: [n('a'), n('b', 100)], edges: [e('ab', 'a', 'b')] });
    const { host, ctl } = makeHost((h) => ({
      nodes: new NodesController(h as never, { store }),
      edges: new EdgesController(h as never, { store }),
      viewport: new ViewportController(h as never, { store }),
      instance: new FlowInstanceController(h as never, { store }),
      api: new StoreApiController(h as never, { store }),
    }));
    await mount(host);
    expect(ctl.nodes.value.map((x) => x.id)).toEqual(['a', 'b']);
    expect(ctl.edges.value.map((x) => x.id)).toEqual(['ab']);
    expect(ctl.instance.value).toBe(store.instance);
    expect(ctl.api.value).toBe(store);
    expect(ctl.viewport.value).toEqual({ x: 0, y: 0, zoom: 1 });

    const before = host.updates;
    store.setState({ transform: [10, 20, 2] });
    await settle(store);
    await host.updateComplete;
    expect(ctl.viewport.value).toEqual({ x: 10, y: 20, zoom: 2 });
    expect(host.updates).toBe(before + 1);

    // an unrelated state change does not update the host
    const quiet = host.updates;
    store.setState({ ariaLiveMessage: 'x' });
    await settle(store);
    await host.updateComplete;
    expect(host.updates).toBe(quiet);

    store.instance.addNodes(n('c', 200));
    await settle(store);
    expect(ctl.nodes.value.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(host.updates).toBeGreaterThan(quiet);
  });

  it('detaches on disconnect and re-attaches on reconnect', async () => {
    const store = new FlowStore({ nodes: [n('a')] });
    const { host, ctl } = makeHost((h) => ({ nodes: new NodesController(h as never, { store }) }));
    await mount(host);
    host.remove();
    store.instance.addNodes(n('b'));
    await settle(store);
    const count = host.updates;
    store.instance.addNodes(n('c'));
    await settle(store);
    expect(host.updates).toBe(count);
    document.body.append(host);
    await host.updateComplete;
    expect(ctl.nodes.value.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    store.instance.addNodes(n('d'));
    await settle(store);
    expect(ctl.nodes.value).toHaveLength(4);
  });

  it('InternalNode, NodesData, NodesInitialized, Connection', async () => {
    const store = new FlowStore({ nodes: [n('a'), n('b', 100)] });
    const id = 'a';
    const { host, ctl } = makeHost((h) => ({
      internal: new InternalNodeController(h as never, () => id, { store }),
      one: new NodesDataController(h as never, 'a', { store }),
      many: new NodesDataController(h as never, () => ['a', 'b', 'missing'], { store }),
      init: new NodesInitializedController(h as never, { store }),
      initHidden: new NodesInitializedController(h as never, { includeHiddenNodes: true, store }),
      connection: new ConnectionController(h as never, undefined, { store }),
      inProgress: new ConnectionController(h as never, (c) => c.inProgress, { store }),
    }));
    await mount(host);
    expect(ctl.internal.value?.id).toBe('a');
    expect(ctl.one.value).toEqual({ id: 'a', type: undefined, data: { v: 'a' } });
    expect(ctl.many.value).toHaveLength(2);
    expect(ctl.init.value).toBe(false);
    expect(ctl.initHidden.value).toBe(false);
    expect(ctl.inProgress.value).toBe(false);
    expect(ctl.connection.value.inProgress).toBe(false);

    // data change: new data object -> update; same data -> none
    const before = host.updates;
    store.instance.updateNodeData('a', { v: 'changed' });
    await settle(store);
    await host.updateComplete;
    expect((ctl.one.value as { data: { v: string } }).data.v).toBe('changed');
    expect(host.updates).toBeGreaterThan(before);

    // in-place position mutation by the engine is picked up
    const node = store.getState().nodeLookup.get('a')!;
    const next = host.updates;
    node.internals.positionAbsolute.x = 77;
    store.setState({ lookupVersion: store.getState().lookupVersion + 1 });
    await settle(store);
    await host.updateComplete;
    expect(host.updates).toBeGreaterThan(next);
    expect(ctl.internal.value?.internals.positionAbsolute.x).toBe(77);
  });

  it('NodesData with one id returns null for a missing node', async () => {
    const store = new FlowStore({ nodes: [n('a')] });
    const { host, ctl } = makeHost((h) => ({
      none: new NodesDataController(h as never, 'zzz', { store }),
    }));
    await mount(host);
    expect(ctl.none.value).toBeNull();
  });
});

describe('connection controllers', () => {
  it('NodeConnections / HandleConnections list connections and report changes', async () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 100), n('c', 200)],
      edges: [e('ab', 'a', 'b')],
    });
    const added: Connection[][] = [];
    const removed: Connection[][] = [];
    const { host, ctl } = makeHost((h) => ({
      all: new NodeConnectionsController(h as never, {
        id: 'a',
        store,
        onConnect: (c) => added.push(c),
        onDisconnect: (c) => removed.push(c),
      }),
      targets: new NodeConnectionsController(h as never, { id: 'b', handleType: 'target', store }),
      sources: new NodeConnectionsController(h as never, { id: 'b', handleType: 'source', store }),
      handle: new HandleConnectionsController(h as never, { type: 'source', nodeId: 'a', store }),
    }));
    await mount(host);
    expect(ctl.all.value.map((c) => c.edgeId)).toEqual(['ab']);
    expect(ctl.targets.value).toHaveLength(1);
    expect(ctl.sources.value).toHaveLength(0);
    expect(ctl.handle.value).toHaveLength(1);
    expect(added).toEqual([]);

    store.instance.addEdges(e('ac', 'a', 'c'));
    await settle(store);
    expect(ctl.all.value.map((c) => c.edgeId).sort()).toEqual(['ab', 'ac']);
    expect(added).toHaveLength(1);
    expect(added[0]?.[0]).toMatchObject({ source: 'a', target: 'c' });

    // identity is stable while nothing changed
    const list = ctl.all.value;
    await settle(store);
    expect(ctl.all.value).toBe(list);

    store.instance.deleteElements({ edges: [{ id: 'ab' }] });
    await settle(store);
    expect(ctl.all.value.map((c) => c.edgeId)).toEqual(['ac']);
    expect(removed).toHaveLength(1);
  });

  it('a FlowNodeElement reads its own node id through context (the spec usage example)', async () => {
    class SumNode extends FlowNodeElement<Node<{ value: number }>> {
      id$ = new NodeIdController(this);
      inputs = new NodeConnectionsController(this, { handleType: 'target' });
      values = new NodesDataController(this, () => this.inputs.value.map((c) => c.source));
      override render() {
        const total = (Array.isArray(this.values.value) ? this.values.value : []).reduce(
          (s, d) => s + ((d.data as { value?: number }).value ?? 0),
          0,
        );
        return html`<xy-handle type="target" position="left"></xy-handle
          ><span class="total">${total}</span>`;
      }
    }
    customElements.define('test-sum-node', SumNode);
    const flow = await mountFlow({
      nodes: [
        node('x', 0, 0, { data: { value: 2 } }),
        node('y', 0, 100, { data: { value: 5 } }),
        node('sum', 300, 50, { type: 'sum', data: { value: 0 } }),
      ],
      edges: [
        { id: 'xs', source: 'x', target: 'sum' },
        { id: 'ys', source: 'y', target: 'sum' },
      ],
      props: { nodeTypes: { sum: SumNode } },
    });
    const total = () => nodeEl(flow, 'sum').querySelector('.total')?.textContent;
    await waitFor(() => total() === '7');
    expect((nodeEl(flow, 'sum').querySelector('test-sum-node') as SumNode).id$.value).toBe('sum');
    flow.updateNodeData('x', { value: 10 });
    await waitFor(() => total() === '15');
    flow.deleteElements({ edges: [{ id: 'ys' }] });
    await waitFor(() => total() === '10');
  });
});

describe('event controllers', () => {
  it('OnSelectionChange registers while connected', async () => {
    const store = new FlowStore({ nodes: [n('a'), n('b')] });
    const calls: string[][] = [];
    const { host } = makeHost((h) => ({
      sel: new OnSelectionChangeController(
        h as never,
        (s) => calls.push(s.nodes.map((x) => x.id)),
        { store },
      ),
    }));
    await mount(host);
    expect(store.selectionChangeHandlers.size).toBe(1);
    store.addSelectedNodes(['a']);
    await settle(store);
    expect(calls).toEqual([['a']]);
    host.remove();
    expect(store.selectionChangeHandlers.size).toBe(0);
    store.addSelectedNodes(['b']);
    await settle(store);
    expect(calls).toHaveLength(1);
  });

  it('OnViewportChange follows move events of the flow from context', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const seen: string[] = [];
    const tag = `test-vp-${Math.random().toString(36).slice(2)}`;
    class VpHost extends LitElement {
      ctl = new OnViewportChangeController(this, {
        onStart: () => seen.push('start'),
        onChange: (v) => seen.push(`change:${Math.round(v.zoom * 10)}`),
        onEnd: () => seen.push('end'),
      });
    }
    customElements.define(tag, VpHost);
    const host = document.createElement(tag);
    flow.append(host);
    await frames(1);
    await flow.setViewport({ x: 0, y: 0, zoom: 1.5 }, { duration: 100 });
    await waitFor(() => seen.includes('end'));
    expect(seen[0]).toBe('start');
    expect(seen.some((s) => s.startsWith('change:'))).toBe(true);
    host.remove();
    seen.length = 0;
    await flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 50 });
    await frames(3);
    expect(seen).toEqual([]);
  });
});

describe('KeyPressController', () => {
  const key = (
    type: 'keydown' | 'keyup',
    k: string,
    init: KeyboardEventInit = {},
    target: EventTarget = window,
  ) =>
    target.dispatchEvent(
      new KeyboardEvent(type, {
        key: k,
        code: k.length === 1 ? `Key${k.toUpperCase()}` : k,
        bubbles: true,
        cancelable: true,
        composed: true,
        ...init,
      }),
    );

  it('tracks a key on the shared tracker and updates the host on change only', async () => {
    const { host, ctl } = makeHost((h) => ({ a: new KeyPressController(h as never, 'a') }));
    await mount(host);
    expect(ctl.a.value).toBe(false);
    const before = host.updates;
    key('keydown', 'a');
    await host.updateComplete;
    expect(ctl.a.value).toBe(true);
    key('keydown', 'a'); // repeat: no flip
    await host.updateComplete;
    expect(host.updates).toBe(before + 1);
    key('keyup', 'a');
    await host.updateComplete;
    expect(ctl.a.value).toBe(false);
    host.remove();
    key('keydown', 'a');
    expect(ctl.a.value).toBe(false);
  });

  it('supports combinations and ignores plain keys typed in inputs', async () => {
    const { host, ctl } = makeHost((h) => ({
      combo: new KeyPressController(h as never, 'Control+s'),
      plain: new KeyPressController(h as never, 'x'),
    }));
    await mount(host);
    key('keydown', 'Control', { ctrlKey: true, code: 'ControlLeft' });
    key('keydown', 's', { ctrlKey: true, code: 'KeyS' });
    expect(ctl.combo.value).toBe(true);
    key('keyup', 's', { ctrlKey: true, code: 'KeyS' });
    key('keyup', 'Control', { code: 'ControlLeft' });
    expect(ctl.combo.value).toBe(false);

    const input = document.createElement('input');
    attached.push(input);
    document.body.append(input);
    key('keydown', 'x', {}, input);
    expect(ctl.plain.value).toBe(false);
    key('keydown', 'x');
    expect(ctl.plain.value).toBe(true);
  });

  it('with a target element, listens on it only', async () => {
    const target = document.createElement('div');
    attached.push(target);
    document.body.append(target);
    const { host, ctl } = makeHost((h) => ({
      k: new KeyPressController(h as never, 'k', { target }),
    }));
    await mount(host);
    key('keydown', 'k');
    expect(ctl.k.value).toBe(false);
    key('keydown', 'k', {}, target);
    expect(ctl.k.value).toBe(true);
    key('keyup', 'k', {}, target);
    expect(ctl.k.value).toBe(false);
  });
});

describe('controllers without a flow', () => {
  it('give neutral values and warn once for NodeConnections without an id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { host, ctl } = makeHost((h) => ({
      nodes: new NodesController(h as never),
      viewport: new ViewportController(h as never),
      instance: new FlowInstanceController(h as never),
      conns: new NodeConnectionsController(h as never),
    }));
    await mount(host);
    await Promise.resolve();
    expect(ctl.nodes.value).toEqual([]);
    expect(ctl.viewport.value.zoom).toBe(1);
    expect(ctl.instance.value).toBeUndefined();
    expect(ctl.conns.value).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
