// Three kinds of custom node: a renderer function with a toolbar, element nodes with their own
// state that compute from connected nodes (controllers), and a resizable note.
import { css, html } from 'lit';
import {
  FlowNodeElement,
  NodeConnectionsController,
  NodesDataController,
  defineNodeType,
  nodeToolbar,
} from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { mountTemplate, type Mount } from './_shared';

const shared = css`
  .doc-card {
    padding: 8px 12px;
    border: 1px solid var(--demo-node-border);
    border-radius: 10px;
    background: var(--demo-node-bg);
    color: var(--demo-node-fg);
    font: 12px/1.4 var(--vp-font-family-base, system-ui, sans-serif);
  }
  .doc-card input {
    width: 70px;
    margin-left: 6px;
    padding: 2px 4px;
    border: 1px solid var(--demo-node-border);
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .doc-card strong {
    font-size: 15px;
  }
  .doc-card .lit-flow__handle {
    width: 8px;
    height: 8px;
    background: var(--demo-accent);
  }
  .doc-tb {
    display: flex;
    gap: 4px;
  }
  .doc-tb button {
    padding: 2px 8px;
    border: 1px solid var(--demo-node-border);
    border-radius: 6px;
    background: var(--demo-node-bg);
    color: var(--demo-node-fg);
    font: 11px sans-serif;
    cursor: pointer;
  }
`;

// 1. a renderer function: no state of its own, a toolbar while selected
const taskNode = defineNodeType<Node<{ title: string }>>({
  styles: shared,
  render: ({ id, data, selected }, flow) => html`<div class="doc-card" style=${selected ? 'box-shadow: 0 0 0 2px var(--demo-accent)' : ''}>
    <xy-handle type="target" position="left"></xy-handle>
    <b>${data.title}</b><br />select me for a toolbar
    <xy-handle type="source" position="right"></xy-handle>
    ${nodeToolbar(
      { position: 'top' },
      html`<div class="doc-tb">
        <button class="nodrag" @click=${() => flow.updateNodeData(id, { title: `${data.title}!` })}>Shout</button>
        <button class="nodrag" @click=${() => void flow.deleteElements({ nodes: [{ id }] })}>Delete</button>
      </div>`,
    )}
  </div>`,
});

// 2. element nodes: own state through Lit, data of other nodes through controllers
class NumberNode extends FlowNodeElement<Node<{ value: number }>> {
  static override styles = shared;
  override render() {
    return html`<div class="doc-card">
      Value<input
        class="nodrag"
        type="number"
        aria-label="Value of ${this.nodeId}"
        .value=${String(this.data.value)}
        @input=${(e: Event) =>
          this.flow.updateNodeData(this.nodeId, { value: Number((e.target as HTMLInputElement).value) || 0 })}
      />
      <xy-handle type="source" position="right"></xy-handle>
    </div>`;
  }
}

class SumNode extends FlowNodeElement<Node<Record<string, never>>> {
  static override styles = shared;
  #incoming = new NodeConnectionsController(this, { handleType: 'target' });
  #sources = new NodesDataController(this, () => this.#incoming.value.map((c) => c.source));
  override render() {
    const list = Array.isArray(this.#sources.value) ? this.#sources.value : [];
    const total = list.reduce((sum, n) => sum + Number((n.data as { value?: number }).value ?? 0), 0);
    return html`<div class="doc-card">
      <xy-handle type="target" position="left"></xy-handle>
      Sum of ${list.length} input${list.length === 1 ? '' : 's'}: <strong>${total}</strong>
    </div>`;
  }
}
customElements.define('docs-number-node', NumberNode);
customElements.define('docs-sum-node', SumNode);

// 3. a note the user can resize
const noteNode = defineNodeType<Node<{ text: string }>>({
  resizer: { minWidth: 120, minHeight: 60 },
  styles: css`
    .doc-note {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 8px 10px;
      border: 1px dashed var(--demo-node-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--demo-accent) 10%, transparent);
      color: var(--demo-node-fg);
      font: 12px/1.45 var(--vp-font-family-base, system-ui, sans-serif);
    }
  `,
  render: ({ data }) => html`<div class="doc-note">${data.text}</div>`,
});

const nodes: Node[] = [
  { id: 't', type: 'task', position: { x: 0, y: 0 }, data: { title: 'Task' } },
  { id: 'a', type: 'num', position: { x: 0, y: 100 }, data: { value: 3 } },
  { id: 'b', type: 'num', position: { x: 0, y: 170 }, data: { value: 4 } },
  { id: 'sum', type: 'sum', position: { x: 250, y: 130 }, data: {} },
  { id: 'note', type: 'note', position: { x: 250, y: -10 }, width: 190, height: 80, data: { text: 'Resizable note: select it and drag a corner.' } },
];
const edges: Edge[] = [
  { id: 'a-sum', source: 'a', target: 'sum' },
  { id: 'b-sum', source: 'b', target: 'sum' },
];

export const mount: Mount = (el) =>
  mountTemplate(
    el,
    html`<xy-flow
      .nodes=${nodes}
      .edges=${edges}
      .nodeTypes=${{ task: taskNode, num: 'docs-number-node', sum: 'docs-sum-node', note: noteNode }}
      fit-view
      prevent-scrolling="false"
      zoom-on-scroll="false"
    >
      <xy-background></xy-background>
      <xy-controls show-interactive="false"></xy-controls>
    </xy-flow>`,
  );
