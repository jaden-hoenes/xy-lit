import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { FlowStore } from '@xy-lit/store';
import type { ChangeMeta, Edge, FlowEventMap, Node } from '@xy-lit/store';
import { YjsFlowSource } from '../src/yjs-flow-source.js';
import type { YjsFlowSourceOptions } from '../src/yjs-flow-source.js';

export const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});
export const edge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<Edge> = {},
): Edge => ({
  id,
  source,
  target,
  ...extra,
});

export const meta = (
  phase: ChangeMeta['phase'],
  gestureId?: string,
  origin: ChangeMeta['origin'] = 'drag',
): ChangeMeta => ({
  phase,
  origin,
  gestureId,
});

/** A relay between docs: updates are queued and delivered on demand (or at once with `auto`). */
export class Net {
  readonly docs: Y.Doc[] = [];
  readonly queues = new Map<Y.Doc, Uint8Array[]>();
  online = new Set<Y.Doc>();
  auto = true;

  add(doc: Y.Doc): Y.Doc {
    this.docs.push(doc);
    this.queues.set(doc, []);
    this.online.add(doc);
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'net') return;
      for (const other of this.docs) {
        if (other !== doc) this.queues.get(other)!.push(update);
      }
      if (this.auto) this.deliver();
    });
    return doc;
  }

  deliver(): void {
    for (const doc of this.docs) {
      if (!this.online.has(doc)) continue;
      const queue = this.queues.get(doc)!;
      while (queue.length) Y.applyUpdate(doc, queue.shift()!, 'net');
    }
  }

  /** Bring everything in sync regardless of `online`. */
  syncAll(): void {
    for (const a of this.docs)
      for (const b of this.docs) if (a !== b) Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'net');
    for (const queue of this.queues.values()) queue.length = 0;
  }
}

/** Awareness instances relaying to each other synchronously. */
export function awarenessPair(docs: Y.Doc[] | number = 2): Awareness[] {
  const list = (
    typeof docs === 'number' ? Array.from({ length: docs }, () => new Y.Doc()) : docs
  ).map((d) => new Awareness(d));
  for (const from of list) {
    from.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const update = encodeAwarenessUpdate(from, [...added, ...updated, ...removed]);
        for (const to of list) if (to !== from) applyAwarenessUpdate(to, update, 'relay');
      },
    );
  }
  return list;
}

export type Client = {
  doc: Y.Doc;
  store: FlowStore;
  source: YjsFlowSource;
  errors: FlowEventMap['flow-error'][];
};

/** A store with a fake host (collects `flow-error`) driving a YjsFlowSource. */
export function client(doc: Y.Doc, options: YjsFlowSourceOptions = {}): Client {
  const store = new FlowStore();
  const errors: Client['errors'] = [];
  store.setHost({
    emit: (type: string, detail: unknown) => {
      if (type === 'flow-error') errors.push(detail as FlowEventMap['flow-error']);
      return true;
    },
  } as never);
  const source = new YjsFlowSource(doc, options);
  store.setSource(source);
  store.flush();
  return { doc, store, source, errors };
}

export const ids = (xs: { id: string }[]): string[] => xs.map((x) => x.id);
