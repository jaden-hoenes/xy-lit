import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { MIGRATION } from '../src/origins.js';
import { runMigrations } from '../src/migrations.js';
import type { Migration } from '../src/migrations.js';
import { SCHEMA_VERSION, getMaps, toYNode } from '../src/schema.js';
import { YjsFlowSource } from '../src/yjs-flow-source.js';
import { client, node } from './helpers.js';

const originsOf = (doc: Y.Doc) => {
  const origins: unknown[] = [];
  doc.on('afterTransaction', (tx: Y.Transaction) => origins.push(tx.origin));
  return origins;
};

describe('runMigrations', () => {
  it('writes the schema into an empty document', () => {
    const doc = new Y.Doc();
    const origins = originsOf(doc);
    expect(runMigrations(doc, getMaps(doc))).toEqual({ status: 'current' });
    expect(getMaps(doc).meta.get('schema')).toBe(SCHEMA_VERSION);
    expect(typeof getMaps(doc).meta.get('createdAt')).toBe('number');
    expect(origins).toEqual([MIGRATION]);
    // second run writes nothing
    expect(runMigrations(doc, getMaps(doc))).toEqual({ status: 'current' });
    expect(origins).toEqual([MIGRATION]);
  });

  it('runs a chain for an older document in one MIGRATION transaction', () => {
    const doc = new Y.Doc();
    const maps = getMaps(doc);
    maps.meta.set('schema', 0);
    maps.nodes.set('a', toYNode(node('a', { data: { title: 'old' } }), 'a0'));
    const migration: Migration = {
      from: 0,
      to: 1,
      run: (_doc, m) => {
        const data = m.nodes.get('a').get('data') as Y.Map<unknown>;
        data.set('label', data.get('title'));
        data.delete('title');
      },
    };
    const origins = originsOf(doc);
    expect(runMigrations(doc, maps, [migration])).toEqual({ status: 'migrated', from: 0, to: 1 });
    expect(origins).toEqual([MIGRATION]);
    expect(maps.meta.get('schema')).toBe(1);
    expect((maps.nodes.get('a')!.get('data') as Y.Map<unknown>).toJSON()).toEqual({ label: 'old' });
  });

  it('treats a missing schema on a non-empty document as version 0 only if a migration starts there', () => {
    const doc = new Y.Doc();
    const maps = getMaps(doc);
    maps.nodes.set('a', toYNode(node('a'), 'a0'));
    expect(runMigrations(doc, maps)).toEqual({ status: 'current' });
    expect(maps.meta.get('schema')).toBe(1);
    const doc2 = new Y.Doc();
    const maps2 = getMaps(doc2);
    maps2.nodes.set('a', toYNode(node('a'), 'a0'));
    let ran = false;
    expect(
      runMigrations(doc2, maps2, [{ from: 0, to: 1, run: () => (ran = true) as never }]).status,
    ).toBe('migrated');
    expect(ran).toBe(true);
  });

  it('reports a document that is too new and writes nothing', () => {
    const doc = new Y.Doc();
    getMaps(doc).meta.set('schema', 99);
    const origins = originsOf(doc);
    expect(runMigrations(doc, getMaps(doc))).toEqual({ status: 'too-new', found: 99 });
    expect(origins).toEqual([]);
  });

  it('reports a missing path', () => {
    const doc = new Y.Doc();
    getMaps(doc).meta.set('schema', -1);
    expect(runMigrations(doc, getMaps(doc), [{ from: 5, to: 6, run: () => undefined }])).toEqual({
      status: 'no-path',
      found: -1,
    });
  });
});

describe('YjsFlowSource migrations', () => {
  it('writes the schema at construction', () => {
    const doc = new Y.Doc();
    new YjsFlowSource(doc);
    expect(getMaps(doc).meta.get('schema')).toBe(SCHEMA_VERSION);
  });

  it('waits for `synced` before migrating or writing the schema', async () => {
    const doc = new Y.Doc();
    let resolve!: () => void;
    const synced = new Promise<void>((r) => (resolve = r));
    new YjsFlowSource(doc, { synced });
    expect(getMaps(doc).meta.has('schema')).toBe(false);
    resolve();
    await synced;
    await Promise.resolve();
    expect(getMaps(doc).meta.get('schema')).toBe(SCHEMA_VERSION);
  });

  it('a newer document makes the source read-only and reports XYL21', () => {
    const doc = new Y.Doc();
    getMaps(doc).meta.set('schema', 7);
    getMaps(doc).nodes.set('a', toYNode(node('a'), 'a0'));
    const c = client(doc);
    expect(c.source.readOnly).toBe(true);
    expect(c.errors.map((e) => e.code)).toEqual(['XYL21']);
    c.store.triggerNodeChanges([{ type: 'position', id: 'a', position: { x: 5, y: 5 } }], {
      phase: 'discrete',
      origin: 'keyboard',
    });
    expect(getMaps(doc).nodes.get('a')!.get('position')).toEqual({ x: 0, y: 0 });
    expect(getMaps(doc).meta.get('schema')).toBe(7);
  });

  it('runs app migrations on an old document', () => {
    const doc = new Y.Doc();
    getMaps(doc).meta.set('schema', 0);
    getMaps(doc).nodes.set('a', toYNode(node('a'), 'a0'));
    const src = new YjsFlowSource(doc, {
      migrations: [{ from: 0, to: 1, run: (_d, m) => m.nodes.get('a').set('class', 'migrated') }],
    });
    expect(src.nodes[0]!.class).toBe('migrated');
    expect(getMaps(doc).meta.get('schema')).toBe(1);
  });
});
