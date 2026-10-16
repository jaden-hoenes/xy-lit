import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node, NodeChange } from '@xy-lit/store';
import { HEAL, LOCAL } from '../src/origins.js';
import { getMaps, toYNode } from '../src/schema.js';
import { YjsFlowSource, applyTextDiff } from '../src/yjs-flow-source.js';
import { Net, client, edge, ids, meta, node } from './helpers.js';

function seeded(nodes: Node[] = [], edges: Edge[] = []): Y.Doc {
  const doc = new Y.Doc();
  YjsFlowSource.populate(doc, { nodes, edges });
  return doc;
}

/** Two clients on connected docs with the same starting content. */
function twoClients(nodes: Node[] = [node('a'), node('b')], edges: Edge[] = [], options = {}) {
  const net = new Net();
  const d1 = net.add(seeded(nodes, edges));
  const d2 = net.add(new Y.Doc());
  net.syncAll();
  return { net, a: client(d1, options), b: client(d2, options) };
}

const countUpdates = (doc: Y.Doc) => {
  const origins: unknown[] = [];
  doc.on('update', (_u: Uint8Array, origin: unknown) => origins.push(origin));
  return origins;
};

describe('YjsFlowSource basics', () => {
  it('materialises populated data before attach and through the store', () => {
    const { store } = client(seeded([node('a'), node('b')], [edge('e', 'a', 'b')]));
    expect(ids(store.getState().nodes)).toEqual(['a', 'b']);
    expect(ids(store.getState().edges)).toEqual(['e']);
  });

  it('applies local select/measure through the overlay without document writes', () => {
    const c = client(seeded([node('a')]));
    const origins = countUpdates(c.doc);
    c.store.triggerNodeChanges(
      [
        { type: 'select', id: 'a', selected: true },
        { type: 'dimensions', id: 'a', dimensions: { width: 100, height: 50 } },
      ],
      meta('discrete', undefined, 'select'),
    );
    c.store.flush();
    expect(origins).toEqual([]);
    expect(c.store.getState().nodes[0]).toMatchObject({
      selected: true,
      measured: { width: 100, height: 50 },
    });
    expect(c.source.toObject().nodes[0]).toEqual(node('a'));
  });

  it('writes nothing for a drag until the end, then one LOCAL write', () => {
    const c = client(seeded([node('a')]));
    const origins = countUpdates(c.doc);
    const pos = (x: number, dragging: boolean): NodeChange[] => [
      { type: 'position', id: 'a', position: { x, y: x }, dragging },
    ];
    c.store.triggerNodeChanges(pos(1, true), meta('start', 'g'));
    c.store.triggerNodeChanges(pos(2, true), meta('live', 'g'));
    c.store.triggerNodeChanges(pos(3, true), meta('live', 'g'));
    c.store.flush();
    expect(origins).toEqual([]);
    expect(c.store.getState().nodes[0]!.position).toEqual({ x: 3, y: 3 });
    expect(c.store.getState().nodes[0]!.dragging).toBe(true);
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
    c.store.triggerNodeChanges(pos(4, false), meta('end', 'g'));
    c.store.flush();
    expect(origins).toEqual([LOCAL]);
    expect(c.store.getState().nodes[0]).toMatchObject({
      position: { x: 4, y: 4 },
      dragging: false,
    });
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 4, y: 4 });
  });

  it('commits the live position at the end when the change has none', () => {
    const c = client(seeded([node('a')]));
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 7, y: 8 }, dragging: true }],
      meta('start', 'g'),
    );
    c.store.triggerNodeChanges([{ type: 'position', id: 'a', dragging: false }], meta('end', 'g'));
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 7, y: 8 });
  });

  it('livePositions: document writes every position', () => {
    const c = client(seeded([node('a')]), { livePositions: 'document' });
    const origins = countUpdates(c.doc);
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 1, y: 1 }, dragging: true }],
      meta('start', 'g'),
    );
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 2, y: 2 }, dragging: true }],
      meta('live', 'g'),
    );
    expect(origins).toHaveLength(2);
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 2, y: 2 });
  });

  it('keyboard moves (discrete) write at once', () => {
    const c = client(seeded([node('a')]));
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 5, y: 0 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 5, y: 0 });
  });

  it('resize: live size stays local, end commits size and position', () => {
    const c = client(seeded([node('a', { width: 10, height: 10 })]));
    const origins = countUpdates(c.doc);
    const m = (phase: 'start' | 'live' | 'end') => meta(phase, 'r', 'resize');
    c.store.triggerNodeChanges(
      [
        { type: 'position', id: 'a', position: { x: -5, y: -5 } },
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 30, height: 40 },
          setAttributes: true,
          resizing: true,
        },
      ],
      m('start'),
    );
    c.store.triggerNodeChanges(
      [
        { type: 'position', id: 'a', position: { x: -9, y: -9 } },
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 50, height: 60 },
          setAttributes: true,
          resizing: true,
        },
      ],
      m('live'),
    );
    c.store.flush();
    expect(origins).toEqual([]);
    expect(c.store.getState().nodes[0]).toMatchObject({
      width: 50,
      height: 60,
      position: { x: -9, y: -9 },
      resizing: true,
    });
    c.store.triggerNodeChanges([{ type: 'dimensions', id: 'a', resizing: false }], m('end'));
    c.store.flush();
    expect(origins).toEqual([LOCAL]);
    expect(c.source.toObject().nodes[0]).toMatchObject({
      width: 50,
      height: 60,
      position: { x: -9, y: -9 },
    });
    expect(c.store.getState().nodes[0]!.resizing).toBe(false);
  });

  it('setAttributes at discrete phase writes width/height, honouring "width"', () => {
    const c = client(seeded([node('a', { width: 10, height: 10 })]));
    c.store.triggerNodeChanges(
      [
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 99, height: 98 },
          setAttributes: 'width',
        },
      ],
      meta('discrete', undefined, 'api'),
    );
    expect(c.source.toObject().nodes[0]).toMatchObject({ width: 99, height: 10 });
  });
});

