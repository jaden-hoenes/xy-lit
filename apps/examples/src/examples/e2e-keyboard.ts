// e2e page for tests/e2e/lit/keyboard.spec.ts: keyboard interaction with nodes and the aria-live text.
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 100, y: 100 }, data: { label: 'A' } },
      { id: 'b', position: { x: 400, y: 300 }, data: { label: 'B' } },
    ],
    attributes: { 'delete-key': 'Delete' },
  });
  show(root, flow);
};
export default mount;
