import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { PRESENCE_FIELD, PresenceChannel } from '../src/awareness.js';
import { RemoteState } from '../src/remote-state.js';

const user = (id: string) => ({ id, name: `User ${id}`, color: '#ff0000' });

/** Two awareness instances that relay their updates to each other. */
function pair() {
  const a = new Awareness(new Y.Doc());
  const b = new Awareness(new Y.Doc());
  const relay = (from: Awareness, to: Awareness) =>
    from.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        applyAwarenessUpdate(
          to,
          encodeAwarenessUpdate(from, [...added, ...updated, ...removed]),
          'relay',
        );
      },
    );
  relay(a, b);
  relay(b, a);
  return { a, b };
}

describe('PresenceChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes user and conventional user field', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    expect(a.getLocalState()?.user).toEqual({ name: 'User 1', color: '#ff0000' });
    expect([...peer.remotes().keys()]).toEqual([a.clientID]);
    expect(peer.remotes().get(a.clientID)?.user.id).toBe('1');
    expect(ch.remotes().get(b.clientID)?.user.id).toBe('2');
    ch.destroy();
    peer.destroy();
  });

  it('excludes self and states without a user', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    b.setLocalState({ somethingElse: true });
    expect(ch.remotes().size).toBe(0);
    ch.destroy();
  });

  it('throttles the cursor to 33 ms, trailing', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    for (let i = 1; i <= 10; i++) ch.setCursor({ x: i, y: i });
    expect(peer.remotes().get(a.clientID)?.cursor).toBeUndefined();
    vi.advanceTimersByTime(32);
    expect(peer.remotes().get(a.clientID)?.cursor).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(peer.remotes().get(a.clientID)?.cursor).toEqual({ x: 10, y: 10 });
    ch.setCursor(null);
    expect(peer.remotes().get(a.clientID)?.cursor).toBeUndefined();
    ch.destroy();
    peer.destroy();
  });

  it('throttles drag with the frame and clears at once', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    ch.setDrag({ ids: ['n'], positions: { n: { x: 1, y: 1 } } });
    ch.setDrag({ ids: ['n'], positions: { n: { x: 2, y: 2 } } });
    expect(peer.remotes().get(a.clientID)?.drag).toBeUndefined();
    vi.advanceTimersByTime(16);
    expect(peer.remotes().get(a.clientID)?.drag?.positions.n).toEqual({ x: 2, y: 2 });
    ch.setDrag({ ids: ['n'], positions: { n: { x: 3, y: 3 } } });
    ch.setDrag(null);
    vi.advanceTimersByTime(100);
    expect(peer.remotes().get(a.clientID)?.drag).toBeUndefined();
    ch.destroy();
    peer.destroy();
  });

  it('throttles the viewport to 200 ms', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    ch.setViewport({ x: 1, y: 2, zoom: 3 });
    vi.advanceTimersByTime(199);
    expect(peer.remotes().get(a.clientID)?.viewport).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(peer.remotes().get(a.clientID)?.viewport).toEqual({ x: 1, y: 2, zoom: 3 });
    ch.destroy();
    peer.destroy();
  });

  it('sets selection, tool, resize and connection', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    ch.setSelection({ nodes: ['a'], edges: [] });
    ch.setTool('pen');
    ch.setResize({ id: 'a', width: 1, height: 2, position: { x: 0, y: 0 } });
    ch.setConnection({ fromNode: 'a', fromHandle: null, fromType: 'source', to: { x: 1, y: 1 } });
    vi.advanceTimersByTime(20);
    const remote = peer.remotes().get(a.clientID)!;
    expect(remote.selection).toEqual({ nodes: ['a'], edges: [] });
    expect(remote.tool).toBe('pen');
    expect(remote.resize?.width).toBe(1);
    expect(remote.connection?.fromNode).toBe('a');
    ch.setSelection({ nodes: [], edges: [] });
    expect(peer.remotes().get(a.clientID)?.selection).toBeUndefined();
    ch.destroy();
    peer.destroy();
  });

  it('subscribe fires for remote changes only', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    const listener = vi.fn();
    const off = ch.subscribe(listener);
    ch.setTool('own');
    expect(listener).not.toHaveBeenCalled();
    peer.setTool('theirs');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    peer.setTool('again');
    expect(listener).toHaveBeenCalledTimes(1);
    ch.destroy();
    peer.destroy();
  });

  it('destroy clears the fields and cancels timers', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    ch.setCursor({ x: 1, y: 1 });
    ch.destroy();
    vi.advanceTimersByTime(100);
    expect(a.getLocalState()?.[PRESENCE_FIELD]).toBeNull();
    expect(peer.remotes().size).toBe(0);
    ch.setCursor({ x: 2, y: 2 });
    vi.advanceTimersByTime(100);
    expect(peer.remotes().size).toBe(0);
    peer.destroy();
  });

  it('clearTransient drops the cursor only when hidden, more on pagehide', () => {
    const { a, b } = pair();
    const ch = new PresenceChannel(a, user('1'));
    const peer = new PresenceChannel(b, user('2'));
    ch.setCursor(null);
    ch.setTool('t');
    // apply through public API with null-throttle path: use selection + connection for visibility
    ch.setConnection({ fromNode: 'a', fromHandle: null, fromType: 'source', to: { x: 0, y: 0 } });
    vi.advanceTimersByTime(20);
    ch.clearTransient(false);
    expect(peer.remotes().get(a.clientID)?.connection).toBeDefined();
    ch.clearTransient(true);
    expect(peer.remotes().get(a.clientID)?.connection).toBeUndefined();
    expect(peer.remotes().get(a.clientID)?.tool).toBe('t');
    ch.destroy();
    peer.destroy();
  });
});