describe('add, remove, replace', () => {
  it('adds nodes and edges with increasing order; local fields go to the overlay', () => {
    const c = client(seeded([node('a')]));
    c.store.triggerNodeChanges(
      [
        { type: 'add', item: node('b', { selected: true, measured: { width: 1, height: 1 } }) },
        { type: 'add', item: node('c') },
      ],
      meta('discrete', undefined, 'api'),
    );
    c.store.triggerEdgeChanges(
      [{ type: 'add', item: edge('e', 'a', 'b') }],
      meta('discrete', undefined, 'connect'),
    );
    c.store.flush();
    expect(ids(c.store.getState().nodes)).toEqual(['a', 'b', 'c']);
    expect(c.store.getState().nodes[1]).toMatchObject({
      selected: true,
      measured: { width: 1, height: 1 },
    });
    expect(getMaps(c.doc).nodes.get('b')!.has('selected')).toBe(false);
    expect(ids(c.store.getState().edges)).toEqual(['e']);
  });

  it('adds at an index between neighbours, several in one batch keep their order', () => {
    const c = client(seeded([node('a'), node('b')]));
    c.store.triggerNodeChanges(
      [
        { type: 'add', item: node('x'), index: 1 },
        { type: 'add', item: node('y'), index: 2 },
        { type: 'add', item: node('z'), index: 0 },
      ],
      meta('discrete', undefined, 'api'),
    );
    expect(ids(c.source.nodes)).toEqual(['z', 'a', 'x', 'y', 'b']);
  });

  it('reports XYL10 for values that cannot be stored and skips the node', () => {
    const c = client(seeded([node('a')]));
    c.store.triggerNodeChanges(
      [{ type: 'add', item: node('bad', { data: { fn: () => 1 } as never }) }],
      meta('discrete', undefined, 'api'),
    );
    expect(ids(c.source.nodes)).toEqual(['a']);
    expect(c.errors[0]?.code).toBe('XYL10');
  });

  it('remove deletes connected edges and descendants', () => {
    const c = client(
      seeded(
        [
          node('p'),
          node('kid', { parentId: 'p' }),
          node('grand', { parentId: 'kid' }),
          node('other'),
        ],
        [
          edge('e1', 'p', 'other'),
          edge('e2', 'grand', 'other'),
          edge('e3', 'other', 'other', { sourceHandle: 'x' }),
        ],
      ),
    );
    c.store.triggerNodeChanges(
      [{ type: 'remove', id: 'p' }],
      meta('discrete', undefined, 'delete'),
    );
    expect(ids(c.source.nodes)).toEqual(['other']);
    expect(ids(c.source.edges)).toEqual(['e3']);
    expect([...getMaps(c.doc).edges.keys()]).toEqual(['e3']);
  });

  it('replace writes only the changed keys', () => {
    const c = client(seeded([node('a', { data: { label: 'x', keep: 1 }, style: 'color: red' })]));
    const before = c.store.getState().nodes[0]!;
    const writes: string[] = [];
    getMaps(c.doc).nodes.observeDeep((events) => {
      for (const e of events)
        for (const k of e.changes.keys.keys()) writes.push(`${e.path.join('/')}:${k}`);
    });
    c.store.triggerNodeChanges(
      [
        {
          type: 'replace',
          id: 'a',
          item: { ...before, data: { label: 'y', keep: 1 }, style: 'color: red', class: 'k' },
        },
      ],
      meta('discrete', undefined, 'api'),
    );
    expect(writes.sort()).toEqual(['a/data:label', 'a:class']);
    expect(c.source.toObject().nodes[0]).toMatchObject({
      data: { label: 'y', keep: 1 },
      class: 'k',
      style: 'color: red',
    });
  });

  it('replace deletes removed keys and data keys', () => {
    const c = client(seeded([node('a', { data: { a: 1, b: 2 }, style: 's' })]));
    const before = c.store.getState().nodes[0]!;
    const { style: _s, ...rest } = before;
    void _s;
    c.store.triggerNodeChanges(
      [{ type: 'replace', id: 'a', item: { ...rest, data: { a: 1 } } }],
      meta('discrete', undefined, 'api'),
    );
    const got = c.source.toObject().nodes[0]!;
    expect(got.data).toEqual({ a: 1 });
    expect('style' in got).toBe(false);
  });

  it('replace of an edge diffs too', () => {
    const c = client(seeded([node('a'), node('b')], [edge('e', 'a', 'b', { label: 'L' })]));
    const before = c.store.getState().edges[0]!;
    c.store.triggerEdgeChanges(
      [{ type: 'replace', id: 'e', item: { ...before, label: 'M', animated: true } }],
      meta('discrete', undefined, 'api'),
    );
    expect(c.source.toObject().edges[0]).toMatchObject({ label: 'M', animated: true });
  });

  it('a replace does not persist a remote live drag position', async () => {
    const c = client(seeded([node('a')]));
    const live = { ...c.store.getState().nodes[0]!, position: { x: 50, y: 50 } };
    // item equal to what the user saw except for data
    c.store.triggerNodeChanges(
      [{ type: 'replace', id: 'a', item: { ...live, position: { x: 0, y: 0 }, data: { n: 1 } } }],
      meta('discrete', undefined, 'api'),
    );
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });
});

