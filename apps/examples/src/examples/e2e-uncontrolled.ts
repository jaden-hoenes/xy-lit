// e2e page for tests/e2e/lit/uncontrolled.spec.ts: a plain flow that owns its state.
import type { Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const nodes: Node[] = [
  { id: 'a', position: { x: 50, y: 50 }, data: { label: 'A' } },
  { id: 'b', position: { x: 350, y: 250 }, data: { label: 'B' } },
  { id: 'c', position: { x: 650, y: 50 }, data: { label: 'C' } },
];

const mount: Mount = (root) => {
  const flow = createFlow({ nodes, attributes: { 'delete-key': 'Delete' } });
  show(root, flow);
};
export default mount;
