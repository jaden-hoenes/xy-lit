// e2e page for tests/e2e/lit/xss.spec.ts: markup in data must show up as text, never as elements.
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const evil = '<img src=x onerror=window.__pwned=1>';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', position: { x: 50, y: 50 }, data: { label: evil } },
      { id: 'b', position: { x: 450, y: 250 }, data: { label: 'B' } },
    ],
    edges: [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        label: evil,
        startLabel: `start ${evil}`,
        endLabel: `end ${evil}`,
      },
    ],
  });
  show(root, flow);
};
export default mount;
