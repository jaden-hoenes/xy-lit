// reactflow.dev "Custom connection line": `connectionLineRenderer` draws the line while a
// connection is dragged: a cubic with a dot at the pointer that turns green or red over handles.
import { html, svg } from 'lit';
import type { ConnectionLineRenderer } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const connectionLine: ConnectionLineRenderer = (p) => {
  const color =
    p.connectionStatus === 'valid'
      ? '#16a34a'
      : p.connectionStatus === 'invalid'
        ? '#dc2626'
        : '#6366f1';
  return svg`<g>
    <path
      fill="none"
      stroke=${color}
      stroke-width="2"
      stroke-dasharray="6 4"
      d="M ${p.fromX},${p.fromY} C ${p.fromX} ${p.toY} ${p.fromX} ${p.toY} ${p.toX},${p.toY}"
    ></path>
    <circle cx=${p.toX} cy=${p.toY} r="5" fill="#fff" stroke=${color} stroke-width="2"></circle>
  </g>`;
};

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Drag from my handle' } },
  { id: 'b', position: { x: 300, y: 120 }, data: { label: 'Drop on me' } },
  { id: 'c', type: 'output', position: { x: 0, y: 240 }, data: { label: 'Or on me' } },
];
const edges: Edge[] = [];

class CustomConnectionLineExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .connectionLineRenderer=${connectionLine}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background variant="dots"></xy-background>
    </xy-flow>`;
  }
}

export default mountExample('ex-custom-connection-line', CustomConnectionLineExample);
