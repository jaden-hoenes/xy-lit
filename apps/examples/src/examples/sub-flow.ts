// reactflow.dev "Sub flows": nodes inside group nodes. Children are positioned relative to their
// parent (`parentId`), move with it, and can be confined to it (`extent: 'parent'`).
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const nodes: Node[] = [
  { id: '1', data: { label: 'Node 1' }, position: { x: 250, y: 5 } },
  {
    id: '2',
    data: { label: 'Group A' },
    position: { x: 100, y: 100 },
    width: 200,
    height: 200,
    style: 'background-color: rgba(255, 0, 0, 0.15);',
  },
  { id: '2a', data: { label: 'Node A.1' }, position: { x: 10, y: 50 }, parentId: '2' },
  { id: '3', data: { label: 'Node 3' }, position: { x: 350, y: 100 } },
  {
    id: '4',
    data: { label: 'Group B' },
    position: { x: 350, y: 220 },
    width: 320,
    height: 320,
    style: 'background-color: rgba(0, 120, 255, 0.12);',
  },
  {
    id: '4a',
    data: { label: 'Node B.1' },
    position: { x: 15, y: 65 },
    parentId: '4',
    extent: 'parent',
  },
  {
    id: '4b',
    type: 'group',
    data: { label: 'Group B.A' },
    position: { x: 15, y: 130 },
    width: 290,
    height: 170,
    parentId: '4',
    style: 'background-color: rgba(255, 0, 255, 0.15);',
  },
  {
    id: '4b1',
    data: { label: 'Node B.A.1' },
    position: { x: 20, y: 40 },
    parentId: '4b',
    extent: 'parent',
  },
  {
    id: '4b2',
    data: { label: 'Node B.A.2' },
    position: { x: 130, y: 95 },
    parentId: '4b',
    extent: 'parent',
  },
];

const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e4a-4b1', source: '4a', target: '4b1' },
  { id: 'e4a-4b2', source: '4a', target: '4b2' },
  { id: 'e4b1-4b2', source: '4b1', target: '4b2' },
];

class SubFlowExample extends ExampleElement {
  #children = 0;

  #addChild = (): void => {
    // children are given positions relative to the group; the extent keeps them inside
    const n = this.#children++;
    this.flow.addNodes({
      id: `2-new-${n}`,
      data: { label: `New ${n + 1}` },
      position: { x: 10 + (n % 3) * 20, y: 100 + (n % 3) * 20 },
      parentId: '2',
      extent: 'parent',
    });
  };

  #detach = (): void => {
    const node = this.flow.getInternalNode('2a');
    if (!node?.parentId) return;
    // a detached node needs its absolute position, because the parent no longer offsets it
    const { x, y } = node.internals.positionAbsolute;
    this.flow.updateNode('2a', { parentId: undefined, extent: undefined, position: { x, y } });
  };

  #toggleExtent = (): void => {
    const node = this.flow.getNode('2a');
    this.flow.updateNode('2a', { extent: node?.extent === 'parent' ? undefined : 'parent' });
  };

  override render() {
    return html`<xy-flow .nodes=${initial(nodes)} .edges=${initial(edges)} fit-view>
      <xy-controls></xy-controls>
      <xy-minimap pannable zoomable></xy-minimap>
      <xy-background></xy-background>
      <xy-panel position="top-left">
        <div class="ex-box ex-btns">
          <button class="ex-btn" data-action="add-child" @click=${this.#addChild}>
            add child to Group A
          </button>
          <button class="ex-btn" data-action="toggle-extent" @click=${this.#toggleExtent}>
            toggle A.1 extent
          </button>
          <button class="ex-btn" data-action="detach" @click=${this.#detach}>detach A.1</button>
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-sub-flow', SubFlowExample);