describe('RemoteState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('derives per-node views and reports dirty ids', () => {
    const { a, b } = pair();
    const mine = new PresenceChannel(a, user('1'));
    const theirs = new PresenceChannel(b, user('2'));
    const state = new RemoteState(mine);
    expect(state.update().size).toBe(0);

    theirs.setSelection({ nodes: ['x', 'y'], edges: [] });
    expect([...state.update()].sort()).toEqual(['x', 'y']);
    expect(state.get('x')?.meta.selectedBy?.[0]).toMatchObject({
      clientId: b.clientID,
      id: '2',
      name: 'User 2',
    });
    expect(state.update().size).toBe(0);

    theirs.setDrag({ ids: ['x'], positions: { x: { x: 5, y: 6 } } });
    vi.advanceTimersByTime(20);
    expect([...state.update()]).toEqual(['x']);
    expect(state.get('x')?.position).toEqual({ x: 5, y: 6 });
    expect(state.lockedBy('x')?.id).toBe('2');
    expect(state.lockedBy('y')).toBeUndefined();

    theirs.setResize({ id: 'y', width: 7, height: 8, position: { x: 1, y: 1 } });
    vi.advanceTimersByTime(20);
    state.update();
    expect(state.get('y')?.size).toEqual({ width: 7, height: 8 });

    theirs.setSelection(null);
    theirs.setDrag(null);
    theirs.setResize(null);
    expect([...state.update()].sort()).toEqual(['x', 'y']);
    expect(state.get('x')).toBeUndefined();
    mine.destroy();
    theirs.destroy();
    state.destroy();
  });

  it('addedBy expires', () => {
    const { a, b } = pair();
    const mine = new PresenceChannel(a, user('1'));
    const theirs = new PresenceChannel(b, user('2'));
    const state = new RemoteState(mine);
    state.update();
    const expired = vi.fn();
    state.markAdded('n', state.userOf(b.clientID)!, expired);
    expect([...state.update()]).toEqual(['n']);
    expect(state.get('n')?.meta.addedBy?.name).toBe('User 2');
    vi.advanceTimersByTime(1500);
    expect(expired).toHaveBeenCalledWith('n');
    expect([...state.update()]).toEqual(['n']);
    expect(state.get('n')).toBeUndefined();
    mine.destroy();
    theirs.destroy();
    state.destroy();
  });
});
