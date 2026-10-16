import '@xy-lit/pro/define.js';
import {
  LocalHistory,
  applyLayout,
  collapseAll,
  expandAll,
  isCollapsed,
  toggleCollapsed,
} from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const tree: Record<string, string[]> = {
  root: ['a', 'b', 'c'],
  a: ['a1', 'a2'],
  b: ['b1'],
  c: ['c1', 'c2'],
  c2: ['c21', 'c22'],
};
const ids = new Set(['root', ...Object.values(tree).flat()]);
const nodes: Node[] = [...ids].map((id) => ({
  id,
  position: { x: 0, y: 0 },
  data: { label: id },
}));
const edges: Edge[] = Object.entries(tree).flatMap(([source, targets]) =>
  targets.map((target) => ({ id: `${source}-${target}`, source, target })),
);

// Double-click a node to collapse or expand its subtree; the layout follows.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  const history = new LocalHistory(flow);
  Object.assign(window, { proHistory: history });
  const relayout = () =>
    applyLayout(flow, { algorithm: 'dagre', direction: 'LR', animate: 250, fitView: true });
  const label = (): void =>
    history.withoutRecording(() => {
      flow.nodes = flow.nodes.map((n) =>
        n.id in tree
          ? { ...n, data: { ...n.data, label: `${isCollapsed(flow, n.id) ? '▸' : '▾'} ${n.id}` } }
          : n,
      );
    });
  flow.addEventListener('node-double-click', (e) => {
    toggleCollapsed(flow, e.detail.node.id);
    label();
    void relayout();
  });
  flow.addEventListener('nodes-initialized', () => void relayout(), { once: true });
  toolbar(root, {
    'Collapse all': () => {
      collapseAll(flow);
      label();
      return relayout();
    },
    'Expand all': () => {
      expandAll(flow);
      label();
      return relayout();
    },
    Undo: () => history.undo(),
  });
};
export default mount;