describe('updateNodeData', () => {
  it('writes only the patched keys (undefined deletes)', () => {
    const c = client(seeded([node('a', { data: { label: 'x', n: 1, gone: true } })]));
    const writes: string[] = [];
    getMaps(c.doc).nodes.observeDeep((events) => {
      for (const e of events)
        for (const k of e.changes.keys.keys()) writes.push(`${e.path.join('/')}:${k}`);
    });
    c.store.instance.updateNodeData('a', { label: 'y', gone: undefined });
    expect(writes.sort()).toEqual(['a/data:gone', 'a/data:label']);
    expect(c.source.toObject().nodes[0]!.data).toEqual({ label: 'y', n: 1 });
    expect(c.store.getState().nodes[0]!.data).toEqual({ label: 'y', n: 1 });
  });

  it('works for edges and ignores unknown ids', () => {
    const c = client(seeded([node('a'), node('b')], [edge('e', 'a', 'b', { data: { w: 1 } })]));
    c.store.instance.updateEdgeData('e', { w: 2, extra: 'x' });
    expect(c.source.toObject().edges[0]!.data).toEqual({ w: 2, extra: 'x' });
    c.source.updateNodeData('missing', { a: 1 }, meta('discrete'));
    expect(ids(c.source.nodes)).toEqual(['a', 'b']);
  });

  it('rich text keys are Y.Text and edited with a minimal diff', () => {
    const doc = new Y.Doc();
    YjsFlowSource.populate(
      doc,
      { nodes: [node('n', { type: 'note', data: { body: 'hello world' } })], edges: [] },
      { richText: { note: ['body'] } },
    );
    const c = client(doc, { richText: { note: ['body'] } });
    const yData = getMaps(doc).nodes.get('n')!.get('data') as Y.Map<unknown>;
    const text = yData.get('body') as Y.Text;
    expect(text).toBeInstanceOf(Y.Text);
    const deltas: unknown[] = [];
    text.observe((e) => deltas.push(e.delta));
    c.store.instance.updateNodeData('n', { body: 'hello brave world' });
    expect(text.toString()).toBe('hello brave world');
    expect(deltas).toEqual([[{ retain: 6 }, { insert: 'brave ' }]]);
    expect(c.store.getState().nodes[0]!.data.body).toBe('hello brave world');
  });

  it('applyTextDiff handles replace, delete and surrogate pairs', () => {
    const t = new Y.Doc().getText('t');
    t.insert(0, 'a😀b');
    applyTextDiff(t, 'a😁b');
    expect(t.toString()).toBe('a😁b');
    applyTextDiff(t, '');
    expect(t.toString()).toBe('');
    applyTextDiff(t, 'xyz');
    applyTextDiff(t, 'xz');
    expect(t.toString()).toBe('xz');
  });
});

