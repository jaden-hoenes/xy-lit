// e2e page for tests/e2e/lit/vertical-edges.spec.ts: top/bottom handles, one edge per built-in type.
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const types = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;

const mount: Mount = (root) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  types.forEach((type, i) => {
    const x = 40 + i * 200;
    const down = { sourcePosition: Position.Bottom, targetPosition: Position.Top };
    nodes.push(
      { id: `s-${type}`, position: { x, y: 40 }, data: { label: `src ${type}` }, ...down },
      { id: `t-${type}`, position: { x: x + 30, y: 300 }, data: { label: `tgt ${type}` }, ...down },
    );
    edges.push({ id: `e-${type}`, type, source: `s-${type}`, target: `t-${type}` });
  });
  show(root, createFlow({ nodes, edges }));
};
export default mount;
