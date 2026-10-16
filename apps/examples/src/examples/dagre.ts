// reactflow.dev "Layouting" with dagre, using `@xy-lit/pro`: `applyLayout` measures the nodes,
// runs dagre in a worker and animates the nodes to their new positions. Switching direction also
// moves the handles to the matching sides.
import '@xy-lit/pro/define.js';
import { html } from 'lit';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { LocalHistory, applyLayout, layoutBackend } from '@xy-lit/pro';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const labels = ['1', '2', '2a', '2b', '2c', '2d', '3', '4', '5', '6', '7'];
// every node starts at the origin: the layout decides where it goes
const nodes: Node[] = labels.map((id, i) => ({
  id,
  type: i === 0 ? 'input' : i === labels.length - 1 ? 'output' : 'default',
  position: { x: 0, y: 0 },
  data: { label: `node ${id}` },
}));
const pairs: [string, string][] = [
  ['1', '2'],
  ['1', '3'],
  ['2', '2a'],
  ['2', '2b'],
  ['2', '2c'],
  ['2c', '2d'],
  ['3', '4'],
  ['4', '5'],
  ['5', '6'],
  ['5', '7'],
];
const edges: Edge[] = pairs.map(([source, target]) => ({
  id: `e${source}-${target}`,
  source,
  target,
  type: 'smoothstep',
  animated: true,
}));

type Direction = 'TB' | 'LR';

class DagreExample extends ExampleElement {
  static override properties = { direction: { state: true }, backend: { state: true } };
  declare direction: Direction;
  declare backend: string;
  #history?: LocalHistory;
  constructor() {
    super();
    this.direction = 'TB';
    this.backend = '';
  }

  override firstUpdated(): void {
    super.firstUpdated();
    const flow = this.flow;
    this.#history = new LocalHistory(flow);
    // lay the graph out once, when every node has been measured
    void flow.whenRendered().then(() => this.#layout('TB', false));
  }

  async #layout(direction: Direction, animate = true): Promise<void> {
    const flow = this.flow;
    this.direction = direction;
    const horizontal = direction === 'LR';
    // handles follow the direction, like in the reactflow.dev example
    for (const node of flow.getNodes()) {
      flow.updateNode(node.id, {
        sourcePosition: horizontal ? Position.Right : Position.Bottom,
        targetPosition: horizontal ? Position.Left : Position.Top,
      });
    }
    // let the handle change land (and be measured) before the layout reads the nodes
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await applyLayout(flow, {
      algorithm: 'dagre',
      direction,
      animate: animate ? 300 : 0,
      fitView: true,
      keepPosition: false,
    });
    this.backend = layoutBackend();
  }

  override render() {
    return html`<xy-flow .nodes=${initial(nodes)} .edges=${initial(edges)} min-zoom="0.1">
      <xy-controls></xy-controls>
      <xy-minimap pannable zoomable></xy-minimap>
      <xy-background variant="dots"></xy-background>
      <xy-panel position="top-left">
        <div class="ex-box ex-btns" role="group" aria-label="Layout">
          <button
            class="ex-btn"
            data-direction="TB"
            aria-pressed=${this.direction === 'TB'}
            @click=${() => this.#layout('TB')}
          >
            vertical layout
          </button>
          <button
            class="ex-btn"
            data-direction="LR"
            aria-pressed=${this.direction === 'LR'}
            @click=${() => this.#layout('LR')}
          >
            horizontal layout
          </button>
          <button class="ex-btn" data-action="undo" @click=${() => this.#history?.undo()}>
            undo
          </button>
          <span class="ex-muted" data-testid="backend"
            >${this.backend ? `dagre in ${this.backend}` : ''}</span
          >
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-dagre', DagreExample);
