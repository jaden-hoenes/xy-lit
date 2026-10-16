import { css, html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { FlowNodeElement, Position } from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  chrome,
  defineStoryElement,
  describe,
  flowArgTypes,
  flowPropsOf,
  nodeCardCss,
  on,
  once,
  props,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

interface Args extends FlowArgs {
  nodeCount?: number;
  enterDuration?: number;
  enterStagger?: number;
}

const meta: Meta<Args> = {
  title: 'Flow/Lifecycle',
  component: 'xy-flow',
  argTypes: { ...flowArgTypes },
};
export default meta;
type Story = StoryObj<Args>;

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const chain = (count: number, offset = 0): Node[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `n${offset + i}`,
    position: { x: ((offset + i) % 6) * 190, y: Math.floor((offset + i) / 6) * 90 },
    data: { label: `Node ${offset + i + 1}` },
    ...lr,
  }));
const chainEdges = (count: number): Edge[] =>
  Array.from({ length: count - 1 }, (_, i) => i)
    .filter((i) => (i + 1) % 6 !== 0)
    .map((i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` }));

// ---- RenderComplete ---------------------------------------------------------------------------------

interface Timing {
  at: string;
  nodeCount: number;
  edgeCount: number;
  durationMs: number;
}

class RenderCompleteStory extends StoryElement {
  static override properties = {
    args: { attribute: false },
    timings: { state: true },
    events: { state: true },
  };
  declare args: Args;
  declare timings: Timing[];
  declare events: string[];
  #added = 0;
  constructor() {
    super();
    this.timings = [];
    this.events = [];
  }
  get #flow() {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  #note(text: string): void {
    this.events = [...this.events.slice(-5), text];
  }
  override render() {
    const count = this.args.nodeCount ?? 24;
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => {
            const offset = count + this.#added;
            this.#added += 10;
            this.#flow.addNodes(chain(10, offset));
          }}
        >
          Add 10 nodes
        </button>
        <span class="sb-muted"
          >Each batch of changes ends with another <code>render-complete</code>.</span
        >
      </div>
      <xy-flow
        ${props(flowPropsOf(this.args))}
        fit-view
        .nodes=${once(() => chain(count))}
        .edges=${once(() => chainEdges(count))}
        ${on({
          init: () => this.#note('init: pan/zoom engine ready'),
          'nodes-initialized': () => this.#note('nodes-initialized: every node measured'),
          'render-complete': (e) => {
            const d = (e as CustomEvent<Omit<Timing, 'at'>>).detail;
            this.#note(`render-complete: ${d.nodeCount} nodes, ${d.edgeCount} edges`);
            this.timings = [{ ...d, at: new Date().toLocaleTimeString() }, ...this.timings].slice(
              0,
              6,
            );
          },
        })}
      >
        ${chrome({ minimap: false })}
        <xy-panel position="top-left">
          <div class="sb-card" style="min-width: 290px">
            <h4>Lifecycle events</h4>
            <ul class="sb-log" aria-live="polite">
              ${this.events.map((e) => html`<li>${e}</li>`)}
            </ul>
            <h4 style="margin-top: 8px">render-complete timings</h4>
            <table class="sb-mono" style="border-collapse: collapse">
              <tbody>
                ${
                  this.timings.length === 0
                    ? html`<tr>
                        <td class="sb-muted">waiting&hellip;</td>
                      </tr>`
                    : this.timings.map(
                        (t) =>
                          html`<tr>
                            <td style="padding-right: 10px">${t.at}</td>
                            <td style="padding-right: 10px">${t.nodeCount} nodes</td>
                            <td style="padding-right: 10px">${t.edgeCount} edges</td>
                            <td><b>${t.durationMs.toFixed(0)} ms</b></td>
                          </tr>`,
                      )
                }
              </tbody>
            </table>
          </div>
        </xy-panel>
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-render-complete', RenderCompleteStory);

export const RenderComplete: Story = {
  args: { nodeCount: 24 },
  argTypes: { nodeCount: { control: { type: 'range', min: 4, max: 200, step: 4 } } },
  parameters: {
    ...describe(
      '`render-complete` fires once nodes are measured, edges are laid out and the viewport has settled; its detail carries `nodeCount`, `edgeCount` and `durationMs`. `await flow.whenRendered()` is the promise form, handy in tests. `init` and `nodes-initialized` come earlier in the sequence.',
    ),
    controls: { include: ['nodeCount'] },
  },
  render: (args) => html`<sb-render-complete .args=${args}></sb-render-complete>`,
};

// ---- LoadingOverlay ---------------------------------------------------------------------------------

/** A node that needs time before it has its final size, like one that waits for data or an image. */
class SlowNode extends FlowNodeElement<Node<{ label: string }>> {
  static override styles = [
    nodeCardCss,
    css`
      .sb-skeleton {
        width: 150px;
        height: 36px;
      }
    `,
  ];
  static override properties = { ...FlowNodeElement.properties, ready: { state: true } };
  declare ready: boolean;
  #timer = 0;
  constructor() {
    super();
    this.ready = false;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.#timer = window.setTimeout(() => {
      this.ready = true;
      this.dispatchEvent(new CustomEvent('slow-ready', { bubbles: true, composed: true }));
    }, 1800);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }
  override render() {
    return html`<xy-handle type="target" position="left"></xy-handle>
      <div class="sb-node sb-skeleton">${this.ready ? this.data.label : 'measuring...'}</div>
      <xy-handle type="source" position="right"></xy-handle>`;
  }
}
const slowTypes = { slow: defineStoryElement('sb-slow-node', SlowNode) };

class LoadingStory extends StoryElement {
  static override properties = { loading: { state: true }, run: { state: true } };
  declare loading: boolean;
  declare run: number;
  constructor() {
    super();
    this.loading = true;
    this.run = 0;
  }
  override render() {
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 40 }, data: { label: 'Fast node' }, ...lr },
      { id: 'b', type: 'slow', position: { x: 260, y: 0 }, data: { label: 'Slow node, ready' } },
      { id: 'c', type: 'slow', position: { x: 260, y: 100 }, data: { label: 'Another one' } },
    ];
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => {
            this.loading = true;
            this.run++;
          }}
        >
          Replay
        </button>
        <span class="sb-pill ${this.loading ? 'warn' : 'ok'}"
          >${this.loading ? 'loading' : 'ready'}</span
        >
        <span class="sb-muted"
          >The overlay stays up until the slow nodes are ready, then fades.</span
        >
      </div>
      ${keyed(
        this.run,
        html`<xy-flow
          fit-view
          .loading=${this.loading}
          .nodeTypes=${slowTypes}
          .nodes=${once(nodes)}
          .edges=${once((): Edge[] => [
            { id: 'ab', source: 'a', target: 'b' },
            { id: 'ac', source: 'a', target: 'c' },
          ])}
          ${on({ 'slow-ready': () => (this.loading = false) })}
        >
          ${chrome({ minimap: false })}
          <div slot="loading" class="sb-card" role="status">Preparing the diagram&hellip;</div>
        </xy-flow>`,
      )}
    `;
  }
}
defineStoryElement('sb-loading', LoadingStory);

