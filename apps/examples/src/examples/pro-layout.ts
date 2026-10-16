import '@xy-lit/pro/define.js';
import { LocalHistory, applyLayout, layoutBackend } from '@xy-lit/pro';
import type { ApplyLayoutOptions } from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const ids = ['root', 'a', 'b', 'c', 'a1', 'a2', 'b1', 'c1', 'c2', 'c3', 'join'];
const nodes: Node[] = ids.map((id, i) => ({
  id,
  position: { x: (i % 4) * 40, y: Math.floor(i / 4) * 30 },
  data: { label: id },
}));
const pairs: [string, string][] = [
  ['root', 'a'],
  ['root', 'b'],
  ['root', 'c'],
  ['a', 'a1'],
  ['a', 'a2'],
  ['b', 'b1'],
  ['c', 'c1'],
  ['c', 'c2'],
  ['c', 'c3'],
  ['a1', 'join'],
  ['b1', 'join'],
  ['c3', 'join'],
];
const edges: Edge[] = pairs.map(([source, target]) => ({
  id: `${source}-${target}`,
  source,
  target,
}));

// Auto layout runs in a Web Worker (dagre, elk, d3-hierarchy, d3-force); one undo step each.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  const history = new LocalHistory(flow);
  Object.assign(window, { proHistory: history });
  const run = (options: ApplyLayoutOptions) => async () => {
    await applyLayout(flow, { animate: 400, fitView: true, ...options });
    status.textContent = `layout ran in: ${layoutBackend()}`;
  };
  const { status } = toolbar(root, {
    'Dagre TB': run({ algorithm: 'dagre', direction: 'TB' }),
    'Dagre LR': run({ algorithm: 'dagre', direction: 'LR' }),
    Elk: run({ algorithm: 'elk' }),
    Tree: run({ algorithm: 'tree' }),
    Force: run({ algorithm: 'force' }),
    Undo: () => history.undo(),
  });
};
export default mount;
