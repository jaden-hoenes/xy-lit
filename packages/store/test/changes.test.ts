import { describe, expect, it } from 'vitest';
import {
  applyEdgeChanges,
  applyNodeChanges,
  createSelectionChange,
  elementToRemoveChange,
  getElementsDiffChanges,
  getSelectionChanges,
} from '../src/changes.js';
import type { Edge } from '../src/types/edges.js';
import type { InternalNode, Node } from '../src/types/nodes.js';

const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});
const edge = (id: string, source = 'a', target = 'b'): Edge => ({ id, source, target });

describe('applyNodeChanges', () => {
  it('keeps identity of untouched nodes and copies changed ones', () => {
    const nodes = [node('a'), node('b')];
    const next = applyNodeChanges([{ id: 'a', type: 'select', selected: true }], nodes);
    expect(next[0]).not.toBe(nodes[0]);
    expect(next[0]?.selected).toBe(true);
    expect(next[1]).toBe(nodes[1]);
    expect(nodes[0]?.selected).toBeUndefined();
  });

  it('applies position changes (position and dragging independently)', () => {
    const nodes = [node('a', { dragging: true })];
    const moved = applyNodeChanges(
      [{ id: 'a', type: 'position', position: { x: 5, y: 6 } }],
      nodes,
    );
    expect(moved[0]?.position).toEqual({ x: 5, y: 6 });
    expect(moved[0]?.dragging).toBe(true);
    const dropped = applyNodeChanges([{ id: 'a', type: 'position', dragging: false }], moved);
    expect(dropped[0]?.position).toEqual({ x: 5, y: 6 });
    expect(dropped[0]?.dragging).toBe(false);
  });

  it('applies dimension changes to measured and optionally width/height', () => {
    const nodes = [node('a')];
    const measured = applyNodeChanges(
      [{ id: 'a', type: 'dimensions', dimensions: { width: 10, height: 20 } }],
      nodes,
    );
    expect(measured[0]?.measured).toEqual({ width: 10, height: 20 });
    expect(measured[0]?.width).toBeUndefined();

    const both = applyNodeChanges(
      [
        {
          id: 'a',
          type: 'dimensions',
          dimensions: { width: 10, height: 20 },
          setAttributes: true,
          resizing: true,
        },
      ],
      nodes,
    );
    expect(both[0]).toMatchObject({ width: 10, height: 20, resizing: true });

    const onlyWidth = applyNodeChanges(
      [
        {
          id: 'a',
          type: 'dimensions',
          dimensions: { width: 10, height: 20 },
          setAttributes: 'width',
        },
      ],
      nodes,
    );
    expect(onlyWidth[0]?.width).toBe(10);
    expect(onlyWidth[0]?.height).toBeUndefined();
  });

  it('applies several changes to one node on a single copy', () => {
    const nodes = [node('a')];
    const next = applyNodeChanges(
      [
        { id: 'a', type: 'select', selected: true },
        { id: 'a', type: 'position', position: { x: 1, y: 1 }, dragging: true },
      ],
      nodes,
    );
    expect(next[0]).toMatchObject({ selected: true, position: { x: 1, y: 1 }, dragging: true });
  });

  it('adds nodes at the end, or at an index', () => {
    const nodes = [node('a'), node('b')];
    const appended = applyNodeChanges([{ type: 'add', item: node('c') }], nodes);
    expect(appended.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    const inserted = applyNodeChanges([{ type: 'add', item: node('c'), index: 1 }], nodes);
    expect(inserted.map((n) => n.id)).toEqual(['a', 'c', 'b']);
  });

  it('adds after removals so indices refer to the result of the other changes', () => {
    const nodes = [node('a'), node('b')];
    const next = applyNodeChanges(
      [
        { type: 'add', item: node('c'), index: 1 },
        { id: 'a', type: 'remove' },
      ],
      nodes,
    );
    expect(next.map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('copies added items', () => {
    const item = node('c');
    const next = applyNodeChanges([{ type: 'add', item }], []);
    expect(next[0]).toEqual(item);
    expect(next[0]).not.toBe(item);
  });

  it('remove wins over other changes for the same id, in either order', () => {
    const nodes = [node('a'), node('b')];
    const first = applyNodeChanges(
      [
        { id: 'a', type: 'remove' },
        { id: 'a', type: 'select', selected: true },
      ],
      nodes,
    );
    expect(first.map((n) => n.id)).toEqual(['b']);
    const second = applyNodeChanges(
      [
        { id: 'a', type: 'select', selected: true },
        { id: 'a', type: 'remove' },
      ],
      nodes,
    );
    expect(second.map((n) => n.id)).toEqual(['b']);
  });

  it('replaces an element with a copy of the item', () => {
    const nodes = [node('a'), node('b')];
    const item = node('a', { data: { label: 'new' } });
    const next = applyNodeChanges([{ id: 'a', type: 'replace', item }], nodes);
    expect(next[0]).toEqual(item);
    expect(next[0]).not.toBe(item);
    expect(next[1]).toBe(nodes[1]);
  });

  it('ignores changes for unknown ids', () => {
    const nodes = [node('a')];
    const next = applyNodeChanges([{ id: 'zzz', type: 'select', selected: true }], nodes);
    expect(next).toEqual(nodes);
    expect(next[0]).toBe(nodes[0]);
  });
});

describe('applyEdgeChanges', () => {
  it('applies select, add, replace and remove', () => {
    const edges = [edge('e1'), edge('e2'), edge('e3')];
    const next = applyEdgeChanges(
      [
        { id: 'e1', type: 'select', selected: true },
        { id: 'e2', type: 'remove' },
        { id: 'e3', type: 'replace', item: edge('e3', 'x', 'y') },
        { type: 'add', item: edge('e4') },
      ],
      edges,
    );
    expect(next.map((e) => e.id)).toEqual(['e1', 'e3', 'e4']);
    expect(next[0]?.selected).toBe(true);
    expect(next[1]).toMatchObject({ source: 'x', target: 'y' });
  });
});

describe('selection helpers', () => {
  it('createSelectionChange builds a select change', () => {
    expect(createSelectionChange('a', true)).toEqual({ id: 'a', type: 'select', selected: true });
  });

  it('getSelectionChanges returns only real changes and skips never-selected unselected items', () => {
    const items = new Map([
      ['a', node('a')], // never had `selected`, stays unselected -> no change
      ['b', node('b', { selected: false })], // becomes selected
      ['c', node('c', { selected: true })], // becomes unselected
      ['d', node('d', { selected: true })], // stays selected -> no change
    ]);
    const changes = getSelectionChanges(items, new Set(['b', 'd']));
    expect(changes).toEqual([
      { id: 'b', type: 'select', selected: true },
      { id: 'c', type: 'select', selected: false },
    ]);
    expect(items.get('b')?.selected).toBe(false); // not mutated by default
  });

  it('getSelectionChanges mutates the items when asked (drag-start hack)', () => {
    const items = new Map([
      ['b', node('b', { selected: false })],
      ['c', node('c', { selected: true })],
    ]);
    getSelectionChanges(items, new Set(['b']), true);
    expect(items.get('b')?.selected).toBe(true);
    expect(items.get('c')?.selected).toBe(false);
  });

  it('elementToRemoveChange builds a remove change', () => {
    expect(elementToRemoveChange(node('a'))).toEqual({ id: 'a', type: 'remove' });
    expect(elementToRemoveChange(edge('e'))).toEqual({ id: 'e', type: 'remove' });
  });
});

describe('getElementsDiffChanges', () => {
  const internal = (n: Node): InternalNode =>
    ({
      ...n,
      measured: {},
      internals: { positionAbsolute: n.position, z: 0, userNode: n },
    }) as InternalNode;

  it('produces add (with index), replace and remove for nodes', () => {
    const a = node('a');
    const b = node('b');
    const lookup = new Map([
      ['a', internal(a)],
      ['b', internal(b)],
    ]);
    const a2 = { ...a, selected: true };
    const c = node('c');
    const changes = getElementsDiffChanges({ items: [a2, c], lookup });
    expect(changes).toEqual([
      { id: 'a', item: a2, type: 'replace' },
      { item: c, type: 'add', index: 1 },
      { id: 'b', type: 'remove' },
    ]);
  });

  it('produces no change when the user nodes are identical', () => {
    const a = node('a');
    const lookup = new Map([['a', internal(a)]]);
    expect(getElementsDiffChanges({ items: [a], lookup })).toEqual([]);
  });

  it('works for edges (lookup holds user edges)', () => {
    const e1 = edge('e1');
    const e2 = edge('e2');
    const lookup = new Map<string, Edge>([
      ['e1', e1],
      ['e2', e2],
    ]);
    const e1b = { ...e1, animated: true };
    const changes = getElementsDiffChanges({ items: [e1b, edge('e3')], lookup });
    expect(changes).toEqual([
      { id: 'e1', item: e1b, type: 'replace' },
      { item: edge('e3'), type: 'add', index: 1 },
      { id: 'e2', type: 'remove' },
    ]);
  });

  it('treats undefined items as empty', () => {
    const lookup = new Map([['a', internal(node('a'))]]);
    expect(getElementsDiffChanges({ items: undefined, lookup })).toEqual([
      { id: 'a', type: 'remove' },
    ]);
  });
});
