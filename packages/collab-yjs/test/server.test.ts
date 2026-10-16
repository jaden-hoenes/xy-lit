import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import * as serverEntry from '../src/server.js';
import { createRepairHook } from '../../../apps/collab-server/src/repair-hook.js';
import { getMaps, toYEdge, toYNode } from '../src/schema.js';

function brokenDoc(): Y.Doc {
  const doc = new Y.Doc();
  const maps = getMaps(doc);
  doc.transact(() => {
    maps.nodes.set('a', toYNode({ id: 'a', position: { x: 0, y: 0 }, data: {} }, 'a0'));
    maps.edges.set('e', toYEdge({ id: 'e', source: 'a', target: 'missing' }, 'a1'));
  });
  return doc;
}

describe('@xy-lit/collab-yjs/server entry', () => {
  it('exposes validation and healing without Lit or DOM', () => {
    expect(typeof serverEntry.validateDoc).toBe('function');
    expect(typeof serverEntry.healDoc).toBe('function');
    expect(serverEntry.SERVER).toBe('server');
    const doc = brokenDoc();
    expect(serverEntry.validateDoc(doc).map((i) => i.kind)).toEqual(['dangling-edge']);
    expect(serverEntry.healDoc(doc, serverEntry.SERVER)).toHaveLength(1);
    expect(serverEntry.validateDoc(doc)).toEqual([]);
  });
});

describe('collab-server repair hook', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('heals 2 s after the last change, with the server origin', async () => {
    const doc = brokenDoc();
    const origins: unknown[] = [];
    doc.on('afterTransaction', (tx: Y.Transaction) => origins.push(tx.origin));
    const healed: string[] = [];
    const hook = createRepairHook({
      onHealed: (name, fixed) => healed.push(`${name}:${fixed.length}`),
    });
    await hook.onChange({ documentName: 'room', document: doc });
    vi.advanceTimersByTime(1500);
    await hook.onChange({ documentName: 'room', document: doc });
    vi.advanceTimersByTime(1500);
    expect(getMaps(doc).edges.has('e')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(getMaps(doc).edges.has('e')).toBe(false);
    expect(origins).toEqual(['server']);
    expect(healed).toEqual(['room:1']);
    // nothing left: a later run writes nothing
    await hook.onChange({ documentName: 'room', document: doc });
    vi.advanceTimersByTime(2100);
    expect(origins).toEqual(['server']);
  });

  it('forget and destroy cancel pending runs', async () => {
    const doc = brokenDoc();
    const hook = createRepairHook({ delayMs: 100 });
    await hook.onChange({ documentName: 'a', document: doc });
    hook.forget('a');
    vi.advanceTimersByTime(200);
    expect(getMaps(doc).edges.has('e')).toBe(true);
    await hook.onChange({ documentName: 'a', document: doc });
    hook.destroy();
    vi.advanceTimersByTime(200);
    expect(getMaps(doc).edges.has('e')).toBe(true);
  });
});
