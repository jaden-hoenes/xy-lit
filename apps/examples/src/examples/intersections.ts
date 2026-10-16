// reactflow.dev "Intersections": while a node is dragged, `getIntersectingNodes` finds the nodes it
// overlaps, and they get a highlight class through `updateNode`.
import { html } from 'lit';
import type { FlowEventMap, Node } from '@xy-lit/flow';
import { ExampleElement, adoptCss, initial, mountExample } from '../lib/demo';

const nodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' }, width: 150, height: 60 },
  { id: '2', position: { x: 90, y: 70 }, data: { label: 'Node 2' }, width: 150, height: 60 },
  { id: '3', position: { x: 300, y: 20 }, data: { label: 'Node 3' }, width: 150, height: 60 },
  { id: '4', position: { x: 300, y: 160 }, data: { label: 'Node 4' }, width: 150, height: 60 },
  {
    id: '5',
    position: { x: 0, y: 220 },
    data: { label: 'Drag me over the others' },
    width: 150,
    height: 60,
  },
];

const css = `
  .lit-flow__node.highlight { background: #fde68a; border-color: #f59e0b; box-shadow: 0 0 0 2px #f59e0b55; }
`;

class IntersectionsExample extends ExampleElement {
  #highlighted = new Set<string>();

  #onDrag = (e: CustomEvent<FlowEventMap['node-drag']>): void => {
    const flow = this.flow;
    const hits = new Set(flow.getIntersectingNodes(e.detail.node).map((n) => n.id));
    // only touch the nodes whose state changes: this runs for every pointer move
    for (const id of [...this.#highlighted, ...hits]) {
      if (hits.has(id) === this.#highlighted.has(id)) continue;
      flow.updateNode(id, { class: hits.has(id) ? 'highlight' : '' });
    }
    this.#highlighted = hits;
  };

  #onDragStop = (): void => {
    for (const id of this.#highlighted) this.flow.updateNode(id, { class: '' });
    this.#highlighted.clear();
  };

  override firstUpdated(): void {
    super.firstUpdated();
    // the highlight rule lives in the flow's shadow root
    adoptCss(this.flow, css);
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      fit-view
      @node-drag=${this.#onDrag}
      @node-drag-stop=${this.#onDragStop}
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
    </xy-flow>`;
  }
}

export default mountExample('ex-intersections', IntersectionsExample);
