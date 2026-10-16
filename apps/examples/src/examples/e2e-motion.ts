// e2e page for tests/e2e/lit/motion.spec.ts and a demo of entrance motion: `motion="enter"` with a
// recorder that notes every node/edge that ever carried the `entering` class (`window.__entered`).
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

declare global {
  interface Window {
    __entered?: { nodes: string[]; edges: string[] };
  }
}

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 50, y: 50 }, data: { label: 'A' } },
      { id: 'b', position: { x: 350, y: 50 }, data: { label: 'B' } },
      { id: 'c', position: { x: 650, y: 50 }, data: { label: 'C' } },
    ],
    edges: [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-c', source: 'b', target: 'c' },
    ],
    attributes: { motion: 'enter', 'fit-view': '' },
    style: 'display:block;width:100vw;height:100vh;--xy-enter-duration:300ms',
  });
  const entered = { nodes: new Set<string>(), edges: new Set<string>() };
  window.__entered = { nodes: [], edges: [] };
  show(root, flow);
  void flow.updateComplete.then(() => {
    const scan = (): void => {
      for (const el of flow.renderRoot.querySelectorAll<HTMLElement>('xy-node.entering')) {
        entered.nodes.add(el.dataset.id ?? '');
      }
      for (const g of flow.renderRoot.querySelectorAll<SVGGElement>('g.lit-flow__edge.entering')) {
        entered.edges.add(g.dataset.id ?? '');
      }
      window.__entered = { nodes: [...entered.nodes], edges: [...entered.edges] };
    };
    new MutationObserver(scan).observe(flow.renderRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  });
};
export default mount;
