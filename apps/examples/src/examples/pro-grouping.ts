import '@xy-lit/pro/define.js';
import { LocalHistory, groupSelection, installDropIntoGroup, ungroup } from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const size = { width: 120, height: 50 };
const nodes: Node[] = [
  { id: 'a', position: { x: 100, y: 100 }, data: { label: 'A' }, ...size },
  { id: 'b', position: { x: 300, y: 180 }, data: { label: 'B' }, ...size },
  { id: 'c', position: { x: 600, y: 100 }, data: { label: 'C' }, ...size },
  { id: 'lane', type: 'group', position: { x: 100, y: 380 }, data: {}, width: 420, height: 200 },
];
const edges: Edge[] = [{ id: 'ab', source: 'a', target: 'b' }];

// Select nodes and press "Group" (Shift-drag for a selection box). Drag a node onto the lane to
// move it into the group, and out again to free it.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  const history = new LocalHistory(flow);
  installDropIntoGroup(flow);
  Object.assign(window, { proHistory: history });
  toolbar(root, {
    Group: () => void groupSelection(flow, { data: { label: 'Group' } }),
    Ungroup: () => {
      for (const n of flow.nodes) if (n.selected && n.type === 'group') ungroup(flow, n.id);
    },
    Undo: () => history.undo(),
    Redo: () => history.redo(),
  });
};
export default mount;
