// Lit port of the Svelte fixture component `nodes/components/DragHandleNode.svelte` (kept as `.svelte.txt` for reference).
import { css, html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';

export default defineNodeType({
  styles: css`
    .container {
      width: 100px;
      height: 50px;
      background: red;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .drag-handle {
      display: inline-block;
      width: 25px;
      height: 25px;
      background-color: green;
    }
  `,
  render: () => html`<div class="container"><div class="drag-handle custom-drag-handle"></div></div>`,
});
