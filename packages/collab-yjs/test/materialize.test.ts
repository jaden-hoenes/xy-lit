import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';
import { Materializer } from '../src/materialize.js';
import type { RemoteLookup } from '../src/materialize.js';
import { LocalOverlay } from '../src/overlay.js';
import { getMaps, toYEdge, toYNode } from '../src/schema.js';
import { keysBetween } from '../src/order.js';

const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

function setup(nodes: Node[] = [], edges: Edge[] = [], remote?: () => RemoteLookup | undefined) {
  const doc = new Y.Doc();
  const maps = getMaps(doc);
  const orders = keysBetween(null, null, nodes.length + edges.length);
  doc.transact(() => {
    nodes.forEach((n, i) => maps.nodes.set(n.id, toYNode(n, orders[i]!)));
    edges.forEach((e, i) => maps.edges.set(e.id, toYEdge(e, orders[nodes.length + i]!)));
  });
  // eslint-disable-next-line prefer-const -- the overlay callbacks need `mat` before it exists
  let mat!: Materializer;
  const overlay = new LocalOverlay(
    (kind, id) => (kind === 'node' ? mat.markNodeView(id) : mat.markEdgeView(id)),
    undefined,
  );
  mat = new Materializer(maps, overlay, remote);
  doc.on('afterTransaction', () => undefined);
  maps.nodes.observeDeep((events) => mat.handleEvents('nodes', events));
  maps.edges.observeDeep((events) => mat.handleEvents('edges', events));
  mat.flush();
  return { doc, maps, overlay, mat };
}

