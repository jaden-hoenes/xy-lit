// Lit port of the Svelte fixture component `node-toolbar/components/ToolbarNode.svelte` (kept as `.svelte.txt` for reference).
import { css, html } from 'lit';
import { Position, defineNodeType, nodeToolbar } from '@xy-lit/flow';
import type { Align, Node } from '@xy-lit/flow';

type ToolbarData = {
  label: string;
  toolbarPosition: Position;
  toolbarAlign: Align;
  toolbarVisible: boolean;
};

export default defineNodeType<Node<ToolbarData>>({
  styles: css`
    .node {
      width: 200px;
      height: 50px;
      border: solid 1px black;
    }
  `,
  render: ({ data }) => html`${nodeToolbar(
      { isVisible: data.toolbarVisible, position: data.toolbarPosition, align: data.toolbarAlign },
      html`<button>delete</button><button>copy</button><button>expand</button>`,
    )}<div class="node">
      <div>${data.label}</div>
      <xy-handle type="target" position="left"></xy-handle>
      <xy-handle type="source" position="right"></xy-handle>
    </div>`,
});
