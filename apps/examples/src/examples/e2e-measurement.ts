// e2e page for tests/e2e/lit/measurement.spec.ts: a node whose content size changes without a
// resizer. The engine must keep measuring it, and must never write `node.width` / `node.height`.
import { css, html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const growing = defineNodeType({
  styles: css`
    .grow {
      background: #fde68a;
      overflow: hidden;
    }
  `,
  render: ({ data }) => {
    const big = !!(data as { big?: boolean }).big;
    return html`<div class="grow" style="width:${big ? 220 : 100}px;height:${big ? 120 : 40}px">
      content
    </div>`;
  },
});

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [{ id: 'g', type: 'growing', position: { x: 100, y: 100 }, data: { big: false } }],
    props: { nodeTypes: { growing } },
  });
  show(root, flow);
  window.toggleSize = () => {
    const big = !(flow.getNode('g')?.data as { big?: boolean }).big;
    flow.updateNodeData('g', { big });
  };
};
declare global {
  interface Window {
    toggleSize?: () => void;
  }
}
export default mount;
