// e2e page for tests/e2e/lit/controlled.spec.ts: the app cancels every change and applies none of the
// user's (position, selection, removal), so nothing may move, select or disappear. Like every
// controlled flow it has to apply the measurements (`dimensions` changes), or nodes never become visible.
import { applyNodeChanges } from '@xy-lit/flow';
import type { Node, NodeChange } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, recordEvents, show } from '../lib/e2e';

const mount: Mount = (root) => {
  let nodes: Node[] = [
    { id: 'a', position: { x: 50, y: 50 }, data: { label: 'A' } },
    { id: 'b', position: { x: 350, y: 250 }, data: { label: 'B' } },
  ];
  const flow = createFlow({ nodes, attributes: { 'delete-key': 'Delete' } });
  recordEvents(flow, ['nodes-change', 'edges-change']);
  flow.addEventListener('nodes-change', (e) => {
    e.preventDefault();
    const { changes } = (e as CustomEvent<{ changes: NodeChange[] }>).detail;
    const measured = changes.filter((c) => c.type === 'dimensions');
    if (measured.length === 0) return;
    nodes = applyNodeChanges(measured, nodes);
    flow.nodes = nodes;
  });
  flow.addEventListener('edges-change', (e) => {
    e.preventDefault();
  });
  show(root, flow);
};
export default mount;
