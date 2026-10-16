import { afterEach, describe, expect, it } from 'vitest';
import { ArraySource } from '@xy-lit/store';
import type { ChangeMeta } from '@xy-lit/store';
import { LocalHistory, animateNodePositions } from '../src/index.js';
import { cleanup, mountFlow, node, pos } from './helpers.js';

afterEach(cleanup);

const make = () => mountFlow({ nodes: [node('a', 0, 0), node('b', 100, 0), node('c', 0, 100)] });

const record = (flow: Awaited<ReturnType<typeof make>>) => {
  const metas: { phase: string; origin: string; gestureId?: string; ids: string[] }[] = [];
  flow.addEventListener('nodes-change', (e) => {
    const m: ChangeMeta = e.detail.meta;
    if (m.origin !== 'layout') return;
    metas.push({
      phase: m.phase,
      origin: m.origin,
      gestureId: m.gestureId,
      ids: e.detail.changes.map((c) => ('id' in c ? c.id : '')),
    });
  });
  return metas;
};

describe('animateNodePositions', () => {
  it('sends start, live and end phases of one gesture and reaches the targets', async () => {
    const flow = await make();
    const metas = record(flow);
    const done = await animateNodePositions(
      flow,
      new Map([
        ['a', { x: 200, y: 100 }],
        ['b', { x: 100, y: 300 }],
      ]),
      { duration: 120 },
    );
    expect(done).toBe(true);
    expect(metas[0]!.phase).toBe('start');
    expect(metas.at(-1)!.phase).toBe('end');
    expect(metas.slice(1, -1).every((m) => m.phase === 'live')).toBe(true);
    expect(metas.slice(1, -1).length).toBeGreaterThan(0);
    expect(new Set(metas.map((m) => m.gestureId)).size).toBe(1);
    expect(metas.every((m) => m.origin === 'layout')).toBe(true);
    expect(pos(flow, 'a')).toEqual({ x: 200, y: 100 });
    expect(pos(flow, 'b')).toEqual({ x: 100, y: 300 });
    expect(pos(flow, 'c')).toEqual({ x: 0, y: 100 });
    expect(flow.store.getState().nodeLookup.get('a')?.dragging).toBeFalsy();
  });

  it('passes through intermediate positions and honours a custom easing', async () => {
    const flow = await make();
    const seen: number[] = [];
    flow.addEventListener('nodes-change', (e) => {
      for (const c of e.detail.changes) {
        if (c.type === 'position' && c.position) seen.push(c.position.x);
      }
    });
    await animateNodePositions(flow, { a: { x: 100, y: 0 } }, { duration: 100, easing: (t) => t });
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(100);
    expect(seen.some((x) => x > 0 && x < 100)).toBe(true);
    expect([...seen].sort((p, q) => p - q)).toEqual(seen);
  });

  it('duration 0 is one discrete update', async () => {
    const flow = await make();
    const metas = record(flow);
    await animateNodePositions(flow, { a: { x: 50, y: 50 } }, { duration: 0 });
    expect(metas.map((m) => m.phase)).toEqual(['discrete']);
    expect(pos(flow, 'a')).toEqual({ x: 50, y: 50 });
  });

  it('a new animation for the same node cancels the old one, which ends where it was', async () => {
    const flow = await make();
    const metas = record(flow);
    const first = animateNodePositions(flow, { a: { x: 1000, y: 0 } }, { duration: 2000 });
    await new Promise((r) => setTimeout(r, 150));
    const second = animateNodePositions(flow, { a: { x: 0, y: 500 } }, { duration: 80 });
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(pos(flow, 'a')).toEqual({ x: 0, y: 500 });
    const phases = metas.map((m) => m.phase);
    expect(phases.filter((p) => p === 'start')).toHaveLength(2);
    expect(phases.filter((p) => p === 'end')).toHaveLength(2);
    expect(flow.store.getState().activeGesture).toBeNull();
  });

  it('does not cancel animations of other nodes', async () => {
    const flow = await make();
    const first = animateNodePositions(flow, { a: { x: 300, y: 0 } }, { duration: 150 });
    const second = animateNodePositions(flow, { c: { x: 0, y: 300 } }, { duration: 150 });
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(pos(flow, 'a')).toEqual({ x: 300, y: 0 });
    expect(pos(flow, 'c')).toEqual({ x: 0, y: 300 });
  });

  it('skips unknown ids and nodes already at the target', async () => {
    const flow = await make();
    const metas = record(flow);
    expect(
      await animateNodePositions(
        flow,
        { nope: { x: 1, y: 1 }, a: { x: 0, y: 0 } },
        { duration: 50 },
      ),
    ).toBe(true);
    expect(metas).toHaveLength(0);
  });

  it('survives a node removed mid-animation', async () => {
    const flow = await make();
    const done = animateNodePositions(
      flow,
      { a: { x: 400, y: 0 }, b: { x: 400, y: 100 } },
      { duration: 150 },
    );
    await new Promise((r) => setTimeout(r, 40));
    await flow.deleteElements({ nodes: [{ id: 'a' }] });
    expect(await done).toBe(true);
    expect(pos(flow, 'b')).toEqual({ x: 400, y: 100 });
  });

  it('is one history step', async () => {
    const flow = await make();
    const history = new LocalHistory(flow);
    await animateNodePositions(
      flow,
      { a: { x: 200, y: 0 }, b: { x: 300, y: 0 } },
      { duration: 100 },
    );
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(pos(flow, 'a')).toEqual({ x: 0, y: 0 });
    expect(pos(flow, 'b')).toEqual({ x: 100, y: 0 });
  });

  it('with a source that has a transient overlay, only end commits (one commit)', async () => {
    const flow = await make();
    // a stand-in for the Yjs source: frames of phase start/live are overlay only, end commits
    let commits = 0;
    class OverlaySource extends ArraySource {
      override applyNodeChanges(
        changes: Parameters<ArraySource['applyNodeChanges']>[0],
        meta: ChangeMeta,
      ) {
        if (meta.phase === 'start' || meta.phase === 'live') return;
        if (changes.some((c) => c.type === 'position')) commits++;
        super.applyNodeChanges(changes, meta);
      }
    }
    flow.source = new OverlaySource([node('a', 0, 0)], []);
    await flow.updateComplete;
    await animateNodePositions(flow, { a: { x: 100, y: 0 } }, { duration: 100 });
    expect(commits).toBe(1);
    expect(pos(flow, 'a')).toEqual({ x: 100, y: 0 });
  });
});
