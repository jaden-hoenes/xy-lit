// e2e page for tests/e2e/lit/reconnect.spec.ts: `edges-reconnectable` is off until the checkbox is ticked.
import type { Mount } from '../router';
import { createFlow, recordEvents, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 50, y: 40 }, data: { label: 'A' } },
      { id: 'b', position: { x: 50, y: 240 }, data: { label: 'B' } },
      { id: 'c', position: { x: 450, y: 240 }, data: { label: 'C' } },
    ],
    edges: [{ id: 'e', source: 'a', target: 'b' }],
    props: { connectionDragThreshold: 0 },
  });
  recordEvents(flow, ['reconnect-start', 'reconnect', 'reconnect-end']);

  const panel = document.createElement('label');
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:20;background:#fff;padding:4px';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.dataset.testid = 'reconnectable';
  box.addEventListener('change', () => {
    flow.edgesReconnectable = box.checked;
  });
  panel.append(box, ' edges-reconnectable');

  show(root, flow, panel);
};
export default mount;