describe('Materializer', () => {
  it('builds ordered arrays on construction', () => {
    const { mat } = setup([node('a'), node('b')], [{ id: 'e', source: 'a', target: 'b' }]);
    expect(mat.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(mat.edges.map((e) => e.id)).toEqual(['e']);
    expect(mat.dirty).toBe(false);
  });

  it('keeps identity of untouched nodes and the arrays when nothing changed', () => {
    const { mat, maps, doc } = setup([node('a'), node('b')]);
    const [a, b] = mat.nodes;
    const arr = mat.nodes;
    doc.transact(() => maps.nodes.get('b')!.set('position', { x: 5, y: 5 }));
    const r = mat.flush();
    expect(r.changed).toBe(true);
    expect(r.structureChanged).toBe(false);
    expect(mat.nodes).not.toBe(arr);
    expect(mat.nodes[0]).toBe(a);
    expect(mat.nodes[1]).not.toBe(b);
    expect(mat.nodes[1]!.position).toEqual({ x: 5, y: 5 });
    const arr2 = mat.nodes;
    expect(mat.flush().changed).toBe(false);
    expect(mat.nodes).toBe(arr2);
  });

  it('marks structure on add/remove, order and parent changes', () => {
    const { mat, maps, doc } = setup([node('a'), node('b')]);
    doc.transact(() => maps.nodes.set('c', toYNode(node('c'), 'zz')));
    expect(mat.flush()).toEqual({ changed: true, structureChanged: true });
    expect(mat.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    doc.transact(() => maps.nodes.get('c')!.set('order', 'a'));
    expect(mat.flush().structureChanged).toBe(false);
    expect(mat.nodes[0]!.id).toBe('c');
    doc.transact(() => maps.nodes.get('a')!.set('parentId', 'b'));
    mat.flush();
    expect(mat.nodes.map((n) => n.id)).toEqual(['c', 'b', 'a']);
    doc.transact(() => maps.nodes.delete('c'));
    expect(mat.flush().structureChanged).toBe(true);
    expect(mat.nodeCache.has('c')).toBe(false);
  });

  it('applies overlay fields and live geometry', () => {
    const { mat, overlay } = setup([node('a', { width: 10 })]);
    overlay.patchNode('a', {
      selected: true,
      dragging: true,
      measured: { width: 30, height: 20 },
      livePosition: { x: 9, y: 9 },
      liveSize: { width: 50, height: 60 },
    });
    mat.flush();
    expect(mat.nodes[0]).toMatchObject({
      selected: true,
      dragging: true,
      measured: { width: 30, height: 20 },
      position: { x: 9, y: 9 },
      width: 50,
      height: 60,
    });
    overlay.patchNode('a', { livePosition: undefined, liveSize: undefined, dragging: undefined });
    mat.flush();
    expect(mat.nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(mat.nodes[0]!.width).toBe(10);
    expect('dragging' in mat.nodes[0]!).toBe(false);
  });

  it('drops overlay entries of removed nodes', () => {
    const { mat, overlay, maps, doc } = setup([node('a'), node('b')]);
    overlay.patchNode('b', { selected: true });
    doc.transact(() => maps.nodes.delete('b'));
    mat.flush();
    expect(overlay.nodes.has('b')).toBe(false);
  });

  it('renders orphans as roots and hides dangling edges', () => {
    const { mat, maps, doc } = setup(
      [node('a', { parentId: 'gone', extent: 'parent' }), node('b')],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'x' },
      ],
    );
    expect(mat.nodes[0]!.parentId).toBeUndefined();
    expect(mat.nodes[0]!.extent).toBeUndefined();
    expect(mat.edges.map((e) => e.id)).toEqual(['e1']);
    expect(mat.issues.map((i) => i.kind).sort()).toEqual(['dangling-edge', 'orphan-parent']);
    // the document itself is untouched
    expect(maps.nodes.get('a')!.get('parentId')).toBe('gone');
    expect(maps.edges.has('e2')).toBe(true);
    doc.transact(() => maps.nodes.set('x', toYNode(node('x'), 'zz')));
    mat.flush();
    expect(mat.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(mat.issues.map((i) => i.kind)).toEqual(['orphan-parent']);
  });

  it('applies remote views', () => {
    const view: RemoteLookup = {
      get: (id) =>
        id === 'a'
          ? {
              meta: { draggingBy: { clientId: 2, id: 'u', name: 'U', color: '#f00' } },
              position: { x: 40, y: 41 },
            }
          : undefined,
    };
    const { mat } = setup([node('a'), node('b')], [], () => view);
    expect(mat.nodes[0]!.position).toEqual({ x: 40, y: 41 });
    expect(mat.nodes[0]!.remote?.draggingBy?.name).toBe('U');
    expect(mat.nodes[1]!.remote).toBeUndefined();
  });

  it('keeps edges selected through the overlay', () => {
    const { mat, overlay } = setup([node('a'), node('b')], [{ id: 'e', source: 'a', target: 'b' }]);
    overlay.patchEdge('e', { selected: true });
    mat.flush();
    expect(mat.edges[0]!.selected).toBe(true);
    expect(mat.toObject().edges[0]).not.toHaveProperty('selected');
  });

  it('toObject has durable fields only', () => {
    const { mat, overlay } = setup([node('a')]);
    overlay.patchNode('a', { selected: true, measured: { width: 1, height: 1 } });
    mat.flush();
    expect(mat.toObject().nodes).toEqual([node('a')]);
  });
});

describe('LocalOverlay', () => {
  it('reports changes and selection', () => {
    const dirty: string[] = [];
    let selections = 0;
    const o = new LocalOverlay(
      (k, id) => dirty.push(`${k}:${id}`),
      () => selections++,
    );
    expect(o.patchNode('a', { selected: true })).toBe(true);
    expect(o.patchNode('a', { selected: true })).toBe(false);
    expect(o.patchNode('a', { measured: { width: 1, height: 2 } })).toBe(true);
    expect(o.patchNode('a', { measured: { width: 1, height: 2 } })).toBe(false);
    expect(o.selectedNodeIds()).toEqual(['a']);
    expect(o.patchEdge('e', { selected: true })).toBe(true);
    expect(o.patchEdge('e', { selected: true })).toBe(false);
    expect(o.selectedEdgeIds()).toEqual(['e']);
    expect(o.patchNode('a', { selected: undefined, measured: undefined })).toBe(true);
    expect(o.nodes.has('a')).toBe(false);
    expect(dirty).toEqual(['node:a', 'node:a', 'edge:e', 'node:a']);
    expect(selections).toBe(3);
  });
});
