// e2e page for tests/e2e/lit/connection-outside.spec.ts (spec/06 §Pointer capture): a small flow with
// room around it, so the pointer can leave the flow while a connection is being dragged.
import type { Mount } from '../router';
import { createFlow, recordEvents, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 20, y: 20 }, data: { label: 'A' } },
      { id: 'b', position: { x: 20, y: 160 }, data: { label: 'B' } },
    ],
    // auto-pan would scroll the nodes out of the small host while the pointer is outside
    attributes: { 'auto-pan-on-connect': 'false' },
    style: 'display:block;width:300px;height:260px;margin:200px',
  });
  recordEvents(flow, ['connect-start', 'connect-end', 'connect']);
  show(root, flow);
};
export default mount;
