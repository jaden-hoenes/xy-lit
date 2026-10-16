import '@xy-lit/pro/define.js';
import { LocalHistory, animateNodePositions } from '@xy-lit/pro';
import type { Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { demoFlow, toolbar } from '../lib/pro-demo';

const nodes: Node[] = Array.from({ length: 8 }, (_, i) => ({
  id: `n${i}`,
  position: { x: 100 + i * 90, y: 100 },
  data: { label: `N${i}` },
}));

const circle = (cx: number, cy: number, r: number): Record<string, { x: number; y: number }> =>
  Object.fromEntries(
    nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      return [n.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }];
    }),
  );

// Buttons animate all nodes to a circle or a row. One animation = one undo step.
const mount: Mount = (root) => {
  const flow = demoFlow(root);
  flow.nodes = nodes;
  const history = new LocalHistory(flow);
  Object.assign(window, { proHistory: history });
  toolbar(root, {
    Circle: () => void animateNodePositions(flow, circle(500, 340, 220), { duration: 600 }),
    Row: () =>
      void animateNodePositions(flow, Object.fromEntries(nodes.map((n) => [n.id, n.position])), {
        duration: 600,
      }),
    Undo: () => history.undo(),
  });
};
export default mount;
