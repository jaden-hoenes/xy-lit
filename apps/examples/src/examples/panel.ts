// Demo: <xy-panel> in every position.
import '@xy-lit/flow/define.js';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'center-left',
  'center-right',
] as const;

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [{ id: 'a', position: { x: 200, y: 150 }, data: { label: 'Panels around me' } }],
    attributes: { 'fit-view': '' },
  });
  for (const position of POSITIONS) {
    const panel = document.createElement('xy-panel');
    panel.setAttribute('position', position);
    panel.textContent = position;
    panel.style.cssText = 'font:12px sans-serif';
    flow.append(panel);
  }
  show(root, flow);
};
export default mount;
