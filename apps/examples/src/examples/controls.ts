// Demo: <xy-controls> (vertical and horizontal) with a custom <xy-control-button>.
import '@xy-lit/flow/define.js';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', position: { x: 250, y: 120 }, data: { label: 'B' } },
    ],
    edges: [{ id: 'a-b', source: 'a', target: 'b' }],
    attributes: { 'fit-view': '' },
  });
  const controls = document.createElement('xy-controls');
  const custom = document.createElement('xy-control-button');
  custom.dataset.testid = 'custom-button';
  custom.title = 'Log';
  custom.textContent = 'i';
  custom.addEventListener('click', () => {
    console.log('custom control clicked');
  });
  controls.append(custom);
  const horizontal = document.createElement('xy-controls');
  horizontal.setAttribute('orientation', 'horizontal');
  horizontal.setAttribute('position', 'top-left');
  horizontal.setAttribute('show-interactive', 'false');
  const bg = document.createElement('xy-background');
  flow.append(bg, controls, horizontal);
  show(root, flow);
};
export default mount;