describe('transact and undo', () => {
  it('one drag is one undo step, selection is restored', () => {
    const c = client(seeded([node('a'), node('b')]));
    const history = c.source.history!;
    expect(history.canUndo()).toBe(false);
    c.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: true }],
      meta('discrete', undefined, 'select'),
    );
    const m = (phase: 'start' | 'live' | 'end') => meta(phase, 'g');
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 1, y: 1 }, dragging: true }],
      m('start'),
    );
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 2, y: 2 }, dragging: true }],
      m('live'),
    );
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 3, y: 3 }, dragging: false }],
      m('end'),
    );
    expect(history.canUndo()).toBe(true);
    history.undo();
    c.store.flush();
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(c.store.getState().nodes[0]!.selected).toBe(true);
    history.redo();
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 3, y: 3 });
  });

  it('two drags are two undo steps even when quick', () => {
    const c = client(seeded([node('a')]));
    for (const [g, x] of [
      ['g1', 1],
      ['g2', 2],
    ] as const) {
      c.store.triggerNodeChanges(
        [{ type: 'position', id: 'a', position: { x, y: 0 }, dragging: true }],
        meta('start', g),
      );
      c.store.triggerNodeChanges(
        [{ type: 'position', id: 'a', position: { x, y: 0 }, dragging: false }],
        meta('end', g),
      );
    }
    c.source.history!.undo();
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 1, y: 0 });
    c.source.history!.undo();
    expect(c.source.toObject().nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('transact groups several applies into one undo step and one notification', () => {
    const c = client(seeded([node('a')]));
    c.source.history!.stopCapturing();
    const listener = vi.fn();
    c.source.subscribe(listener);
    c.source.transact(() => {
      c.store.triggerNodeChanges(
        [{ type: 'add', item: node('b') }],
        meta('discrete', undefined, 'api'),
      );
      c.store.triggerNodeChanges(
        [{ type: 'add', item: node('c') }],
        meta('discrete', undefined, 'api'),
      );
      c.store.triggerEdgeChanges(
        [{ type: 'add', item: edge('e', 'b', 'c') }],
        meta('discrete', undefined, 'connect'),
      );
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(ids(c.source.nodes)).toEqual(['a', 'b', 'c']);
    c.source.history!.undo();
    expect(ids(c.source.nodes)).toEqual(['a']);
    expect(c.source.edges).toEqual([]);
  });

  it('a transact with another origin is not undoable', () => {
    const c = client(seeded([node('a')]));
    c.source.transact(
      () =>
        c.store.triggerNodeChanges(
          [{ type: 'add', item: node('b') }],
          meta('discrete', undefined, 'api'),
        ),
      'layout',
    );
    // the nested apply still opens a LOCAL transaction only if outermost; here the outer origin wins
    expect(c.source.history!.canUndo()).toBe(false);
  });

  it("undo does not revert another client's edit", () => {
    const { net, a, b } = twoClients();
    a.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 10, y: 10 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    b.source.history!.stopCapturing();
    b.store.instance.updateNodeData('b', { label: 'from b' });
    net.deliver();
    a.source.history!.undo();
    expect(a.source.toObject().nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 0, y: 0 });
    expect(a.source.toObject().nodes.find((n) => n.id === 'b')!.data).toEqual({ label: 'from b' });
    expect(a.source.history!.canUndo()).toBe(false);
  });

  it('undo can be disabled', () => {
    const c = client(seeded([node('a')]), { undo: false });
    expect(c.source.history).toBeUndefined();
    expect(c.store.history).toBeNull();
  });

  it('exposes history through the store for the key bindings', () => {
    const c = client(seeded([node('a')]));
    expect(c.store.history).toBe(c.source.history);
    const notified = vi.fn();
    c.store.history!.subscribe(notified);
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 1, y: 1 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    expect(notified).toHaveBeenCalled();
  });
});

