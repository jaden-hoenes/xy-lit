import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';
import {
  EDGE_LOCAL_KEYS,
  NODE_LOCAL_KEYS,
  SchemaError,
  cloneJson,
  fromYEdge,
  fromYNode,
  getMaps,
  getOrder,
  jsonEqual,
  toYEdge,
  toYNode,
} from '../src/schema.js';
import { HEAL, LOCAL, MIGRATION, SERVER } from '../src/origins.js';

/** Integrate a prelim map into a doc so reads behave like in production. */
function integrate(y: Y.Map<unknown>, kind: 'nodes' | 'edges' = 'nodes'): Y.Map<unknown> {
  const doc = new Y.Doc();
  const maps = getMaps(doc);
  maps[kind].set('x', y);
  return maps[kind].get('x') as Y.Map<unknown>;
}

describe('origins', () => {
  it('has the documented values', () => {
    expect(typeof LOCAL).toBe('symbol');
    expect(HEAL).toBe('xy-lit/heal');
    expect(MIGRATION).toBe('xy-lit/migration');
    expect(SERVER).toBe('server');
  });
});

describe('node <-> Y.Map', () => {
  const full: Node = {
    id: 'n1',
    type: 'card',
    position: { x: 10, y: -20.5 },
    data: { label: 'Hi', nested: { a: [1, 2, { b: null }] }, n: 0, flag: false },
    width: 120,
    height: 60,
    initialWidth: 100,
    initialHeight: 50,
    parentId: 'p',
    extent: 'parent',
    expandParent: true,
    zIndex: 3,
    hidden: false,
    draggable: true,
    selectable: false,
    connectable: true,
    deletable: false,
    focusable: true,
    dragHandle: '.h',
    sourcePosition: 'right' as Node['sourcePosition'],
    targetPosition: 'left' as Node['targetPosition'],
    class: 'a b',
    style: 'color: red',
    ariaLabel: 'x',
    ariaRole: 'group',
    origin: [0.5, 0.5],
    handles: [{ type: 'source', x: 1, y: 2, position: 'right' as never }],
    domAttributes: { 'data-x': '1' },
    custom: { anything: 1 },
  } as Node;

  it('round trips every key', () => {
    const y = integrate(toYNode(full, 'a0'));
    expect(fromYNode(y)).toEqual(full);
    expect(getOrder(y)).toBe('a0');
  });

  it('stores position atomically as a plain object', () => {
    const y = integrate(toYNode(full, 'a0'));
    expect(y.get('position')).toEqual({ x: 10, y: -20.5 });
    expect(y.has('x')).toBe(false);
  });

  it('never writes local keys', () => {
    const node = {
      ...full,
      selected: true,
      dragging: true,
      resizing: true,
      measured: { width: 1, height: 2 },
      remote: { selectedBy: [] },
      internals: {},
    } as unknown as Node;
    const y = integrate(toYNode(node, 'a0'));
    for (const key of NODE_LOCAL_KEYS) expect(y.has(key)).toBe(false);
    expect(fromYNode(y)).toEqual(full);
  });

  it('deletes instead of writing undefined', () => {
    const y = integrate(
      toYNode(
        { id: 'n', position: { x: 0, y: 0 }, data: { a: undefined, b: 1 }, width: undefined },
        'a0',
      ),
    );
    expect(y.has('width')).toBe(false);
    expect(y.has('type')).toBe(false);
    expect((y.get('data') as Y.Map<unknown>).has('a')).toBe(false);
    expect(fromYNode(y).data).toEqual({ b: 1 });
  });

  it('stores data as a Y.Map and richText keys as Y.Text', () => {
    const y = integrate(
      toYNode(
        { id: 'n', type: 'note', position: { x: 0, y: 0 }, data: { body: 'hello', t: 'x' } },
        'a0',
        ['body'],
      ),
    );
    const data = y.get('data') as Y.Map<unknown>;
    expect(data).toBeInstanceOf(Y.Map);
    expect(data.get('body')).toBeInstanceOf(Y.Text);
    expect(data.get('t')).toBe('x');
    expect(fromYNode(y).data).toEqual({ body: 'hello', t: 'x' });
  });

  it('deep-clones plain values', () => {
    const nested = { a: { b: 1 } };
    const y = integrate(toYNode({ id: 'n', position: { x: 0, y: 0 }, data: { nested } }, 'a0'));
    nested.a.b = 2;
    expect(fromYNode(y).data).toEqual({ nested: { a: { b: 1 } } });
  });

  it('rejects functions with XYL10', () => {
    const bad = { id: 'n', position: { x: 0, y: 0 }, data: { fn: () => 1 } } as unknown as Node;
    expect(() => toYNode(bad, 'a0')).toThrow(SchemaError);
    expect(() => toYNode(bad, 'a0')).toThrow(/XYL10/);
    expect(() => toYNode({ ...bad, data: {}, style: (() => 1) as never }, 'a0')).toThrow(/XYL10/);
  });

  it('tolerates missing data/position when reading', () => {
    const y = integrate(new Y.Map<unknown>([['id', 'n']]));
    expect(fromYNode(y)).toEqual({ id: 'n', data: {}, position: { x: 0, y: 0 } });
  });

  it('merges per data key across replicas', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    getMaps(a).nodes.set(
      'n',
      toYNode({ id: 'n', position: { x: 0, y: 0 }, data: { l: 'x', m: 'y' } }, 'a0'),
    );
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    (getMaps(a).nodes.get('n')!.get('data') as Y.Map<unknown>).set('l', 'A');
    (getMaps(b).nodes.get('n')!.get('data') as Y.Map<unknown>).set('m', 'B');
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(fromYNode(getMaps(a).nodes.get('n')!).data).toEqual({ l: 'A', m: 'B' });
    expect(fromYNode(getMaps(b).nodes.get('n')!).data).toEqual({ l: 'A', m: 'B' });
  });
});

