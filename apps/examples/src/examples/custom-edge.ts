// reactflow.dev "Custom edge" (button edge): a custom edge type with a delete button in the
// middle. The label is regular HTML placed by `edgeLabel()`, so it can be interactive.
import { css, html } from 'lit';
import { baseEdge, defineEdgeType, edgeLabel, getBezierPath } from '@xy-lit/flow';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const buttonEdge = defineEdgeType({
  styles: css`
    .ex-edge-button {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid #b1b1b7;
      background: #fff;
      cursor: pointer;
      line-height: 1;
      font-size: 12px;
    }
    .ex-edge-button:hover {
      background: #fee2e2;
      border-color: #ef4444;
    }
  `,
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({
        id: p.id,
        path,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      }),
      label: edgeLabel(
        flow,
        {
          edgeId: p.id,
          x,
          y,
          class: 'ex-edge-button-wrap',
          style: 'background: transparent; padding: 0;',
        },
        // `nodrag nopan` keep clicks on the button from dragging a node or panning the pane
        html`<button
          class="nodrag nopan ex-edge-button"
          aria-label="Delete edge ${p.id}"
          @click=${(e: Event) => {
            e.stopPropagation();
            void flow.deleteElements({ edges: [{ id: p.id }] });
          }}
        >
          &times;
        </button>`,
      ),
    };
  },
});

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const nodes: Node[] = [
  { id: '1', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Source' }, ...lr },
  { id: '2', position: { x: 300, y: 0 }, data: { label: 'Target A' }, ...lr },
  { id: '3', position: { x: 300, y: 200 }, data: { label: 'Target B' }, ...lr },
  { id: '4', type: 'output', position: { x: 600, y: 100 }, data: { label: 'Sink' }, ...lr },
];
const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'button' },
  { id: 'e1-3', source: '1', target: '3', type: 'button' },
  { id: 'e2-4', source: '2', target: '4', type: 'button' },
  { id: 'e3-4', source: '3', target: '4', type: 'button' },
];

class CustomEdgeExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .edgeTypes=${{ button: buttonEdge }}
      .defaultEdgeOptions=${{ type: 'button' }}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">
          Click the &times; on an edge to delete it. Drag between handles to add one.
        </div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-custom-edge', CustomEdgeExample);