describe('collaboration', () => {
  it('concurrent label edit and move both survive', () => {
    const { net, a, b } = twoClients();
    net.auto = false;
    a.store.instance.updateNodeData('a', { label: 'edited' });
    b.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 40, y: 40 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    net.deliver();
    for (const c of [a, b]) {
      expect(c.store.getState().nodes[0]).toMatchObject({
        id: 'a',
        position: { x: 40, y: 40 },
        data: { label: 'edited' },
      });
    }
  });

  it('keeps identity of untouched nodes across a remote edit and flags it remote', () => {
    const { a, b } = twoClients([node('a'), node('b'), node('c')]);
    const before = a.source.nodes;
    const flags: boolean[] = [];
    a.source.subscribe(() => flags.push(a.source.lastUpdateRemote));
    b.store.instance.updateNodeData('b', { label: 'x' });
    expect(a.source.nodes[0]).toBe(before[0]);
    expect(a.source.nodes[1]).not.toBe(before[1]);
    expect(a.source.nodes[2]).toBe(before[2]);
    expect(flags).toEqual([true]);
    expect(a.source.lastUpdateRemote).toBe(false);
    // local changes are not remote
    a.store.instance.updateNodeData('a', { label: 'mine' });
    expect(flags).toEqual([true, false]);
  });

  it('structureVersion bumps only when the id set changes', () => {
    const { a, b } = twoClients();
    const v = a.source.structureVersion;
    b.store.instance.updateNodeData('a', { x: 1 });
    expect(a.source.structureVersion).toBe(v);
    b.store.triggerNodeChanges(
      [{ type: 'add', item: node('n') }],
      meta('discrete', undefined, 'api'),
    );
    expect(a.source.structureVersion).toBe(v + 1);
  });

  it('concurrent delete + connect converges on a repaired view', () => {
    const { net, a, b } = twoClients([node('a'), node('b')]);
    net.auto = false;
    a.store.triggerNodeChanges(
      [{ type: 'remove', id: 'b' }],
      meta('discrete', undefined, 'delete'),
    );
    b.store.triggerEdgeChanges(
      [{ type: 'add', item: edge('e', 'a', 'b') }],
      meta('discrete', undefined, 'connect'),
    );
    net.deliver();
    for (const c of [a, b]) {
      expect(ids(c.source.nodes)).toEqual(['a']);
      expect(c.source.edges).toEqual([]);
      expect(c.source.issues.map((i) => i.kind)).toEqual(['dangling-edge']);
    }
  });

  it('selection stays local', () => {
    const { a, b } = twoClients();
    a.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: true }],
      meta('discrete', undefined, 'select'),
    );
    expect(a.store.getState().nodes[0]!.selected).toBe(true);
    expect(b.store.getState().nodes[0]!.selected).toBeUndefined();
  });
});

