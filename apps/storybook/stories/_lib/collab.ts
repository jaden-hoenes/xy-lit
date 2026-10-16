/**
 * Two in-memory collaborators for the collaboration stories: each has its own `Y.Doc`, awareness
 * and `YjsFlowSource`, and a relay carries document and awareness updates between them after a
 * configurable delay (it can also go offline and deliver the backlog on reconnect).
 */
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { YjsFlowSource } from '@xy-lit/collab-yjs';
import { MarkerType, Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';

export interface Peer {
  id: string;
  name: string;
  color: string;
  doc: Y.Doc;
  awareness: Awareness;
  source: YjsFlowSource;
}

/** Carries updates between two peers, with latency and an offline switch. */
export class Relay {
  latency: number;
  #offline = false;
  #held: (() => void)[] = [];
  #inFlight = 0;
  readonly #listeners = new Set<() => void>();
  readonly #timers = new Set<number>();

  constructor(latency: number) {
    this.latency = latency;
  }

  get offline(): boolean {
    return this.#offline;
  }
  /** Messages travelling or waiting for the connection to come back. */
  get pending(): number {
    return this.#inFlight + this.#held.length;
  }

  onChange(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  setOffline(offline: boolean): void {
    if (offline === this.#offline) return;
    this.#offline = offline;
    if (!offline) {
      const backlog = this.#held;
      this.#held = [];
      for (const fn of backlog) this.#deliver(fn);
    }
    this.#notify();
  }

  /** Forward everything `from` does to `to`. */
  link(from: Peer, to: Peer): void {
    from.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      this.#send(() => Y.applyUpdate(to.doc, update, this));
    });
    from.awareness.on(
      'update',
      (change: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === this) return;
        const changed = [...change.added, ...change.updated, ...change.removed];
        const update = encodeAwarenessUpdate(from.awareness, changed);
        this.#send(() => applyAwarenessUpdate(to.awareness, update, this));
      },
    );
  }

  destroy(): void {
    for (const t of this.#timers) clearTimeout(t);
    this.#timers.clear();
    this.#held = [];
    this.#listeners.clear();
  }

  #send(fn: () => void): void {
    if (this.#offline) this.#held.push(fn);
    else this.#deliver(fn);
    this.#notify();
  }

  #deliver(fn: () => void): void {
    this.#inFlight++;
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      this.#inFlight--;
      fn();
      this.#notify();
    }, this.latency);
    this.#timers.add(timer);
  }

  #notify(): void {
    for (const fn of this.#listeners) fn();
  }
}

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const arrow = { type: MarkerType.ArrowClosed };

/** The graph both peers start with (fixed ids, so nothing is duplicated). */
export function seedGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'plan', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Plan' }, ...lr },
      { id: 'design', position: { x: 250, y: 0 }, data: { label: 'Design' }, ...lr },
      { id: 'build', position: { x: 250, y: 200 }, data: { label: 'Build' }, ...lr },
      { id: 'ship', type: 'output', position: { x: 500, y: 100 }, data: { label: 'Ship' }, ...lr },
    ],
    edges: [
      { id: 'plan-design', source: 'plan', target: 'design', markerEnd: arrow },
      { id: 'plan-build', source: 'plan', target: 'build', markerEnd: arrow },
      { id: 'design-ship', source: 'design', target: 'ship', markerEnd: arrow },
      { id: 'build-ship', source: 'build', target: 'ship', markerEnd: arrow },
    ],
  };
}

export const USERS = [
  { id: 'alice', name: 'Alice', color: '#6366f1' },
  { id: 'bob', name: 'Bob', color: '#e11d48' },
] as const;

/** Create the two peers with a seeded document, already in sync, and link them through a relay. */
export function createPair(latency: number): { alice: Peer; bob: Peer; relay: Relay } {
  const make = (user: (typeof USERS)[number]): Omit<Peer, 'source'> => {
    const doc = new Y.Doc();
    return { ...user, doc, awareness: new Awareness(doc) };
  };
  const a = make(USERS[0]);
  const b = make(USERS[1]);
  // seed one document and copy it over before anything listens: both start identical
  YjsFlowSource.populate(a.doc, seedGraph());
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
  const peer = (p: Omit<Peer, 'source'>): Peer => ({
    ...p,
    source: new YjsFlowSource(p.doc, {
      awareness: p.awareness,
      user: { id: p.id, name: p.name, color: p.color },
    }),
  });
  const alice = peer(a);
  const bob = peer(b);
  const relay = new Relay(latency);
  relay.link(alice, bob);
  relay.link(bob, alice);
  return { alice, bob, relay };
}

/** Release a peer's observers, undo manager and presence. */
export function destroyPeer(peer: Peer): void {
  peer.source.destroy();
  peer.awareness.destroy();
  peer.doc.destroy();
}
