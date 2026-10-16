import { afterEach, describe, expect, it } from 'vitest';
import { LocalHistory, groupSelection, installDropIntoGroup, ungroup } from '../src/index.js';
import { cleanup, dragNode, edge, mountFlow, node, pos, waitFor } from './helpers.js';

afterEach(cleanup);

const sized = { width: 100, height: 50 };
const abs = (flow: Awaited<ReturnType<typeof mountFlow>>, id: string) =>
  flow.store.getState().nodeLookup.get(id)!.internals.positionAbsolute;

describe('groupSelection', () => {
  it('wraps the selected root nodes: bounds plus padding, relative positions, group first', async () => {
    const flow = await mountFlow({
      nodes: [
        node('x', 900, 900, sized),
        node('a', 100, 100, { ...sized, selected: true }),
        node('b', 300, 200, { ...sized, selected: true }),
      ],
      edges: [edge('ab', 'a', 'b')],
    });
    const id = groupSelection(flow, { id: 'g' });
    expect(id).toBe('g');
    const group = flow.nodes.find((n) => n.id === 'g')!;
    expect(group.type).toBe('group');
    expect(group.position).toEqual({ x: 80, y: 80 });
    expect(group.width).toBe(340);
    expect(group.height).toBe(190);
    expect(group.selected).toBe(true);
    const a = flow.nodes.find((n) => n.id === 'a')!;
    expect(a.parentId).toBe('g');
    expect(a.position).toEqual({ x: 20, y: 20 });
    expect(a.selected).toBe(false);
    expect(flow.nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 220, y: 120 });
    // untouched node, and the group sits before its children
    expect(flow.nodes.find((n) => n.id === 'x')!.parentId).toBeUndefined();
    const order = flow.nodes.map((n) => n.id);
    expect(order.indexOf('g')).toBeLessThan(order.indexOf('a'));
    expect(order.indexOf('g')).toBeLessThan(order.indexOf('b'));
    // nodes stay where they are on screen
    expect(abs(flow, 'a')).toEqual({ x: 100, y: 100 });
    expect(abs(flow, 'b')).toEqual({ x: 300, y: 200 });
    expect(flow.edges).toHaveLength(1);
  });

  it('supports type, data, padding and generated ids; returns null without a selection', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0, { ...sized, selected: true })] });
    const id = groupSelection(flow, { type: 'lane', padding: 5, data: { label: 'L' } })!;
    expect(id).toMatch(/^group-/);
    const group = flow.nodes.find((n) => n.id === id)!;
    expect(group).toMatchObject({ type: 'lane', data: { label: 'L' }, width: 110, height: 60 });
    expect(group.position).toEqual({ x: -5, y: -5 });
    flow.store.resetSelectedElements();
    expect(groupSelection(flow)).toBeNull();
  });

  it('ignores selected nodes that already have a parent', async () => {
    const flow = await mountFlow({
      nodes: [
        node('p', 0, 0, { type: 'group', width: 300, height: 200 }),
        node('k', 10, 10, { ...sized, parentId: 'p', selected: true }),
      ],
    });
    expect(groupSelection(flow)).toBeNull();
  });

  it('is one history step', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 100, 100, { ...sized, selected: true }),
        node('b', 300, 200, { ...sized, selected: true }),
      ],
    });
    const history = new LocalHistory(flow);
    groupSelection(flow, { id: 'g' });
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(flow.nodes[0]!.parentId).toBeUndefined();
    expect(pos(flow, 'a')).toEqual({ x: 100, y: 100 });
    expect(flow.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['a', 'b']);
    history.redo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['g', 'a', 'b']);
  });
});

