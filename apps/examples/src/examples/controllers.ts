// Demo: ReactiveControllers from spec/09: a "sum" node adds up the values of its inputs, a stats
// panel shows the viewport, the selection and the number of nodes.
import '@xy-lit/flow/define.js';
import { LitElement, html } from 'lit';
import {
  FlowNodeElement,
  NodeConnectionsController,
  NodesController,
  NodesDataController,
  OnSelectionChangeController,
  ViewportController,
} from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

class SumNode extends FlowNodeElement<Node<{ value: number }>> {
  private inputs = new NodeConnectionsController(this, { handleType: 'target' });
  private values = new NodesDataController(this, () => this.inputs.value.map((c) => c.source));
  override render() {
    const total = (Array.isArray(this.values.value) ? this.values.value : []).reduce(
      (sum, n) => sum + ((n.data as { value?: number }).value ?? 0),
      0,
    );
    return html`<xy-handle type="target" position="left"></xy-handle>
      <span class="total" data-testid="total">Σ ${total}</span>
      <xy-handle type="source" position="right"></xy-handle>`;
  }
}
customElements.define('demo-sum-node', SumNode);

class StatsPanel extends LitElement {
  private viewport = new ViewportController(this);
  private nodes = new NodesController(this);
  private selected: string[] = [];
  private onSelection = new OnSelectionChangeController(this, ({ nodes }) => {
    this.selected = nodes.map((n) => n.id);
    this.requestUpdate();
  });
  override render() {
    const v = this.viewport.value;
    return html`<xy-panel position="top-left"
      ><div style="font:12px monospace;background:#fff;padding:6px">
        zoom ${v.zoom.toFixed(2)} · ${this.nodes.value.length} nodes · selected:
        ${this.selected.join(', ') || 'none'}
      </div></xy-panel
    >`;
  }
}
customElements.define('demo-stats-panel', StatsPanel);

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'a', value: 2 } },
      { id: 'b', type: 'input', position: { x: 0, y: 100 }, data: { label: 'b', value: 5 } },
      { id: 'sum', type: 'sum', position: { x: 250, y: 50 }, data: { value: 0 } },
    ],
    edges: [
      { id: 'a-sum', source: 'a', target: 'sum' },
      { id: 'b-sum', source: 'b', target: 'sum' },
    ],
    props: { nodeTypes: { sum: 'demo-sum-node' } },
    attributes: { 'fit-view': '' },
  });
  flow.append(document.createElement('demo-stats-panel'));
  show(root, flow);
};
export default mount;
