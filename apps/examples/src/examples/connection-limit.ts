// reactflow.dev "Connection limit": a handle that stops accepting connections once it has `limit`
// of them. `HandleConnectionsController` reads the connections of the handle reactively.
import { css, html } from 'lit';
import { FlowNodeElement, HandleConnectionsController } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type LimitData = { label: string; limit: number };

class LimitedNode extends FlowNodeElement<Node<LimitData>> {
  static override styles = css`
    .ex-limited {
      padding: 10px 14px;
      border: 1px solid #1a192b;
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
    }
    .ex-limited .lit-flow__handle:not(.connectable) {
      background: #d4d4d8;
      border-color: #a1a1aa;
      cursor: not-allowed;
    }
  `;

  private incoming = new HandleConnectionsController(this, { type: 'target' });
  private outgoing = new HandleConnectionsController(this, { type: 'source' });

  override render() {
    const { label, limit } = this.data;
    const hasTarget = this.props.type !== 'limitedSource';
    const hasSource = this.props.type !== 'limitedTarget';
    const count = (hasTarget ? this.incoming : this.outgoing).value.length;
    return html`<div class="ex-limited">
      ${
        hasTarget
          ? html`<xy-handle
              type="target"
              position="left"
              .isConnectable=${count < limit}
            ></xy-handle>`
          : ''
      }
      <div>${label}</div>
      <div class="ex-muted" data-testid="count-${this.nodeId}">${count} / ${limit}</div>
      ${
        hasSource
          ? html`<xy-handle
              type="source"
              position="right"
              .isConnectable=${count < limit}
            ></xy-handle>`
          : ''
      }
    </div>`;
  }
}
customElements.define('ex-limited-node', LimitedNode);

const nodeTypes = {
  limitedSource: 'ex-limited-node',
  limitedTarget: 'ex-limited-node',
};

const nodes: Node[] = [
  {
    id: 's1',
    type: 'limitedSource',
    position: { x: 0, y: 0 },
    data: { label: 'Source (1 edge)', limit: 1 },
  },
  {
    id: 's2',
    type: 'limitedSource',
    position: { x: 0, y: 120 },
    data: { label: 'Source (1 edge)', limit: 1 },
  },
  {
    id: 's3',
    type: 'limitedSource',
    position: { x: 0, y: 240 },
    data: { label: 'Source (1 edge)', limit: 1 },
  },
  {
    id: 't1',
    type: 'limitedTarget',
    position: { x: 320, y: 60 },
    data: { label: 'Target (2 edges)', limit: 2 },
  },
  {
    id: 't2',
    type: 'limitedTarget',
    position: { x: 320, y: 200 },
    data: { label: 'Target (2 edges)', limit: 2 },
  },
];
const edges: Edge[] = [];

class ConnectionLimitExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${nodeTypes}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Handles turn grey once they reached their limit.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-connection-limit', ConnectionLimitExample);
