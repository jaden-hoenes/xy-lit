/**
 * Every pro feature on one flow: history + clipboard + helper lines + drop-into-group + layout +
 * collapse + grouping. The page tests/e2e/lit/pro.spec.ts drives it.
 */
import '@xy-lit/pro/define.js';
import {
  LocalHistory,
  applyLayout,
  collapseAll,
  expandAll,
  groupSelection,
  installClipboard,
  installDropIntoGroup,
  installHelperLines,
  layoutBackend,
  toggleCollapsed,
  ungroup,
} from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const size = { width: 120, height: 50 };
const nodes: Node[] = [
  { id: 'a', position: { x: 100, y: 100 }, data: { label: 'A' }, ...size },
  { id: 'b', position: { x: 400, y: 100 }, data: { label: 'B' }, ...size },
  { id: 'c', position: { x: 700, y: 300 }, data: { label: 'C' }, ...size },
  { id: 'd', position: { x: 160, y: 300 }, data: { label: 'D' }, ...size },
  { id: 'e', position: { x: 160, y: 500 }, data: { label: 'E' }, ...size },
];
const edges: Edge[] = [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'bc', source: 'b', target: 'c' },
  { id: 'ad', source: 'a', target: 'd' },
  { id: 'de', source: 'd', target: 'e' },
];

const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  flow.setAttribute('fit-view', '');

  // order matters only for readability: history records the inverse of whatever the later
  // middlewares leave in the change, and plays it back with origin 'undo'
  const history = new LocalHistory(flow);
  const clipboard = installClipboard(flow);
  const helperLines = installHelperLines(flow);
  const dropIntoGroup = installDropIntoGroup(flow);

  const layout = async (direction: 'TB' | 'LR'): Promise<void> => {
    await applyLayout(flow, { algorithm: 'dagre', direction, animate: 200, fitView: true });
    status.textContent = `layout: ${layoutBackend()}`;
  };
  const { status } = toolbar(root, {
    Undo: () => history.undo(),
    Redo: () => history.redo(),
    Copy: () => void clipboard.copy(),
    Paste: () => void clipboard.paste(),
    Duplicate: () => void clipboard.duplicate(),
    Group: () => void groupSelection(flow),
    Ungroup: () => {
      for (const n of flow.nodes) if (n.selected && n.type === 'group') ungroup(flow, n.id);
    },
    'Layout LR': () => layout('LR'),
    'Layout TB': () => layout('TB'),
    'Collapse all': () => void collapseAll(flow),
    'Expand all': () => void expandAll(flow),
  });
  Object.assign(window, {
    pro: {
      history,
      clipboard,
      helperLines,
      dropIntoGroup,
      applyLayout,
      toggleCollapsed,
      groupSelection,
      ungroup,
      layoutBackend,
    },
  });
};
export default mount;
