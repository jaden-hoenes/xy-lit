import '@xy-lit/pro/define.js';
import { LocalHistory, installClipboard } from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const nodes: Node[] = [
  { id: 'a', position: { x: 100, y: 120 }, data: { label: 'A' } },
  { id: 'b', position: { x: 400, y: 120 }, data: { label: 'B' } },
  { id: 'g', type: 'group', position: { x: 100, y: 300 }, width: 360, height: 180, data: {} },
  { id: 'k1', parentId: 'g', position: { x: 20, y: 30 }, data: { label: 'K1' } },
  { id: 'k2', parentId: 'g', position: { x: 200, y: 90 }, data: { label: 'K2' } },
];
const edges: Edge[] = [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'k', source: 'k1', target: 'k2' },
];

// Select nodes, then Mod+C / Mod+X / Mod+V / Mod+D (or the buttons). Paste lands at the pointer.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  const history = new LocalHistory(flow);
  const clipboard = installClipboard(flow);
  Object.assign(window, { proHistory: history, clipboard });
  toolbar(root, {
    Copy: () => void clipboard.copy(),
    Cut: () => void clipboard.cut(),
    Paste: () => void clipboard.paste(),
    Duplicate: () => void clipboard.duplicate(),
    Undo: () => history.undo(),
  });
};
export default mount;
