// Demo: <xy-minimap> that is pannable and zoomable, with per-node colours.
import '@xy-lit/flow/define.js';
import type { Node } from '@xy-lit/flow';
import type { XyMinimapElement } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const nodes: Node[] = [];
  for (let i = 0; i < 40; i++) {
    nodes.push({
      id: `n${i}`,
      position: { x: (i % 8) * 220, y: Math.floor(i / 8) * 140 },
      data: { label: `Node ${i}` },
      class: i % 3 === 0 ? 'accent' : '',
    });
  }
  const flow = createFlow({ nodes, attributes: { 'fit-view': '' } });
  const minimap = document.createElement('xy-minimap') as XyMinimapElement;
  minimap.setAttribute('pannable', '');
  minimap.setAttribute('zoomable', '');
  minimap.nodeColor = (node) => (node.class === 'accent' ? '#6366f1' : '#cbd5e1');
  minimap.nodeStrokeWidth = 2;
  flow.append(minimap);
  show(root, flow);
};
export default mount;
