import '@xy-lit/pro/define.js';
import { LocalHistory, installHelperLines } from '@xy-lit/pro';
import type { Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const size = { width: 120, height: 50 };
const nodes: Node[] = [
  { id: 'a', position: { x: 100, y: 100 }, data: { label: 'A' }, ...size },
  { id: 'b', position: { x: 400, y: 260 }, data: { label: 'B' }, ...size },
  { id: 'c', position: { x: 700, y: 120 }, data: { label: 'C' }, ...size },
  { id: 'd', position: { x: 250, y: 420 }, data: { label: 'D' }, ...size },
];

// Drag one node near another node's edges or centre: it snaps and a guide line appears.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  const history = new LocalHistory(flow);
  let snap = true;
  let lines = installHelperLines(flow, { threshold: 6, snap });
  Object.assign(window, { proHistory: history });
  const { buttons } = toolbar(root, {
    'Snap: on': () => {
      snap = !snap;
      lines();
      lines = installHelperLines(flow, { snap });
      buttons['Snap: on']!.textContent = `Snap: ${snap ? 'on' : 'off'}`;
    },
    Undo: () => history.undo(),
    Redo: () => history.redo(),
  });
};
export default mount;
