// reactflow.dev "Drag and drop": drag a node type from the sidebar onto the pane. The drop handler
// converts the pointer position with `screenToFlowPosition`.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const MIME = 'application/xy-lit-node-type';
const types = [
  { type: 'input', label: 'Input node' },
  { type: 'default', label: 'Default node' },
  { type: 'output', label: 'Output node' },
] as const;

const nodes: Node[] = [
  { id: 'start', type: 'input', position: { x: 250, y: 5 }, data: { label: 'input node' } },
];
const edges: Edge[] = [];

class DragAndDropExample extends ExampleElement {
  #id = 0;

  #onDragStart(event: DragEvent, type: string): void {
    event.dataTransfer?.setData(MIME, type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  #onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  #onDrop(event: DragEvent): void {
    event.preventDefault();
    const type = event.dataTransfer?.getData(MIME);
    if (!type) return;
    // the position is a flow coordinate: the viewport transform and the flow's offset are removed
    const position = this.flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    this.flow.addNodes({
      id: `dnd-${++this.#id}`,
      type,
      position,
      data: { label: `${type} node` },
    });
  }

  override render() {
    return html`<div class="ex-row">
      <aside class="ex-sidebar" aria-label="Node palette">
        <div class="ex-hint">You can drag these nodes to the pane on the right.</div>
        ${types.map(
          ({ type, label }) =>
            html`<div
              class="ex-box"
              style="margin-bottom: 8px; cursor: grab;"
              draggable="true"
              data-node-type=${type}
              @dragstart=${(e: DragEvent) => this.#onDragStart(e, type)}
            >
              ${label}
            </div>`,
        )}
      </aside>
      <xy-flow
        .nodes=${initial(nodes)}
        .edges=${initial(edges)}
        fit-view
        @dragover=${this.#onDragOver}
        @drop=${this.#onDrop}
      >
        <xy-controls></xy-controls>
        <xy-background></xy-background>
      </xy-flow>
    </div>`;
  }
}

export default mountExample('ex-drag-and-drop', DragAndDropExample);
