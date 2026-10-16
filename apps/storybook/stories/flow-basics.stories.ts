import { html } from 'lit';
import { action } from 'storybook/actions';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { applyEdgeChanges, applyNodeChanges, defineNodeType } from '@xy-lit/flow';
import type { Edge, EdgeChange, Node, NodeChange, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  brief,
  chrome,
  defineStoryElement,
  describe,
  flowArgTypes,
  flowControls,
  flowPropsOf,
  once,
  props,
  starterEdges,
  starterNodes,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

const meta: Meta<FlowArgs> = {
  title: 'Flow/Basics',
  component: 'xy-flow',
  argTypes: flowArgTypes,
  parameters: { controls: { include: flowControls } },
  args: { fitViewOnInit: true },
  render: (args) => html`
    <xy-flow ${props(flowPropsOf(args))} .nodes=${once(starterNodes)} .edges=${once(starterEdges)}>
      ${chrome()}
    </xy-flow>
  `,
};
export default meta;
type Story = StoryObj<FlowArgs>;

export const Default: Story = {
  parameters: describe(
    'The smallest useful flow: nodes and edges handed over once, the three plugins as children. Drag nodes, drag from a handle to connect, scroll to zoom, and try the controls panel.',
  ),
};

// ---- FitView ----------------------------------------------------------------------------------------

class FitViewStory extends StoryElement {
  static override properties = { args: { attribute: false }, padding: { state: true } };
  declare args: FlowArgs;
  declare padding: number;
  constructor() {
    super();
    this.padding = 0.2;
  }
  get #flow() {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  override render() {
    const spread = (): Node[] =>
      [
        [0, 0],
        [900, 40],
        [300, 520],
        [1200, 480],
        [-500, 300],
      ].map(([x, y], i) => ({
        id: `n${i}`,
        position: { x: x as number, y: y as number },
        data: { label: `Node ${i + 1}` },
      }));
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => this.#flow.fitView({ padding: this.padding, duration: 400 })}
        >
          Fit all (animated)
        </button>
        <button
          class="sb-btn"
          @click=${() => this.#flow.fitView({ nodes: [{ id: 'n0' }, { id: 'n1' }], padding: this.padding, duration: 400 })}
        >
          Fit nodes 1 and 2
        </button>
        <button
          class="sb-btn"
          @click=${() => this.#flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 })}
        >
          Reset to 100%
        </button>
        <label class="sb-field">
          padding ${this.padding.toFixed(2)}
          <input
            type="range"
            min="0"
            max="0.6"
            step="0.05"
            .value=${String(this.padding)}
            @input=${(e: Event) => (this.padding = Number((e.target as HTMLInputElement).value))}
          />
        </label>
      </div>
      <xy-flow
        ${props(flowPropsOf(this.args))}
        .nodes=${once(spread)}
        .fitViewOptions=${{ padding: 0.2 }}
        min-zoom="0.1"
      >
        ${chrome()}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-fit-view', FitViewStory);

export const FitView: Story = {
  render: (args) => html`<sb-fit-view .args=${args}></sb-fit-view>`,
  parameters: describe(
    'With `fit-view` the viewport frames every node once they are measured. `fitView()` can also frame a subset of nodes, animate, and take a padding; the buttons call it on the flow element.',
  ),
};

// ---- Controlled -------------------------------------------------------------------------------------

class ControlledStory extends StoryElement {
  static override properties = {
    args: { attribute: false },
    nodes: { state: true },
    edges: { state: true },
    count: { state: true },
  };
  declare args: FlowArgs;
  declare nodes: Node[];
  declare edges: Edge[];
  declare count: number;
  constructor() {
    super();
    this.nodes = starterNodes();
    this.edges = starterEdges();
    this.count = 0;
  }
  readonly #logNodes = action('nodes-change');
  readonly #logEdges = action('edges-change');
  #onNodes = (e: Event): void => {
    // cancel the default so the story owns the state, then apply the changes itself
    e.preventDefault();
    const { changes } = (e as CustomEvent<{ changes: NodeChange[] }>).detail;
    if (changes.some((c) => c.type !== 'dimensions')) this.#logNodes(brief(changes));
    this.nodes = applyNodeChanges(changes, this.nodes);
    this.count++;
  };
  #onEdges = (e: Event): void => {
    e.preventDefault();
    const { changes } = (e as CustomEvent<{ changes: EdgeChange[] }>).detail;
    this.#logEdges(brief(changes));
    this.edges = applyEdgeChanges(changes, this.edges);
    this.count++;
  };
  override render() {
    return html`
      <div class="sb-bar">
        <span class="sb-pill plain">controlled</span>
        <span class="sb-muted"
          >${this.nodes.length} nodes, ${this.edges.length} edges, ${this.count} changes applied.
          Open the Actions panel to see every change; Backspace deletes the selection.</span
        >
        <span class="sb-grow"></span>
        <button
          class="sb-btn"
          @click=${() => {
            this.nodes = starterNodes();
            this.edges = starterEdges();
          }}
        >
          Reset state
        </button>
      </div>
      <xy-flow
        ${props(flowPropsOf(this.args))}
        .nodes=${this.nodes}
        .edges=${this.edges}
        @nodes-change=${this.#onNodes}
        @edges-change=${this.#onEdges}
      >
        ${chrome()}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-controlled', ControlledStory);

export const Controlled: Story = {
  render: (args) => html`<sb-controlled .args=${args}></sb-controlled>`,
  parameters: describe(
    'The app owns `nodes` and `edges`. `nodes-change` and `edges-change` are cancelable: call `preventDefault()`, apply the changes with `applyNodeChanges` / `applyEdgeChanges`, and assign the new arrays. Every change is logged in the Actions panel.',
  ),
};

// ---- Uncontrolled -----------------------------------------------------------------------------------

class UncontrolledStory extends StoryElement {
  static override properties = { args: { attribute: false }, snapshot: { state: true } };
  declare args: FlowArgs;
  declare snapshot: string;
  #n = 0;
  constructor() {
    super();
    this.snapshot = 'Press "Read state" after moving things around.';
  }
  get #flow() {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  override render() {
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => {
            const n = ++this.#n;
            this.#flow.addNodes({
              id: `added-${n}`,
              position: { x: 40 * n, y: 260 + 10 * n },
              data: { label: `Added ${n}` },
            });
          }}
        >
          Add node
        </button>
        <button
          class="sb-btn"
          @click=${() => {
            const nodes = this.#flow.getNodes().map((n) => ({
              id: n.id,
              x: Math.round(n.position.x),
              y: Math.round(n.position.y),
            }));
            this.snapshot = `${nodes.length} nodes, ${this.#flow.getEdges().length} edges: ${JSON.stringify(nodes)}`;
          }}
        >
          Read state
        </button>
        <span class="sb-muted sb-mono">${this.snapshot}</span>
      </div>
      <xy-flow
        ${props(flowPropsOf(this.args))}
        .nodes=${once(starterNodes)}
        .edges=${once(starterEdges)}
      >
        ${chrome()}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-uncontrolled', UncontrolledStory);

export const Uncontrolled: Story = {
  render: (args) => html`<sb-uncontrolled .args=${args}></sb-uncontrolled>`,
  parameters: describe(
    'The flow owns its state after the initial `nodes` and `edges`. Read it back with `getNodes()` / `getEdges()`, change it with `addNodes()`, `updateNode()` and friends.',
  ),
};

// ---- ReadOnly ---------------------------------------------------------------------------------------

export const ReadOnly: Story = {
  args: { nodesDraggable: false, nodesConnectable: false, elementsSelectable: false },
  render: (args) => html`
    <xy-flow ${props(flowPropsOf(args))} .nodes=${once(starterNodes)} .edges=${once(starterEdges)}>
      <xy-panel position="top-left"
        ><div class="sb-card">Read-only: pan and zoom only</div></xy-panel
      >
      ${chrome({ controls: false })}
      <xy-controls show-interactive="false"></xy-controls>
    </xy-flow>
  `,
  parameters: describe(
    'Interaction switched off with `nodes-draggable`, `nodes-connectable` and `elements-selectable` set to false. Panning and zooming still work. The controls plugin hides its lock button here.',
  ),
};

// ---- DarkMode ---------------------------------------------------------------------------------------

class DarkModeStory extends StoryElement {
  static override properties = { mode: { state: true } };
  declare mode: 'light' | 'dark' | 'system';
  constructor() {
    super();
    this.mode = 'dark';
  }
  override render() {
    return html`
      <div class="sb-bar">
        <span class="sb-muted">color-mode</span>
        ${(['light', 'dark', 'system'] as const).map(
          (m) =>
            html`<button
              class="sb-btn"
              aria-pressed=${this.mode === m}
              @click=${() => (this.mode = m)}
            >
              ${m}
            </button>`,
        )}
        <span class="sb-muted">This flow ignores the toolbar's colour mode and uses its own.</span>
      </div>
      <xy-flow
        data-fixed-mode
        color-mode=${this.mode}
        .nodes=${once(starterNodes)}
        .edges=${once(starterEdges)}
        fit-view
      >
        ${chrome()}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-dark-mode', DarkModeStory);

export const DarkMode: Story = {
  render: () => html`<sb-dark-mode></sb-dark-mode>`,
  parameters: describe(
    '`color-mode` is `light`, `dark` or `system` (follows `prefers-color-scheme`). All colours come from CSS custom properties, so the plugins follow the mode too. This story pins the flow so you can compare it with the toolbar setting.',
  ),
};

// ---- LightRenderRoot --------------------------------------------------------------------------------

const lightRootCss = `
.sb-tw-card { display: block; padding: 14px 18px; border-radius: 14px; color: #fff; font-weight: 600;
  background: linear-gradient(135deg, #6366f1, #ec4899); box-shadow: 0 6px 18px rgb(99 102 241 / 0.35); }
.sb-tw-card small { display: block; font-weight: 400; opacity: 0.85; }
`;
let lightRootStyle: HTMLStyleElement | undefined;

class LightRootStory extends StoryElement {
  override connectedCallback(): void {
    super.connectedCallback();
    // a page stylesheet: in light mode it reaches the nodes because they live in the document
    lightRootStyle ??= Object.assign(document.createElement('style'), {
      textContent: lightRootCss,
    });
    document.head.append(lightRootStyle);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    lightRootStyle?.remove();
  }
  override render() {
    const nodes = (): Node[] => [
      {
        id: 'a',
        type: 'card',
        position: { x: 0, y: 60 },
        data: { label: 'Styled by the page', note: 'class="sb-tw-card"' },
      },
      {
        id: 'b',
        type: 'card',
        position: { x: 300, y: 160 },
        data: { label: 'Same stylesheet', note: 'no adoptStyles()' },
      },
    ];
    return html`
      <xy-flow
        render-root="light"
        fit-view
        .nodes=${once(nodes)}
        .edges=${once(() => [{ id: 'ab', source: 'a', target: 'b' }] as Edge[])}
        .nodeTypes=${once(() => lightCardTypes)}
      >
        <xy-background></xy-background>
        <xy-controls></xy-controls>
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-light-root', LightRootStory);

const lightCardTypes = {
  card: defineNodeType<Node<{ label: string; note: string }>>({
    render: ({ data }) =>
      html`<div class="sb-tw-card">
        <xy-handle type="target" position="left"></xy-handle>
        ${data.label}<small>${data.note}</small>
        <xy-handle type="source" position="right"></xy-handle>
      </div>`,
  }),
};

export const LightRenderRoot: Story = {
  render: () => html`<sb-light-root></sb-light-root>`,
  parameters: describe(
    '`render-root="light"` renders the flow into the document instead of a shadow root, so global CSS (Tailwind, a design system) styles nodes directly. Plugins given as children are projected into the flow. Shadow rendering stays the default because it isolates styles.',
  ),
};
