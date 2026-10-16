// e2e page for tests/e2e/lit/controlled.spec.ts: the app owns the nodes and edges. It cancels
// `nodes-change` / `edges-change` and applies the changes itself. The variant that ignores every
// change is `/examples/e2e-controlled-ignore`.
import { applyEdgeChanges, applyNodeChanges } from '@xy-lit/flow';
import type { Edge, EdgeChange, Node, NodeChange } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, recordEvents, show } from '../lib/e2e';

const mount: Mount = (root) => {
  let nodes: Node[] = [
    { id: 'a', position: { x: 50, y: 50 }, data: { label: 'A' } },
    { id: 'b', position: { x: 350, y: 250 }, data: { label: 'B' } },
  ];
  let edges: Edge[] = [];
  const flow = createFlow({ nodes, edges, attributes: { 'delete-key': 'Delete' } });
  const events = recordEvents(flow, ['nodes-change', 'edges-change']);
  void events;
  flow.addEventListener('nodes-change', (e) => {
    e.preventDefault();
    nodes = applyNodeChanges((e as CustomEvent<{ changes: NodeChange[] }>).detail.changes, nodes);
    flow.nodes = nodes;
  });
  flow.addEventListener('edges-change', (e) => {
    e.preventDefault();
    edges = applyEdgeChanges((e as CustomEvent<{ changes: EdgeChange[] }>).detail.changes, edges);
    flow.edges = edges;
  });
  show(root, flow);
};
export default mount;
