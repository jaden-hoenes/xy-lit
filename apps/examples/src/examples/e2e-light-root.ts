// e2e page for tests/e2e/lit/light-root.spec.ts and demo of `render-root="light"`: the flow renders
// into the document, so a global stylesheet (here a Tailwind-like utility class) styles node content.
import { html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const utilities = `
  .tw-bg-rose { background-color: rgb(244, 63, 94); }
  .tw-text-white { color: rgb(255, 255, 255); }
  .tw-p-4 { padding: 16px; }
  .tw-rounded-xl { border-radius: 12px; }
`;

const card = defineNodeType({
  render: ({ data }) =>
    html`<div class="tw-bg-rose tw-text-white tw-p-4 tw-rounded-xl" data-testid="card">
      <xy-handle type="target" position="left"></xy-handle>
      ${(data as { label: string }).label}
      <xy-handle type="source" position="right"></xy-handle>
    </div>`,
});

const mount: Mount = (root) => {
  const style = document.createElement('style');
  style.textContent = utilities;
  const flow = createFlow({
    nodes: [
      { id: 'a', type: 'card', position: { x: 50, y: 80 }, data: { label: 'Card A' } },
      { id: 'b', type: 'card', position: { x: 400, y: 200 }, data: { label: 'Card B' } },
    ],
    props: { nodeTypes: { card } },
    attributes: { 'render-root': 'light' },
  });
  // plugins are light children of the flow: the flow projects them into its wrapper
  flow.append(
    document.createElement('xy-background'),
    document.createElement('xy-controls'),
    document.createElement('xy-minimap'),
  );
  document.head.append(style);
  show(root, flow);
};
export default mount;