describe('edge <-> Y.Map', () => {
  const full: Edge = {
    id: 'e1',
    type: 'smoothstep',
    source: 'a',
    target: 'b',
    sourceHandle: 'out',
    targetHandle: 'in',
    data: { weight: 3, nested: { x: [1] } },
    label: 'L',
    startLabel: 's',
    endLabel: 'e',
    labelStyle: 'color: red',
    animated: true,
    hidden: false,
    deletable: true,
    selectable: true,
    focusable: true,
    reconnectable: 'source',
    zIndex: 2,
    markerStart: 'm',
    markerEnd: { type: 'arrowclosed' as never, color: '#f00' },
    style: 'stroke: red',
    class: 'x',
    interactionWidth: 30,
    ariaLabel: 'edge',
    ariaRole: 'group',
    offset: 4,
    pathOptions: { curvature: 0.5 },
    domAttributes: { 'data-e': '1' },
  } as Edge;

  it('round trips every key', () => {
    const y = integrate(toYEdge(full, 'a1'), 'edges');
    expect(fromYEdge(y)).toEqual(full);
    expect(getOrder(y)).toBe('a1');
  });

  it('never writes selected and omits data when absent', () => {
    const y = integrate(
      toYEdge({ id: 'e', source: 'a', target: 'b', selected: true }, 'a0'),
      'edges',
    );
    for (const key of EDGE_LOCAL_KEYS) expect(y.has(key)).toBe(false);
    expect(y.has('data')).toBe(false);
    expect(fromYEdge(y)).toEqual({ id: 'e', source: 'a', target: 'b' });
  });
});

describe('cloneJson / jsonEqual', () => {
  it('clones and compares structurally', () => {
    const v = { a: [1, { b: 'x' }], c: null };
    expect(cloneJson(v)).toEqual(v);
    expect(cloneJson(v)).not.toBe(v);
    expect(jsonEqual(v, { a: [1, { b: 'x' }], c: null })).toBe(true);
    expect(jsonEqual(v, { a: [1, { b: 'y' }], c: null })).toBe(false);
    expect(jsonEqual([1], { 0: 1 })).toBe(false);
    expect(jsonEqual(1, '1')).toBe(false);
  });

  it('drops undefined members', () => {
    expect(cloneJson({ a: undefined, b: [undefined] })).toEqual({ b: [null] });
  });

  it('rejects class instances', () => {
    expect(() => cloneJson(new Date())).toThrow(/XYL10/);
  });
});