describe('ungroup', () => {
  it('frees the children at absolute positions and removes the group', async () => {
    const flow = await mountFlow({
      nodes: [
        node('g', 80, 80, { type: 'group', width: 340, height: 190 }),
        node('a', 20, 20, { ...sized, parentId: 'g' }),
        node('b', 220, 120, { ...sized, parentId: 'g' }),
      ],
    });
    expect(ungroup(flow, 'g')).toEqual(['a', 'b']);
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(flow.nodes[0]!.parentId).toBeUndefined();
    expect(pos(flow, 'a')).toEqual({ x: 100, y: 100 });
    expect(pos(flow, 'b')).toEqual({ x: 300, y: 200 });
    expect(flow.nodes.every((n) => n.selected)).toBe(true);
  });

  it('hands the children to the grandparent when the group is nested', async () => {
    const flow = await mountFlow({
      nodes: [
        node('outer', 100, 100, { type: 'group', width: 600, height: 400 }),
        node('g', 50, 60, { type: 'group', width: 300, height: 200, parentId: 'outer' }),
        node('a', 10, 20, { ...sized, parentId: 'g' }),
      ],
    });
    ungroup(flow, 'g');
    const a = flow.nodes.find((n) => n.id === 'a')!;
    expect(a.parentId).toBe('outer');
    expect(a.position).toEqual({ x: 60, y: 80 });
    expect(abs(flow, 'a')).toEqual({ x: 160, y: 180 });
  });

  it('returns an empty list for an unknown group, and round-trips with groupSelection', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 100, 100, { ...sized, selected: true }),
        node('b', 300, 200, { ...sized, selected: true }),
      ],
    });
    expect(ungroup(flow, 'nope')).toEqual([]);
    const history = new LocalHistory(flow);
    const id = groupSelection(flow)!;
    ungroup(flow, id);
    expect(history.undoSize).toBe(2);
    expect(pos(flow, 'a')).toEqual({ x: 100, y: 100 });
    expect(pos(flow, 'b')).toEqual({ x: 300, y: 200 });
  });
});

describe('installDropIntoGroup', () => {
  const make = () =>
    mountFlow({
      // the node comes before the group in the array: reparenting has to reorder
      nodes: [
        node('n', 450, 80, sized),
        node('g', 50, 50, { type: 'group', width: 300, height: 250 }),
      ],
    });

  it('drops a node into a group (parentId, relative position, array order) and back out', async () => {
    const flow = await make();
    const history = new LocalHistory(flow);
    const stop = installDropIntoGroup(flow);
    // XYDrag swallows the first of 8 steps: 8/7 of the wanted distance
    await dragNode(flow, 'n', -343, 114, 8);
    await waitFor(() => flow.nodes.find((n) => n.id === 'n')?.parentId === 'g');
    const n = flow.nodes.find((x) => x.id === 'n')!;
    expect(n.position.x).toBeGreaterThan(90);
    expect(n.position.x).toBeLessThan(110);
    const order = flow.nodes.map((x) => x.id);
    expect(order.indexOf('g')).toBeLessThan(order.indexOf('n'));
    // the node did not move on screen when it was reparented
    const a = abs(flow, 'n');
    expect(a.x - 50).toBeCloseTo(n.position.x, 5);
    // drag and reparenting are one step
    expect(history.undoSize).toBe(1);

    // fully out again
    await dragNode(flow, 'n', 457, 0, 8);
    await waitFor(() => !flow.nodes.find((x) => x.id === 'n')?.parentId);
    expect(abs(flow, 'n').x).toBeGreaterThan(350);
    expect(history.undoSize).toBe(2);

    history.undo();
    expect(flow.nodes.find((x) => x.id === 'n')!.parentId).toBe('g');
    history.undo();
    expect(flow.nodes.find((x) => x.id === 'n')!.parentId).toBeUndefined();
    expect(pos(flow, 'n')).toEqual({ x: 450, y: 80 });
    expect(flow.nodes.map((x) => x.id)).toEqual(['n', 'g']);
    stop();
  });

  it('does nothing for non-group parents, and stops when disposed', async () => {
    const flow = await mountFlow({
      nodes: [
        node('n', 450, 80, sized),
        node('box', 50, 50, { type: 'default', width: 300, height: 250 }),
      ],
    });
    const stop = installDropIntoGroup(flow);
    await dragNode(flow, 'n', -343, 114, 8);
    expect(flow.nodes.find((x) => x.id === 'n')!.parentId).toBeUndefined();
    stop();

    const flow2 = await make();
    const stop2 = installDropIntoGroup(flow2);
    stop2();
    await dragNode(flow2, 'n', -343, 114, 8);
    expect(flow2.nodes.find((x) => x.id === 'n')!.parentId).toBeUndefined();
  });
});
