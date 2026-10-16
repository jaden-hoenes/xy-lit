// reactflow.dev "Easy connect": the whole node is a handle. Drag from anywhere on a node and drop
// anywhere on another node. The handles are invisible, node-sized and swapped while connecting
// (`ConnectionController`), and the edges are floating.
import { css, html } from 'lit';
import { ConnectionController, FlowNodeElement } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';
import { floatingConnectionLine, floatingEdge, floatingEdgeOptions } from '../lib/floating';

class EasyNode extends FlowNodeElement<Node<{ label: string }>> {
  static override styles = css`
    .ex-easy {
      position: relative;
      min-width: 150px;
      padding: 18px 20px;
      border: 1px solid #222;
      border-radius: 10px;
      text-align: center;
      font-size: 13px;
    }
    /* a handle that covers the whole node and cannot be seen */
    .ex-easy .lit-flow__handle {
      position: absolute;
      top: 0;
      left: 0;
      right: auto;
      bottom: auto;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 0;
      background: transparent;
      opacity: 0;
      transform: none;
    }
  `;

  // only the fields this node needs, so it does not re-render for every pointer move
  private connecting = new ConnectionController(this, (c) => ({
    inProgress: c.inProgress,
    fromId: c.inProgress ? c.fromNode.id : null,
  }));

  override render() {
    const { inProgress, fromId } = this.connecting.value;
    const isTarget = inProgress && fromId !== this.nodeId;
    return html`<div
      class="ex-easy"
      style="border-style: ${isTarget ? 'dashed' : 'solid'}; background: ${isTarget ? '#ffcce3' : '#ccd9f6'}"
    >
      ${inProgress ? '' : html`<xy-handle type="source" position="right"></xy-handle>`}
      ${
        !inProgress || isTarget
          ? html`<xy-handle type="target" position="left" .isConnectableStart=${false}></xy-handle>`
          : ''
      }
      ${isTarget ? 'Drop here' : this.data.label}
    </div>`;
  }
}
customElements.define('ex-easy-node', EasyNode);

const nodes: Node[] = [
  { id: '1', type: 'easy', position: { x: 0, y: 0 }, data: { label: 'Drag to connect' } },
  { id: '2', type: 'easy', position: { x: 350, y: -40 }, data: { label: 'Drag to connect' } },
  { id: '3', type: 'easy', position: { x: 350, y: 140 }, data: { label: 'Drag to connect' } },
];
const edges: Edge[] = [];

class EasyConnectExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${{ easy: 'ex-easy-node' }}
      .edgeTypes=${{ floating: floatingEdge }}
      .defaultEdgeOptions=${floatingEdgeOptions}
      .connectionLineRenderer=${floatingConnectionLine}
      connection-mode="loose"
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
    </xy-flow>`;
  }
}

export default mountExample('ex-easy-connect', EasyConnectExample);
