// e2e page for tests/e2e/lit/wheel.spec.ts: a node with scrollable content, and one without.
import { html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const scrolling = defineNodeType({
  render: () =>
    html`<div class="scroller" style="width:160px;height:80px;overflow:auto;background:#fff">
      ${Array.from({ length: 30 }, (_, i) => html`<div style="height:20px">row ${i}</div>`)}
    </div>`,
});

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [
      { id: 'a', type: 'scrolling', position: { x: 300, y: 200 }, data: {} },
      { id: 'b', position: { x: 600, y: 400 }, data: { label: 'plain' } },
    ],
    props: { nodeTypes: { scrolling } },
    attributes: new URLSearchParams(location.search).has('off')
      ? { 'wheel-scroll-detection': 'off' }
      : {},
  });
  show(root, flow);
};
export default mount;
