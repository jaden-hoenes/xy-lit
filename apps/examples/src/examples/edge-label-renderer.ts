// reactflow.dev "Edge label renderer": HTML labels on a custom edge. The label is an `<input>`
// bound to the edge's `data`, positioned at the middle of the path by `edgeLabel()`.
import { html } from 'lit';
import { baseEdge, defineEdgeType, edgeLabel, getSmoothStepPath } from '@xy-lit/flow';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type LabelData = { text: string };

const labelEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, x, y] = getSmoothStepPath(p);
    const data = p.data as LabelData | undefined;
    return {
      path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style }),
      label: edgeLabel(
        flow,
        { edgeId: p.id, x, y, style: 'padding: 0; background: transparent; font-size: 12px;' },
        html`<input
          class="nodrag nopan"
          aria-label="Label of edge ${p.id}"
          style="width: ${Math.max(6, (data?.text ?? '').length + 2)}ch; font: inherit; padding: 2px 6px; border: 1px solid #b1b1b7; border-radius: 4px;"
          .value=${data?.text ?? ''}
          @input=${(e: Event) =>
            flow.updateEdgeData(p.id, { text: (e.target as HTMLInputElement).value })}
        />`,
      ),
    };
  },
});

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Prepare' }, ...lr },
  { id: 'b', position: { x: 250, y: 120 }, data: { label: 'Review' }, ...lr },
  { id: 'c', type: 'output', position: { x: 500, y: 0 }, data: { label: 'Publish' }, ...lr },
];
const edges: Edge[] = [
  { id: 'a-b', type: 'label', source: 'a', target: 'b', data: { text: 'draft' } },
  { id: 'b-c', type: 'label', source: 'b', target: 'c', data: { text: 'approved' } },
];

class EdgeLabelRendererExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .edgeTypes=${{ label: labelEdge }}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background variant="lines" gap="24"></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">
          Edit the labels in place; they live in <code>edge.data</code>.
        </div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-edge-label-renderer', EdgeLabelRendererExample);
