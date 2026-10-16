// e2e page for tests/e2e/lit/render-complete.spec.ts: records every `render-complete` event.
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const nodes: Node[] = [
  { id: 'a', position: { x: 60, y: 60 }, data: { label: 'A' } },
  { id: 'b', position: { x: 360, y: 60 }, data: { label: 'B' } },
  { id: 'c', position: { x: 210, y: 240 }, data: { label: 'C' } },
];
const edges: Edge[] = [
  { id: 'ab', source: 'a', target: 'b', label: 'ab' },
  { id: 'ac', source: 'a', target: 'c' },
  { id: 'bc', source: 'b', target: 'c', animated: false },
];

const mount: Mount = (root) => {
  const flow = createFlow({ nodes, edges, attributes: { 'fit-view': '' } });
  window.__renderComplete = [];
  flow.addEventListener('render-complete', (e) => {
    window.__renderComplete?.push((e as CustomEvent).detail);
  });
  show(root, flow);
};
export default mount;
