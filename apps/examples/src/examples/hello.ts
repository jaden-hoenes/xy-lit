// The smallest possible flow: three nodes and two edges in plain DOM, no framework.
import '@xy-lit/flow/define.js';
import type { XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';

const mount: Mount = (root) => {
  const flow = document.createElement('xy-flow') as XyFlowElement;
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  flow.setAttribute('fit-view', '');
  flow.nodes = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
    { id: '2', position: { x: 200, y: 100 }, data: { label: 'XY Lit' } },
    { id: '3', type: 'output', position: { x: 400, y: 0 }, data: { label: 'World' } },
  ];
  flow.edges = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', animated: true },
  ];
  root.replaceChildren(flow);
  Object.assign(window, { flow });
};
export default mount;
