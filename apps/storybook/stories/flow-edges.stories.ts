import { css, html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import {
  MarkerType,
  Position,
  baseEdge,
  defineEdgeType,
  edgeLabel,
  edgeToolbar,
  getBezierPath,
} from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  chrome,
  defineStoryElement,
  describe,
  flowArgTypes,
  flowControls,
  flowPropsOf,
  logEvents,
  on,
  once,
  props,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

const meta: Meta<FlowArgs> = {
  title: 'Flow/Edges',
  component: 'xy-flow',
  argTypes: flowArgTypes,
  parameters: { controls: { include: flowControls } },
  args: { fitViewOnInit: true },
};
export default meta;
type Story = StoryObj<FlowArgs>;

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const pair = (id: string, y: number, a: string, b: string, dx = 300, dy = 0): Node[] => [
  { id: `${id}-a`, position: { x: 0, y }, data: { label: a }, ...lr },
  { id: `${id}-b`, position: { x: dx, y: y + dy }, data: { label: b }, ...lr },
];

// ---- AllTypes ---------------------------------------------------------------------------------------

export const AllTypes: Story = {
  render: (args) => {
    const types = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;
    const name = (t: string) => (t === 'default' ? 'bezier (default)' : t);
    const nodes = (): Node[] =>
      types.flatMap((t, i) => pair(t, i * 110, name(t), 'target', 320, 50));
    const edges = (): Edge[] =>
      types.map((t) => ({
        id: t,
        type: t,
        source: `${t}-a`,
        target: `${t}-b`,
        label: name(t),
        markerEnd: { type: MarkerType.ArrowClosed },
      }));
    return html`<xy-flow ${props(flowPropsOf(args))} .nodes=${once(nodes)} .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    'The built-in edge types: `default` (bezier), `straight`, `step`, `smoothstep` and `simplebezier`. Pick one per edge with `type`, or for every new edge with `defaultEdgeOptions`.',
  ),
};

// ---- Markers ----------------------------------------------------------------------------------------

export const Markers: Story = {
  render: (args) => {
    const diamond = {
      type: 'custom' as const,
      path: 'M-5,0 L0,-5 L5,0 L0,5 Z',
      color: '#e11d48',
      fill: '#fecdd3',
      strokeWidth: 1.5,
    };
    const circle = {
      type: 'custom' as const,
      path: 'M-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0',
      color: '#0d9488',
      fill: '#ccfbf1',
      strokeWidth: 1.5,
    };
    const rows: [string, Partial<Edge>][] = [
      ['Arrow', { markerEnd: { type: MarkerType.Arrow } }],
      ['ArrowClosed', { markerEnd: { type: MarkerType.ArrowClosed } }],
      [
        'Both ends, coloured',
        {
          markerStart: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          style: 'stroke: #6366f1;',
        },
      ],
      [
        'Larger, thicker',
        {
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 24,
            height: 24,
            strokeWidth: 2,
            color: '#f59e0b',
          },
          style: 'stroke: #f59e0b; stroke-width: 2;',
        },
      ],
      ['Custom: diamond', { markerEnd: diamond }],
      [
        'Custom: circle to arrow',
        { markerStart: circle, markerEnd: { type: MarkerType.ArrowClosed } },
      ],
    ];
    const nodes = (): Node[] =>
      rows.flatMap(([label], i) => pair(`m${i}`, i * 90, label, 'target', 340));
    const edges = (): Edge[] =>
      rows.map(
        ([, extra], i) =>
          ({
            id: `m${i}`,
            source: `m${i}-a`,
            target: `m${i}-b`,
            type: 'straight',
            ...extra,
          }) as Edge,
      );
    return html`<xy-flow ${props(flowPropsOf(args))} .nodes=${once(nodes)} .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    '`markerStart` and `markerEnd` take a built-in type (`Arrow`, `ArrowClosed`) with colour, size and stroke width, or `{ type: "custom", path }` with any SVG path drawn in a 20 x 20 box centred on the edge end. Marker definitions live in the flow\'s own tree, so two flows on a page never clash.',
  ),
};

// ---- Labels -----------------------------------------------------------------------------------------

export const Labels: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      ...pair('l1', 0, 'Source', 'Target', 480, 40),
      ...pair('l2', 140, 'Source', 'Target', 480, 40),
      ...pair('l3', 280, 'Source', 'Target', 480, 0),
    ];
    const edges = (): Edge[] => [
      { id: 'l1', source: 'l1-a', target: 'l1-b', label: 'center label' },
      {
        id: 'l2',
        source: 'l2-a',
        target: 'l2-b',
        type: 'smoothstep',
        startLabel: 'start',
        label: 'center',
        endLabel: 'end',
      },
      {
        id: 'l3',
        source: 'l3-a',
        target: 'l3-b',
        type: 'step',
        startLabel: 'start only',
        endLabel: 'end only',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];
    return html`<xy-flow ${props(flowPropsOf(args))} .nodes=${once(nodes)} .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    'An edge has a centre `label` and optional `startLabel` / `endLabel`, positioned at the middle and near the two ends of the path. Labels are text; for interactive content use a custom edge with `edgeLabel()` (see ButtonEdge).',
  ),
};

// ---- ParallelSpread ---------------------------------------------------------------------------------

export const ParallelSpread: Story = {
  args: { parallelEdges: 'spread' },
  render: (args) => {
    const arrow = { type: MarkerType.ArrowClosed };
    const nodes = (): Node[] => [
      ...pair('p1', 0, 'A', 'B', 320),
      ...pair('p2', 130, 'C', 'D', 320),
      ...pair('p3', 260, 'E', 'F', 320, 60),
    ];
    const edges = (): Edge[] => [
      { id: 'p1-1', source: 'p1-a', target: 'p1-b', label: 'one', markerEnd: arrow },
      { id: 'p1-2', source: 'p1-a', target: 'p1-b', label: 'two', markerEnd: arrow },
      { id: 'p1-3', source: 'p1-b', target: 'p1-a', label: 'back', markerEnd: arrow },
      { id: 'p2-1', source: 'p2-a', target: 'p2-b', type: 'straight', markerEnd: arrow },
      { id: 'p2-2', source: 'p2-a', target: 'p2-b', type: 'straight', markerEnd: arrow },
      { id: 'p2-3', source: 'p2-a', target: 'p2-b', type: 'straight', markerEnd: arrow },
      { id: 'p3-1', source: 'p3-a', target: 'p3-b', type: 'smoothstep' },
      { id: 'p3-2', source: 'p3-a', target: 'p3-b', type: 'step' },
    ];
    return html`<xy-flow ${props(flowPropsOf(args))} .nodes=${once(nodes)} .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    'Several edges between the same two handles normally draw on top of each other. `parallel-edges="spread"` fans them out (bezier, straight, step and smoothstep); `parallel-edge-gap` sets the distance, and `edge.offset` overrides one edge. Switch the control to `off` to compare.',
  ),
};

