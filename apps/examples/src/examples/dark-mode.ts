// reactflow.dev "Dark mode": `color-mode` switches the flow between light, dark and the system
// setting. The panel is a normal child of the flow, and the page follows the same mode.
import { css, html } from 'lit';
import { Position, defineNodeType } from '@xy-lit/flow';
import type { ColorMode, Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

// custom nodes read the flow's colour variables, so they follow the mode without any script
const themed = defineNodeType<Node<{ label: string }>>({
  styles: css`
    .ex-card {
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid var(--xy-node-border-color, #1a192b);
      background: var(--xy-node-background-color, #fff);
      color: var(--xy-node-color, #222);
      font-size: 12px;
    }
  `,
  render: ({ data }) =>
    html`<div class="ex-card">
      <xy-handle type="target" position="left"></xy-handle>
      ${data.label}
      <xy-handle type="source" position="right"></xy-handle>
    </div>`,
});

const nodes: Node[] = [
  {
    id: 'A',
    type: 'input',
    position: { x: 0, y: 100 },
    data: { label: 'Input' },
    sourcePosition: Position.Right,
  },
  { id: 'B', type: 'themed', position: { x: 250, y: 0 }, data: { label: 'Themed card B' } },
  {
    id: 'C',
    position: { x: 250, y: 100 },
    data: { label: 'Default node C' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  { id: 'D', type: 'themed', position: { x: 250, y: 200 }, data: { label: 'Themed card D' } },
  {
    id: 'E',
    type: 'output',
    position: { x: 500, y: 100 },
    data: { label: 'Output' },
    targetPosition: Position.Left,
  },
];
const edges: Edge[] = [
  { id: 'A-B', source: 'A', target: 'B', animated: true },
  { id: 'A-C', source: 'A', target: 'C' },
  { id: 'A-D', source: 'A', target: 'D' },
  { id: 'B-E', source: 'B', target: 'E' },
  { id: 'C-E', source: 'C', target: 'E' },
  { id: 'D-E', source: 'D', target: 'E' },
];

const modes: ColorMode[] = ['light', 'dark', 'system'];

class DarkModeExample extends ExampleElement {
  static override properties = { mode: { state: true } };
  declare mode: ColorMode;
  constructor() {
    super();
    this.mode = 'system';
  }

  protected override willUpdate(): void {
    // the panel is page content outside the flow, so the page follows the mode itself
    const dark =
      this.mode === 'dark' ||
      (this.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    this.classList.toggle('ex-dark', dark);
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${{ themed }}
      color-mode=${this.mode}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-minimap pannable zoomable></xy-minimap>
      <xy-background variant="dots"></xy-background>
      <xy-panel position="top-right">
        <div class="ex-box ex-btns" role="group" aria-label="Colour mode">
          ${modes.map(
            (m) =>
              html`<button
                class="ex-btn"
                data-mode=${m}
                aria-pressed=${this.mode === m}
                @click=${() => (this.mode = m)}
              >
                ${m}
              </button>`,
          )}
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-dark-mode', DarkModeExample);
