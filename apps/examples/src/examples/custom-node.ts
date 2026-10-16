// reactflow.dev "Custom nodes": a node element with an input, several handles and state of its
// own. Its target nodes follow the picked colour through the controllers of spec/09.
import { css, html } from 'lit';
import { FlowNodeElement, NodeConnectionsController, NodesDataController } from '@xy-lit/flow';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type ColorData = { color: string };

/** A node with a colour input. `nodrag` keeps the input usable without dragging the node. */
class ColorSelectorNode extends FlowNodeElement<Node<ColorData>> {
  static override styles = css`
    .ex-color-node {
      padding: 10px;
      border: 1px solid #1a192b;
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
    }
    .ex-color-node input {
      display: block;
      margin-top: 6px;
      width: 100%;
    }
  `;

  override render() {
    const color = this.data.color;
    return html`<div class="ex-color-node">
      <xy-handle type="target" position="left"></xy-handle>
      <div>Custom colour picker: <strong>${color}</strong></div>
      <input
        class="nodrag"
        type="color"
        aria-label="Node colour"
        .value=${color}
        @input=${(e: Event) =>
          this.flow.updateNodeData(this.nodeId, { color: (e.target as HTMLInputElement).value })}
      />
      <xy-handle type="source" position="right" handle-id="a" style="top: 12px"></xy-handle>
      <xy-handle
        type="source"
        position="right"
        handle-id="b"
        style="top: auto; bottom: 12px"
      ></xy-handle>
    </div>`;
  }
}

/** A node painted with the colour of the node connected to its target handle. */
class SwatchNode extends FlowNodeElement<Node<{ label: string }>> {
  private connections = new NodeConnectionsController(this, { handleType: 'target' });
  private sources = new NodesDataController(this, () =>
    this.connections.value.map((c) => c.source),
  );

  override render() {
    const sources = Array.isArray(this.sources.value) ? this.sources.value : [];
    const color = (sources[0]?.data as Partial<ColorData> | undefined)?.color ?? '#ffffff';
    return html`<div
      class="ex-swatch"
      style="padding: 12px 18px; border: 1px solid #1a192b; border-radius: 6px; font-size: 12px; background: ${color}"
    >
      <xy-handle type="target" position="left"></xy-handle>
      ${this.data.label}: ${color}
    </div>`;
  }
}

customElements.define('ex-color-selector-node', ColorSelectorNode);
customElements.define('ex-swatch-node', SwatchNode);

const nodes: Node[] = [
  {
    id: 'in',
    type: 'input',
    position: { x: 0, y: 60 },
    data: { label: 'Any node' },
    sourcePosition: Position.Right,
  },
  { id: 'picker', type: 'colorSelector', position: { x: 220, y: 40 }, data: { color: '#ffd166' } },
  { id: 'out-a', type: 'swatch', position: { x: 560, y: 0 }, data: { label: 'Output A' } },
  { id: 'out-b', type: 'swatch', position: { x: 560, y: 120 }, data: { label: 'Output B' } },
];
const edges: Edge[] = [
  { id: 'in-picker', source: 'in', target: 'picker', animated: true },
  { id: 'picker-a', source: 'picker', sourceHandle: 'a', target: 'out-a' },
  { id: 'picker-b', source: 'picker', sourceHandle: 'b', target: 'out-b' },
];

const nodeTypes = { colorSelector: 'ex-color-selector-node', swatch: 'ex-swatch-node' };

class CustomNodeExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${nodeTypes}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background variant="dots"></xy-background>
    </xy-flow>`;
  }
}

export default mountExample('ex-custom-node', CustomNodeExample);