// ---- Animated ---------------------------------------------------------------------------------------

class AnimatedStory extends StoryElement {
  static override properties = { args: { attribute: false }, animated: { state: true } };
  declare args: FlowArgs;
  declare animated: boolean;
  constructor() {
    super();
    this.animated = true;
  }
  get #flow() {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  #toggle(): void {
    this.animated = !this.animated;
    for (const e of this.#flow.getEdges()) this.#flow.updateEdge(e.id, { animated: this.animated });
  }
  override render() {
    const nodes = (): Node[] =>
      pair('n', 0, 'Producer', 'Consumer', 360).concat({
        id: 'n-c',
        position: { x: 180, y: 140 },
        data: { label: 'Queue' },
        ...lr,
      });
    const edges = (): Edge[] => [
      { id: 'a', source: 'n-a', target: 'n-c', animated: true, type: 'smoothstep' },
      {
        id: 'b',
        source: 'n-c',
        target: 'n-b',
        animated: true,
        type: 'smoothstep',
        style: 'stroke: #6366f1; stroke-width: 2;',
      },
      { id: 'c', source: 'n-a', target: 'n-b', animated: true, label: 'direct' },
    ];
    return html`
      <div class="sb-bar">
        <button class="sb-btn" aria-pressed=${this.animated} @click=${() => this.#toggle()}>
          animated
        </button>
        <span class="sb-muted"
          >Dashes flow along the edge; they stop under <code>prefers-reduced-motion</code>.</span
        >
      </div>
      <xy-flow ${props(flowPropsOf(this.args))} .nodes=${once(nodes)} .edges=${once(edges)}
        >${chrome({ minimap: false })}</xy-flow
      >
    `;
  }
}
defineStoryElement('sb-animated', AnimatedStory);

export const Animated: Story = {
  render: (args) => html`<sb-animated .args=${args}></sb-animated>`,
  parameters: describe(
    '`animated: true` draws a moving dash pattern, the usual way to show that data is flowing. It is pure CSS and can be toggled per edge at any time with `updateEdge()`.',
  ),
};

// ---- Reconnect --------------------------------------------------------------------------------------