export const LoadingOverlay: Story = {
  render: () => html`<sb-loading></sb-loading>`,
  parameters: describe(
    'Until the first `render-complete` the flow shows a loading overlay (`part="loading"`), so a diagram never flashes half-laid-out. Set `loading` to hold it longer (here: until two slow-measuring nodes are ready), put your own content in `slot="loading"`, or switch it off with `no-loading-overlay`.',
  ),
};

// ---- Motion -----------------------------------------------------------------------------------------

class MotionStory extends StoryElement {
  static override properties = { args: { attribute: false }, run: { state: true } };
  declare args: Args;
  declare run: number;
  constructor() {
    super();
    this.run = 0;
  }
  override render() {
    const nodes = (): Node[] => chain(12);
    return html`
      <div class="sb-bar">
        <button class="sb-btn" @click=${() => this.run++}>Replay entrance</button>
        <span class="sb-muted"
          >motion="${this.args.motion ?? 'enter'}": nodes and edges appear in sequence.</span
        >
      </div>
      ${keyed(
        this.run,
        html`<xy-flow
          ${props({ ...flowPropsOf(this.args), motion: this.args.motion ?? 'enter' })}
          style="--xy-enter-duration: ${this.args.enterDuration ?? 400}ms; --xy-enter-stagger: ${this.args.enterStagger ?? 60}ms"
          fit-view
          .nodes=${once(nodes)}
          .edges=${once(() => chainEdges(12))}
        >
          ${chrome({ minimap: false })}
        </xy-flow>`,
      )}
    `;
  }
}
defineStoryElement('sb-motion', MotionStory);

export const Motion: Story = {
  args: { motion: 'enter', enterDuration: 400, enterStagger: 60 },
  argTypes: {
    enterDuration: {
      control: { type: 'range', min: 100, max: 1500, step: 50 },
      description: '`--xy-enter-duration` in ms.',
    },
    enterStagger: {
      control: { type: 'range', min: 0, max: 200, step: 10 },
      description: '`--xy-enter-stagger` in ms.',
    },
  },
  parameters: {
    ...describe(
      '`motion="enter"` fades and scales nodes in when they are first measured and draws edges in, staggered by order. Duration, stagger and easing are CSS custom properties (`--xy-enter-duration`, `--xy-enter-stagger`, `--xy-enter-easing`). It respects `prefers-reduced-motion` and skips flows above `motion-max-nodes`. `enter remote` also animates nodes added by collaborators.',
    ),
    controls: { include: ['motion', 'enterDuration', 'enterStagger'] },
  },
  render: (args) => html`<sb-motion .args=${args}></sb-motion>`,
};
