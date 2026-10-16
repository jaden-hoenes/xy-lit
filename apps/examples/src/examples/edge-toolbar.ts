// Demo: `edgeToolbar` on a custom edge (visible while the edge is selected, constant size when zooming).
import '@xy-lit/flow/define.js';
import { html } from 'lit';
import { baseEdge, defineEdgeType, edgeToolbar, getBezierPath } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const toolbarEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style }),
      label: edgeToolbar(
        flow,
        { edgeId: p.id, x, y, selected: p.selected, alignY: 'bottom' },
        html`<button
          class="nodrag nopan"
          @click=${() => flow.deleteElements({ edges: [{ id: p.id }] })}
        >
          delete edge
        </button>`,
      ),
    };
  },
});

const mount: Mount = (root) => {
  const nodes: Node[] = [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
    { id: 'b', position: { x: 300, y: 150 }, data: { label: 'B' } },
  ];
  const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b', type: 'toolbar' }];
  show(
    root,
    createFlow({
      nodes,
      edges,
      props: { edgeTypes: { toolbar: toolbarEdge } },
      attributes: { 'fit-view': '' },
    }),
  );
};
export default mount;