export const Reconnect: Story = {
  args: { edgesReconnectable: true },
  render: (args) => {
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 20 }, data: { label: 'A' }, ...lr },
      { id: 'b', position: { x: 0, y: 160 }, data: { label: 'B' }, ...lr },
      { id: 'c', position: { x: 360, y: 0 }, data: { label: 'C' }, ...lr },
      { id: 'd', position: { x: 360, y: 90 }, data: { label: 'D' }, ...lr },
      { id: 'e', position: { x: 360, y: 180 }, data: { label: 'E' }, ...lr },
    ];
    const edges = (): Edge[] => [
      { id: 'a-c', source: 'a', target: 'c', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'b-e', source: 'b', target: 'e', markerEnd: { type: MarkerType.ArrowClosed } },
    ];
    return html`
      <xy-flow
        ${props(flowPropsOf(args))}
        ${on(logEvents('reconnect-start', 'reconnect', 'reconnect-end'))}
        .nodes=${once(nodes)}
        .edges=${once(edges)}
      >
        ${chrome({ minimap: false })}
        <xy-panel position="top-left"
          ><div class="sb-card">Drag either end of an edge onto another handle.</div></xy-panel
        >
      </xy-flow>
    `;
  },
  parameters: describe(
    'With `edges-reconnectable` an edge shows an anchor at each end; drag one onto another handle to reconnect it. `reconnect-start`, `reconnect` and `reconnect-end` are logged in the Actions panel. `onBeforeReconnect` can veto or rewrite the result.',
  ),
};

// ---- EdgeToolbar ------------------------------------------------------------------------------------

const toolbarEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({
        id: p.id,
        path,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      }),
      label: edgeToolbar(
        flow,
        { edgeId: p.id, x, y, selected: p.selected, alignY: 'bottom' },
        html`<div class="sb-card" style="display:flex;gap:6px;padding:4px">
          <button
            class="sb-btn nodrag nopan"
            @click=${() => void flow.deleteElements({ edges: [{ id: p.id }] })}
          >
            Delete
          </button>
          <button
            class="sb-btn nodrag nopan"
            @click=${() => flow.updateEdge(p.id, { animated: !p.animated })}
          >
            ${p.animated ? 'Stop' : 'Animate'}
          </button>
        </div>`,
      ),
    };
  },
});

const toolbarTypes = { toolbar: toolbarEdge };

export const EdgeToolbar: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      ...pair('t', 0, 'Select the edge', 'to see its toolbar', 380, 70),
      ...pair('u', 210, 'Zoom in and out', 'it keeps its size', 380, -30),
    ];
    const edges = (): Edge[] => [
      {
        id: 't',
        selected: true,
        type: 'toolbar',
        source: 't-a',
        target: 't-b',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'u',
        type: 'toolbar',
        source: 'u-a',
        target: 'u-b',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .edgeTypes=${toolbarTypes}
      .nodes=${once(nodes)}
      .edges=${once(edges)}
    >
      ${chrome({ minimap: false })}
    </xy-flow>`;
  },
  parameters: describe(
    '`edgeToolbar()` returned as the `label` of a custom edge shows HTML controls beside the selected edge. The toolbar counter-scales with the zoom so buttons stay readable at any zoom level.',
  ),
};

// ---- ButtonEdge -------------------------------------------------------------------------------------

const buttonEdge = defineEdgeType({
  styles: css`
    .sb-edge-button {
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid #b1b1b7;
      background: #fff;
      color: #1a192b;
      cursor: pointer;
      line-height: 1;
      font-size: 14px;
    }
    .sb-edge-button:hover {
      background: #fee2e2;
      border-color: #ef4444;
    }
    .sb-edge-button:focus-visible {
      outline: 2px solid #6366f1;
    }
  `,
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({
        id: p.id,
        path,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      }),
      label: edgeLabel(
        flow,
        { edgeId: p.id, x, y, style: 'background: transparent; padding: 0;' },
        // `nodrag nopan` keep clicks on the button from dragging a node or panning the pane
        html`<button
          class="nodrag nopan sb-edge-button"
          aria-label="Delete edge ${p.id}"
          @click=${(e: Event) => {
            e.stopPropagation();
            void flow.deleteElements({ edges: [{ id: p.id }] });
          }}
        >
          &times;
        </button>`,
      ),
    };
  },
});

const buttonTypes = { button: buttonEdge };

export const ButtonEdge: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      { id: '1', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Source' }, ...lr },
      { id: '2', position: { x: 300, y: 0 }, data: { label: 'Target A' }, ...lr },
      { id: '3', position: { x: 300, y: 200 }, data: { label: 'Target B' }, ...lr },
      { id: '4', type: 'output', position: { x: 600, y: 100 }, data: { label: 'Sink' }, ...lr },
    ];
    const edges = (): Edge[] => [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e1-3', source: '1', target: '3' },
      { id: 'e2-4', source: '2', target: '4' },
      { id: 'e3-4', source: '3', target: '4' },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .edgeTypes=${buttonTypes}
      .defaultEdgeOptions=${once(() => ({ type: 'button' }))}
      .nodes=${once(nodes)}
      .edges=${once(edges)}
    >
      ${chrome({ minimap: false })}
      <xy-panel position="top-left"
        ><div class="sb-card">
          Click &times; to delete an edge. New edges get buttons too.
        </div></xy-panel
      >
    </xy-flow>`;
  },
  parameters: describe(
    'A custom edge type built with `defineEdgeType`: `baseEdge()` draws the path, `edgeLabel()` places regular HTML (here a delete button) at the centre. `defaultEdgeOptions` makes every edge you draw use it.',
  ),
};
