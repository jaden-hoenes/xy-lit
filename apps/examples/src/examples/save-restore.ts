// reactflow.dev "Save and restore": `toObject()` gives a serialisable snapshot (nodes, edges,
// viewport); restoring it is `setNodes`, `setEdges` and `setViewport`. The snapshot is kept in
// `localStorage` when the browser allows it.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const KEY = 'xy-lit-example-save-restore';

const nodes: Node[] = [
  { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
  { id: '3', position: { x: 200, y: 100 }, data: { label: 'Node 3' } },
];
const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
];

// the page also works when storage is blocked: the snapshot then lives in memory
let memory: string | null = null;
const read = (): string | null => {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
};
const write = (value: string | null): void => {
  memory = value;
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    /* storage is blocked: keep the in-memory copy */
  }
};

class SaveRestoreExample extends ExampleElement {
  static override properties = { status: { state: true } };
  declare status: string;
  #added = 0;
  constructor() {
    super();
    this.status = read() ? 'A snapshot is stored.' : 'No snapshot yet.';
  }

  #save = (): void => {
    const snapshot = this.flow.toObject();
    write(JSON.stringify(snapshot));
    this.status = `Saved ${snapshot.nodes.length} nodes and ${snapshot.edges.length} edges.`;
  };

  #restore = (): void => {
    const raw = read();
    if (!raw) {
      this.status = 'Nothing to restore.';
      return;
    }
    const { nodes, edges, viewport } = JSON.parse(raw) as ReturnType<typeof this.flow.toObject>;
    this.flow.setNodes(nodes);
    this.flow.setEdges(edges);
    void this.flow.setViewport(viewport);
    this.status = `Restored ${nodes.length} nodes and ${edges.length} edges.`;
  };

  #add = (): void => {
    const id = `new-${++this.#added}`;
    // no position: the store looks for free space around the viewport centre
    this.flow.addNodes({ id, data: { label: `New node ${this.#added}` } });
  };

  #clear = (): void => {
    write(null);
    this.flow.setNodes([]);
    this.flow.setEdges([]);
    this.status = 'Cleared the canvas and the snapshot.';
  };

  override render() {
    return html`<xy-flow .nodes=${initial(nodes)} .edges=${initial(edges)} fit-view>
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-right">
        <div class="ex-box">
          <div class="ex-btns">
            <button class="ex-btn" data-action="save" @click=${this.#save}>save</button>
            <button class="ex-btn" data-action="restore" @click=${this.#restore}>restore</button>
            <button class="ex-btn" data-action="add" @click=${this.#add}>add node</button>
            <button class="ex-btn" data-action="clear" @click=${this.#clear}>clear</button>
          </div>
          <div class="ex-muted" style="margin-top: 6px" data-testid="status">${this.status}</div>
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-save-restore', SaveRestoreExample);
