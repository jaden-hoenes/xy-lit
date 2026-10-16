// Two flows, two Y.Docs, one in-memory relay with adjustable latency: shared nodes, live drags,
// cursors, selections and per-user undo. No server and no network: this is what a provider does.
import { html } from 'lit';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { YjsFlowSource } from '@xy-lit/collab-yjs';
import { Position } from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
import { mountTemplate, type Mount } from './_shared';

const seed: { nodes: Node[]; edges: Edge[] } = {
  nodes: [
    { id: 'idea', type: 'input', position: { x: 0, y: 40 }, data: { label: 'Idea' }, ...lr },
    { id: 'plan', position: { x: 190, y: 0 }, data: { label: 'Plan' }, ...lr },
    { id: 'ship', type: 'output', position: { x: 190, y: 110 }, data: { label: 'Ship' }, ...lr },
  ],
  edges: [
    { id: 'e1', source: 'idea', target: 'plan' },
    { id: 'e2', source: 'idea', target: 'ship' },
  ],
};

/** Delivers document and awareness updates between two peers after `latency` ms, unless offline. */
class Relay {
  latency = 80;
  offline = new Set<Y.Doc>();
  queue = new Map<Y.Doc, Uint8Array[]>();
  constructor(readonly docs: [Y.Doc, Y.Doc], readonly awareness: [Awareness, Awareness]) {
    docs.forEach((doc, i) => {
      const other = docs[1 - i]!;
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'relay') return;
        this.#send(doc, other, () => Y.applyUpdate(other, update, 'relay'), update);
      });
      awareness[i]!.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        if (this.offline.has(doc) || this.offline.has(other)) return;
        const payload = encodeAwarenessUpdate(awareness[i]!, [...added, ...updated, ...removed]);
        setTimeout(() => applyAwarenessUpdate(awareness[1 - i]!, payload, 'relay'), this.latency);
      });
    });
  }
  #send(from: Y.Doc, to: Y.Doc, deliver: () => void, update: Uint8Array): void {
    if (this.offline.has(from) || this.offline.has(to)) {
      const q = this.queue.get(from) ?? [];
      q.push(update);
      this.queue.set(from, q);
      return;
    }
    setTimeout(deliver, this.latency);
  }
  /** Go back online: send what each side queued, in order, and exchange the full state. */
  reconnect(): void {
    for (const [from, updates] of this.queue) {
      const to = this.docs[0] === from ? this.docs[1] : this.docs[0];
      for (const u of updates) Y.applyUpdate(to, u, 'relay');
    }
    this.queue.clear();
  }
}

export const mount: Mount = (el) => {
  const docs: [Y.Doc, Y.Doc] = [new Y.Doc(), new Y.Doc()];
  YjsFlowSource.populate(docs[0], seed);
  Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]), 'relay');
  const awareness: [Awareness, Awareness] = [new Awareness(docs[0]), new Awareness(docs[1])];
  const relay = new Relay(docs, awareness);
  const users = [
    { id: 'ada', name: 'Ada', color: '#6366f1' },
    { id: 'grace', name: 'Grace', color: '#f59e0b' },
  ];
  const sources = docs.map((doc, i) => new YjsFlowSource(doc, { awareness: awareness[i]!, user: users[i]! }));

  const side = (i: number) => html`<div>
    <div class="demo-title" style="display:flex;gap:8px;align-items:center">
      <span style="color:${users[i]!.color}">&#9679;</span> ${users[i]!.name}
      <span style="flex:1"></span>
      <button type="button" class="demo-btn" data-add=${i}>Add node</button>
      <button type="button" class="demo-btn" data-undo=${i} disabled>Undo</button>
      <button type="button" class="demo-btn" data-redo=${i} disabled>Redo</button>
    </div>
    <xy-flow fit-view prevent-scrolling="false" zoom-on-scroll="false" delete-key="Backspace" data-side=${i}>
      <xy-background></xy-background>
      <xy-remote-cursors></xy-remote-cursors>
      <xy-presence-avatars include-self position="top-right"></xy-presence-avatars>
    </xy-flow>
  </div>`;

  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <label>network latency <input type="range" id="latency" min="0" max="1000" step="20" value="80" /> <span id="ms">80 ms</span></label>
        <label><input type="checkbox" id="offline" /> Grace is offline</label>
        <span class="spacer"></span>
        <span>Drag, select, edit on one side and watch the other. Undo only reverts your own edits.</span>
      </div>
      <div class="demo-split">${side(0)}${side(1)}</div>`,
  );

  const flows = [...el.querySelectorAll<XyFlowElement>('xy-flow')];
  flows.forEach((flow, i) => {
    flow.source = sources[i]!;
    const undo = el.querySelector<HTMLButtonElement>(`[data-undo="${i}"]`)!;
    const redo = el.querySelector<HTMLButtonElement>(`[data-redo="${i}"]`)!;
    const history = sources[i]!.history!; // present: undo is on by default
    const sync = (): void => {
      undo.disabled = !history.canUndo();
      redo.disabled = !history.canRedo();
    };
    history.subscribe(sync);
    undo.addEventListener('click', () => history.undo());
    redo.addEventListener('click', () => history.redo());
    let n = 0;
    el.querySelector(`[data-add="${i}"]`)!.addEventListener('click', () => {
      flow.addNodes({ id: `${users[i]!.id}-${++n}`, data: { label: `${users[i]!.name} ${n}` }, ...lr });
    });
  });
  (el.querySelector('#latency') as HTMLInputElement).addEventListener('input', (e) => {
    relay.latency = Number((e.target as HTMLInputElement).value);
    el.querySelector('#ms')!.textContent = `${relay.latency} ms`;
  });
  (el.querySelector('#offline') as HTMLInputElement).addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).checked) {
      relay.offline.add(docs[1]);
    } else {
      relay.offline.delete(docs[1]);
      relay.reconnect();
    }
  });
  return () => {
    sources.forEach((s) => s.destroy());
    awareness.forEach((a) => a.destroy());
    dispose();
  };
};
