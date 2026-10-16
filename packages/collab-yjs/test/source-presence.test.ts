import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';
import { YjsFlowSource } from '../src/yjs-flow-source.js';
import { Net, awarenessPair, client, meta, node } from './helpers.js';
import { vi } from 'vitest';

const user = (id: string) => ({ id, name: `User ${id}`, color: id === '1' ? '#f00' : '#00f' });

function pairWithPresence(nodes: Node[] = [node('a'), node('b')], edges: Edge[] = []) {
  const net = new Net();
  const d1 = net.add(new Y.Doc());
  const d2 = net.add(new Y.Doc());
  YjsFlowSource.populate(d1, { nodes, edges });
  net.syncAll();
  const [aw1, aw2] = awarenessPair([d1, d2]);
  const a = client(d1, { awareness: aw1!, user: user('1') });
  const b = client(d2, { awareness: aw2!, user: user('2') });
  return { net, a, b };
}

describe('presence in the source', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes the local selection and shows it on the other side', () => {
    const { a, b } = pairWithPresence();
    a.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: true }],
      meta('discrete', undefined, 'select'),
    );
    const remote = b.store.getState().nodes[0]!.remote;
    expect(remote?.selectedBy?.map((u) => u.name)).toEqual(['User 1']);
    expect(a.store.getState().nodes[0]!.remote).toBeUndefined();
    a.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: false }],
      meta('discrete', undefined, 'select'),
    );
    expect(b.store.getState().nodes[0]!.remote).toBeUndefined();
  });

  it('a live drag reaches the other client through awareness, the drop through the document', () => {
    const { a, b } = pairWithPresence();
    const bNodeBefore = b.store.getState().nodes[1]!;
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true }],
      meta('start', 'g'),
    );
    vi.advanceTimersByTime(20);
    let remote = b.store.getState().nodes[0]!;
    expect(remote.position).toEqual({ x: 30, y: 40 });
    expect(remote.remote?.draggingBy?.name).toBe('User 1');
    expect(b.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(b.store.getState().nodes[1]).toBe(bNodeBefore);
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 31, y: 41 }, dragging: true }],
      meta('live', 'g'),
    );
    vi.advanceTimersByTime(20);
    expect(b.store.getState().nodes[0]!.position).toEqual({ x: 31, y: 41 });
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 32, y: 42 }, dragging: false }],
      meta('end', 'g'),
    );
    remote = b.store.getState().nodes[0]!;
    expect(remote.position).toEqual({ x: 32, y: 42 });
    expect(remote.remote).toBeUndefined();
    expect(b.source.toObject().nodes[0]!.position).toEqual({ x: 32, y: 42 });
  });

  it('soft locks drop moves of a node another user is dragging', () => {
    const { a, b } = pairWithPresence();
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true }],
      meta('start', 'ga'),
    );
    vi.advanceTimersByTime(20);
    // b tries to move the same node: dropped
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 5, y: 5 }, dragging: true }],
      meta('start', 'gb'),
    );
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 6, y: 6 }, dragging: true }],
      meta('live', 'gb'),
    );
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 7, y: 7 }, dragging: false }],
      meta('end', 'gb'),
    );
    expect(b.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(b.store.getState().nodes[0]!.position).toEqual({ x: 30, y: 40 });
    // other nodes are free; selection is not blocked
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'b', position: { x: 1, y: 1 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    expect(b.source.toObject().nodes[1]!.position).toEqual({ x: 1, y: 1 });
    b.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: true }],
      meta('discrete', undefined, 'select'),
    );
    expect(b.store.getState().nodes[0]!.selected).toBe(true);
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: false }],
      meta('end', 'ga'),
    );
    // after the drop the lock is gone
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 9, y: 9 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    expect(b.source.toObject().nodes[0]!.position).toEqual({ x: 9, y: 9 });
  });

  it('softLocks: false lets both write', () => {
    const net = new Net();
    const d1 = net.add(new Y.Doc());
    const d2 = net.add(new Y.Doc());
    YjsFlowSource.populate(d1, { nodes: [node('a')], edges: [] });
    net.syncAll();
    const [aw1, aw2] = awarenessPair([d1, d2]);
    const a = client(d1, { awareness: aw1!, user: user('1') });
    const b = client(d2, { awareness: aw2!, user: user('2'), softLocks: false });
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true }],
      meta('start', 'ga'),
    );
    vi.advanceTimersByTime(20);
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 5, y: 5 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    expect(b.source.toObject().nodes[0]!.position).toEqual({ x: 5, y: 5 });
  });

  it('remote resize shows size and resizingBy', () => {
    const { a, b } = pairWithPresence([node('a', { width: 10, height: 10 })]);
    a.store.triggerNodeChanges(
      [
        { type: 'position', id: 'a', position: { x: -4, y: -4 } },
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 44, height: 55 },
          setAttributes: true,
          resizing: true,
        },
      ],
      meta('start', 'r', 'resize'),
    );
    vi.advanceTimersByTime(20);
    expect(b.store.getState().nodes[0]).toMatchObject({
      width: 44,
      height: 55,
      position: { x: -4, y: -4 },
    });
    expect(b.store.getState().nodes[0]!.remote?.resizingBy?.name).toBe('User 1');
  });

  it('marks nodes a remote user just added, for 1.5 s', () => {
    const { a, b } = pairWithPresence();
    a.store.triggerNodeChanges(
      [{ type: 'add', item: node('n') }],
      meta('discrete', undefined, 'api'),
    );
    const added = b.store.getState().nodes.find((n) => n.id === 'n')!;
    expect(added.remote?.addedBy?.name).toBe('User 1');
    expect(a.store.getState().nodes.find((n) => n.id === 'n')!.remote).toBeUndefined();
    vi.advanceTimersByTime(1600);
    expect(b.store.getState().nodes.find((n) => n.id === 'n')!.remote).toBeUndefined();
  });

  it('publishes the connection in progress in flow coordinates and the viewport', () => {
    const { a, b } = pairWithPresence([node('a'), node('b')]);
    a.store.setState({ transform: [100, 50, 2] });
    a.store.setState({
      connection: {
        inProgress: true,
        isValid: null,
        from: { x: 0, y: 0 },
        fromHandle: {
          id: 'h',
          type: 'source',
          nodeId: 'a',
          position: 'right' as never,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        fromPosition: 'right' as never,
        fromNode: a.store.getState().nodeLookup.get('a') ?? ({ id: 'a' } as never),
        to: { x: 300, y: 250 },
        toHandle: null,
        toPosition: 'left' as never,
        toNode: null,
        pointer: { x: 300, y: 250 },
      } as never,
    });
    a.store.flush();
    vi.advanceTimersByTime(250);
    const remote = [...b.source.presence!.remotes().values()][0]!;
    expect(remote.connection).toEqual({
      fromNode: 'a',
      fromHandle: 'h',
      fromType: 'source',
      to: { x: 100, y: 100 },
    });
    expect(remote.viewport).toEqual({ x: 100, y: 50, zoom: 2 });
    a.store.cancelConnection();
    a.store.flush();
    vi.advanceTimersByTime(50);
    expect([...b.source.presence!.remotes().values()][0]!.connection).toBeUndefined();
  });

  it('destroy clears presence', () => {
    const { a, b } = pairWithPresence();
    a.source.destroy();
    expect(b.source.presence!.remotes().size).toBe(0);
  });
});
