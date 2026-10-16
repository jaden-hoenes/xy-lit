import '@xy-lit/pro/define.js';
import { LocalHistory } from '@xy-lit/pro';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const nodes: Node[] = [
  { id: 'a', position: { x: 100, y: 120 }, data: { label: 'A' } },
  { id: 'b', position: { x: 400, y: 120 }, data: { label: 'B' } },
  { id: 'c', position: { x: 250, y: 280 }, data: { label: 'C' } },
];
const edges: Edge[] = [{ id: 'ab', source: 'a', target: 'b' }];

// Drag nodes, delete (Backspace), connect: Mod+Z / Mod+Shift+Z (or the buttons) undo and redo.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  flow.edges = edges;
  const history = new LocalHistory(flow, { maxSteps: 100 });
  Object.assign(window, { proHistory: history });
  const { buttons, status } = toolbar(root, {
    Undo: () => history.undo(),
    Redo: () => history.redo(),
  });
  const update = (): void => {
    buttons['Undo']!.disabled = !history.canUndo();
    buttons['Redo']!.disabled = !history.canRedo();
    status.textContent = `undo ${history.undoSize} / redo ${history.redoSize}`;
  };
  history.subscribe(update);
  update();
};
export default mount;