describe('healing', () => {
  it('the single client heals a dangling edge with the HEAL origin and reports XYL20', () => {
    vi.useFakeTimers();
    try {
      const doc = seeded([node('a')], [edge('e', 'a', 'gone')]);
      const origins = countUpdates(doc);
      const c = client(doc);
      expect(c.source.issues).toHaveLength(1);
      expect(origins).toEqual([]);
      vi.advanceTimersByTime(499);
      expect(getMaps(doc).edges.has('e')).toBe(true);
      vi.advanceTimersByTime(2);
      expect(getMaps(doc).edges.has('e')).toBe(false);
      expect(origins).toEqual([HEAL]);
      expect(c.errors.map((e) => e.code)).toEqual(['XYL20']);
      expect(c.source.issues).toEqual([]);
      expect(c.source.history!.canUndo()).toBe(false);
      c.source.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not heal when the issue disappears within the delay', () => {
    vi.useFakeTimers();
    try {
      const doc = seeded([node('a')], [edge('e', 'a', 'late')]);
      const c = client(doc);
      vi.advanceTimersByTime(300);
      doc.transact(() => getMaps(doc).nodes.set('late', toYNode(node('late'), 'zz')));
      vi.advanceTimersByTime(1000);
      expect(getMaps(doc).edges.has('e')).toBe(true);
      expect(c.errors).toEqual([]);
      c.source.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('heal: false only hides', () => {
    vi.useFakeTimers();
    try {
      const doc = seeded([node('a')], [edge('e', 'a', 'gone')]);
      const c = client(doc, { heal: false });
      vi.advanceTimersByTime(5000);
      expect(getMaps(doc).edges.has('e')).toBe(true);
      expect(c.source.edges).toEqual([]);
      c.source.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('read-only, destroy', () => {
  it('readOnly ignores document writes but keeps overlay', () => {
    const doc = seeded([node('a')]);
    const origins = countUpdates(doc);
    const c = client(doc, { readOnly: true });
    c.store.triggerNodeChanges(
      [{ type: 'position', id: 'a', position: { x: 9, y: 9 } }],
      meta('discrete', undefined, 'keyboard'),
    );
    c.store.triggerNodeChanges(
      [{ type: 'add', item: node('b') }],
      meta('discrete', undefined, 'api'),
    );
    c.store.triggerNodeChanges(
      [{ type: 'select', id: 'a', selected: true }],
      meta('discrete', undefined, 'select'),
    );
    c.store.instance.updateNodeData('a', { x: 1 });
    c.source.transact(() => undefined);
    expect(origins).toEqual([]);
    expect(ids(c.source.nodes)).toEqual(['a']);
    expect(c.store.getState().nodes[0]!.selected).toBe(true);
  });

  it('destroy removes observers', () => {
    const doc = seeded([node('a')]);
    const c = client(doc);
    const listener = vi.fn();
    c.source.subscribe(listener);
    c.source.destroy();
    doc.transact(() => getMaps(doc).nodes.set('b', toYNode(node('b'), 'zz')));
    expect(listener).not.toHaveBeenCalled();
    expect(c.source.nodes).toHaveLength(1);
  });
});
