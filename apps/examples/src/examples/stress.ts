// reactflow.dev "Stress": thousands of nodes and edges, with controls to try the options that matter
// for performance (`only-render-visible-elements`, the minimap). The same grid backs `/stress/:count`.
import { html } from 'lit';
import { ExampleElement, initial, mountExample } from '../lib/demo';
import { stressData } from '../lib/stress';

const counts = [100, 500, 1000, 5000, 10000] as const;

class StressExample extends ExampleElement {
  static override properties = {
    count: { state: true },
    onlyVisible: { state: true },
    minimap: { state: true },
    renderMs: { state: true },
  };
  declare count: number;
  declare onlyVisible: boolean;
  declare minimap: boolean;
  declare renderMs: number | null;
  readonly #first: ReturnType<typeof stressData>;

  constructor() {
    super();
    const q = new URLSearchParams(location.search);
    this.count = Number(q.get('count')) || 1000;
    this.onlyVisible = q.has('visible');
    this.minimap = q.has('minimap');
    this.renderMs = null;
    this.#first = stressData(this.count);
  }

  #load(count: number): void {
    this.count = count;
    this.renderMs = null;
    const t0 = performance.now();
    const { nodes, edges } = stressData(count);
    const flow = this.flow;
    flow.addEventListener(
      'render-complete',
      () => (this.renderMs = Math.round(performance.now() - t0)),
      { once: true },
    );
    flow.nodes = nodes;
    flow.edges = edges;
    void flow.fitView();
  }

  override render() {
    const { nodes, edges } = this.#first;
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      min-zoom="0.02"
      fit-view
      ?only-render-visible-elements=${this.onlyVisible}
    >
      <xy-controls></xy-controls>
      ${this.minimap ? html`<xy-minimap pannable zoomable></xy-minimap>` : ''}
      <xy-panel position="top-left">
        <div class="ex-box">
          <div class="ex-btns" role="group" aria-label="Node count">
            ${counts.map(
              (c) =>
                html`<button
                  class="ex-btn"
                  data-count=${c}
                  aria-pressed=${this.count === c}
                  @click=${() => this.#load(c)}
                >
                  ${c.toLocaleString('en')}
                </button>`,
            )}
          </div>
          <label style="display: block; margin-top: 6px"
            ><input
              type="checkbox"
              .checked=${this.onlyVisible}
              @change=${(e: Event) => (this.onlyVisible = (e.target as HTMLInputElement).checked)}
            />
            only render visible elements</label
          >
          <label style="display: block"
            ><input
              type="checkbox"
              .checked=${this.minimap}
              @change=${(e: Event) => (this.minimap = (e.target as HTMLInputElement).checked)}
            />
            minimap</label
          >
          <div class="ex-muted" data-testid="stress-status">
            ${this.count.toLocaleString('en')} nodes, ${(this.count - 1).toLocaleString('en')}
            edges${this.renderMs === null ? '' : `, rendered in ${this.renderMs} ms`}
          </div>
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-stress', StressExample);
