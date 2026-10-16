import { css, html } from 'lit';
import { action } from 'storybook/actions';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { Position, defineNodeType } from '@xy-lit/flow';
import type { Connection, Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  brief,
  chrome,
  defineStoryElement,
  describe,
  flowArgTypes,
  flowControls,
  flowPropsOf,
  on,
  once,
  props,
  starterEdges,
  starterNodes,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

interface Args extends FlowArgs {
  selectionMode?: 'full' | 'partial';
  panOnScrollMode?: 'free' | 'horizontal' | 'vertical';
  gridSize?: number;
}

const meta: Meta<Args> = {
  title: 'Flow/Interaction',
  component: 'xy-flow',
  argTypes: {
    ...flowArgTypes,
    selectionMode: {
      control: 'inline-radio',
      options: ['full', 'partial'],
      description:
        '`full` selects nodes that are completely inside the box, `partial` any overlap.',
      table: { category: 'Interaction' },
    },
    panOnScrollMode: {
      control: 'inline-radio',
      options: ['free', 'horizontal', 'vertical'],
      table: { category: 'Interaction' },
    },
    gridSize: {
      control: { type: 'number', min: 5, max: 80, step: 5 },
      table: { category: 'Interaction' },
    },
  },
  parameters: {
    controls: { include: [...flowControls, 'selectionMode', 'panOnScrollMode', 'gridSize'] },
  },
};
export default meta;
type Story = StoryObj<Args>;

/** A grid of small nodes, handy where there is plenty to select, scroll past or snap. */
const gridNodes =
  (cols: number, rows: number, gap = 170): (() => Node[]) =>
  () =>
    Array.from({ length: cols * rows }, (_, i) => ({
      id: `g${i}`,
      position: { x: (i % cols) * gap, y: Math.floor(i / cols) * 90 },
      data: { label: `Node ${i + 1}` },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
const gridEdges =
  (cols: number, rows: number): (() => Edge[]) =>
  () => {
    const edges: Edge[] = [];
    for (let i = 0; i < cols * rows; i++) {
      if ((i % cols) + 1 < cols) edges.push({ id: `h${i}`, source: `g${i}`, target: `g${i + 1}` });
    }
    return edges;
  };

const fitPadding = { padding: 0.25 };
const viewport = { x: 20, y: 20, zoom: 1 };
const hint = (text: unknown) =>
  html`<xy-panel position="top-left"><div class="sb-card">${text}</div></xy-panel>`;

export const SelectionOnDrag: Story = {
  args: { selectionOnDrag: true, selectionMode: 'full' },
  render: (args) => html`
    <xy-flow
      ${props({ ...flowPropsOf(args), selectionMode: args.selectionMode })}
      pan-on-drag="1,2"
      fit-view
      .fitViewOptions=${fitPadding}
      .nodes=${once(gridNodes(5, 4))}
      .edges=${once(gridEdges(5, 4))}
    >
      ${chrome()}
      ${hint(
        html`Drag the pane to draw a selection box.<br />Pan with the <b>middle</b> or
          <b>right</b> mouse button, or hold <span class="sb-kbd">Space</span>.`,
      )}
    </xy-flow>
  `,
  parameters: describe(
    '`selection-on-drag` turns a plain pane drag into a selection rectangle (React Flow\'s "Figma-style" selection); `pan-on-drag="1,2"` moves panning to the other mouse buttons. `selection-mode` decides whether a node must be fully inside the box.',
  ),
};

export const PanOnScroll: Story = {
  args: { panOnScroll: true, panOnScrollMode: 'free', zoomOnScroll: false },
  render: (args) => html`
    <xy-flow
      ${props({ ...flowPropsOf(args), panOnScrollMode: args.panOnScrollMode })}
      .nodes=${once(gridNodes(8, 6))}
      .edges=${once(gridEdges(8, 6))}
      .defaultViewport=${viewport}
    >
      ${chrome()}
      ${hint(
        html`Scroll or use two fingers to pan.<br />Hold <span class="sb-kbd">Ctrl</span> /
          <span class="sb-kbd">Cmd</span> and scroll (or pinch) to zoom.`,
      )}
    </xy-flow>
  `,
  parameters: describe(
    '`pan-on-scroll` makes the wheel and trackpad pan the viewport, the behaviour design tools use. Zooming then needs the zoom activation key (Ctrl or Cmd) or a pinch. `pan-on-scroll-mode` limits panning to one axis.',
  ),
};

export const SnapToGrid: Story = {
  args: { snapToGrid: true, gridSize: 20 },
  render: (args) => html`
    <xy-flow
      ${props(flowPropsOf(args))}
      snap-grid=${`${args.gridSize ?? 20} ${args.gridSize ?? 20}`}
      fit-view
      .nodes=${once(starterNodes)}
      .edges=${once(starterEdges)}
    >
      <xy-controls></xy-controls>
      <xy-background variant="lines" gap=${args.gridSize ?? 20}></xy-background>
      ${hint(html`Dragged nodes snap to a ${args.gridSize}px grid.`)}
    </xy-flow>
  `,
  parameters: describe(
    '`snap-to-grid` with `snap-grid="x y"` rounds node positions while dragging. The background plugin draws the same grid so the snapping is visible: change `gridSize` in the controls.',
  ),
};

export const KeyboardOnly: Story = {
  render: (args) => html`
    <xy-flow
      ${props(flowPropsOf(args))}
      fit-view
      .nodes=${once(starterNodes)}
      .edges=${once(starterEdges)}
    >
      ${chrome()}
      <xy-panel position="top-left">
        <div class="sb-card" style="max-width: 280px">
          <h4>Keyboard only</h4>
          <ol style="margin: 0; padding-left: 18px; line-height: 1.8">
            <li>
              <span class="sb-kbd">Tab</span> focus the next node,
              <span class="sb-kbd">Shift</span>+<span class="sb-kbd">Tab</span> the previous
            </li>
            <li>
              <span class="sb-kbd">Enter</span> or <span class="sb-kbd">Space</span> select the
              focused node
            </li>
            <li>
              With the node selected, <span class="sb-kbd">&larr;</span
              ><span class="sb-kbd">&uarr;</span><span class="sb-kbd">&darr;</span
              ><span class="sb-kbd">&rarr;</span> move it (hold
              <span class="sb-kbd">Shift</span> for bigger steps)
            </li>
            <li>
              <span class="sb-kbd">Esc</span> clears the selection,
              <span class="sb-kbd">Backspace</span> deletes it
            </li>
          </ol>
          <p class="sb-muted" style="margin: 6px 0 0">
            Moves are announced in an aria-live region.
          </p>
        </div>
      </xy-panel>
    </xy-flow>
  `,
  parameters: describe(
    'Everything works without a pointer. Nodes and edges are focusable, selection and movement have keys, and every move is announced to screen readers. Click the canvas, then press Tab.',
  ),
};

// ---- ClickConnect -----------------------------------------------------------------------------------

class ClickConnectStory extends StoryElement {
  static override properties = { args: { attribute: false }, status: { state: true } };
  declare args: Args;
  declare status: string;
  constructor() {
    super();
    this.status = 'Click a handle to start a connection.';
  }
  readonly #log = {
    start: action('click-connect-start'),
    end: action('click-connect-end'),
    connect: action('connect'),
  };
  override render() {
    return html`
      <xy-flow
        ${props(flowPropsOf(this.args))}
        fit-view
        .nodes=${once(starterNodes)}
        .edges=${once((): Edge[] => [])}
        ${on({
          'click-connect-start': (e) => {
            const d = (e as CustomEvent<{ nodeId: string | null }>).detail;
            this.status = `Connecting from ${d.nodeId}: now click a target handle (Esc cancels).`;
            this.#log.start(brief(d));
          },
          'click-connect-end': (e) => {
            const d = (e as CustomEvent<{ connectionState: { isValid: boolean | null } }>).detail;
            if (!d.connectionState.isValid) this.status = 'Connection cancelled.';
            this.#log.end(brief(d.connectionState));
          },
          connect: (e) => {
            const c = (e as CustomEvent<{ connection: Connection }>).detail.connection;
            this.status = `Connected ${c.source} to ${c.target}.`;
            this.#log.connect(brief(c));
          },
        })}
      >
        ${chrome({ minimap: false })}
        <xy-panel position="top-left"><div class="sb-card">${this.status}</div></xy-panel>
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-click-connect', ClickConnectStory);

export const ClickConnect: Story = {
  args: { connectOnClick: true },
  render: (args) => html`<sb-click-connect .args=${args}></sb-click-connect>`,
  parameters: describe(
    'With `connect-on-click` (on by default) a connection can also be made with two clicks: click a source handle, then a target handle. It is the touch- and keyboard-friendly alternative to dragging. `click-connect-start`, `click-connect-end` and `connect` are logged in the Actions panel.',
  ),
};

// ---- Validation -------------------------------------------------------------------------------------

type Tone = { tone: 'red' | 'green' | 'blue'; label: string };
const colors = { red: '#fca5a5', green: '#86efac', blue: '#93c5fd' };
const validationStyles = css`
  .sb-tone-node {
    padding: 10px 14px;
    border: 1px solid #1a192b;
    border-radius: 8px;
    font-size: 12px;
    color: #1a192b;
  }
  .sb-tone-node .lit-flow__handle.connectingto {
    background: #ef4444;
  }
  .sb-tone-node .lit-flow__handle.connectingto.valid {
    background: #22c55e;
  }
`;
const toneNode = (kind: 'source' | 'target') =>
  defineNodeType<Node<Tone>>({
    styles: validationStyles,
    render: ({ data }) =>
      html`<div class="sb-tone-node" style="background: ${colors[data.tone]}">
        ${kind === 'target' ? html`<xy-handle type="target" position="left"></xy-handle>` : ''}
        ${data.label}
        ${kind === 'source' ? html`<xy-handle type="source" position="right"></xy-handle>` : ''}
      </div>`,
  });
const toneTypes = { toneSource: toneNode('source'), toneTarget: toneNode('target') };

class ValidationStory extends StoryElement {
  static override properties = { args: { attribute: false }, last: { state: true } };
  declare args: Args;
  declare last: string;
  constructor() {
    super();
    this.last = 'Drag from a source to a target of the same colour.';
  }
  readonly #log = action('connect');
  #isValid = (c: Connection | Edge): boolean => {
    const flow = this.querySelector('xy-flow') as XyFlowElement;
    const from = flow.getNode(c.source)?.data as Tone | undefined;
    const to = flow.getNode(c.target)?.data as Tone | undefined;
    return !!from && !!to && from.tone === to.tone;
  };
  override render() {
    const tones = ['red', 'green', 'blue'] as const;
    const nodes = (): Node[] => [
      ...tones.map((tone, i) => ({
        id: `src-${tone}`,
        type: 'toneSource',
        position: { x: 0, y: i * 100 },
        data: { tone, label: `${tone} source` },
      })),
      ...tones.map((tone, i) => ({
        id: `dst-${tone}`,
        type: 'toneTarget',
        position: { x: 340, y: ((i + 1) % 3) * 100 },
        data: { tone, label: `${tone} target` },
      })),
    ];
    return html`
      <xy-flow
        ${props(flowPropsOf(this.args))}
        fit-view
        .nodes=${once(nodes)}
        .edges=${once((): Edge[] => [])}
        .nodeTypes=${toneTypes}
        .isValidConnection=${this.#isValid}
        ${on({
          connect: (e) => {
            const c = (e as CustomEvent<{ connection: Connection }>).detail.connection;
            this.last = `Connected ${c.source} to ${c.target}.`;
            this.#log(brief(c));
          },
          'connect-end': (e) => {
            const s = (
              e as CustomEvent<{ connectionState: { isValid: boolean | null; toNode: unknown } }>
            ).detail.connectionState;
            if (s.toNode && !s.isValid) this.last = 'Rejected: the colours differ.';
          },
        })}
      >
        ${chrome({ minimap: false })}
        <xy-panel position="top-left"><div class="sb-card">${this.last}</div></xy-panel>
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-validation', ValidationStory);

export const Validation: Story = {
  render: (args) => html`<sb-validation .args=${args}></sb-validation>`,
  parameters: describe(
    '`isValidConnection` decides whether a connection may be made. While you drag, the handle under the pointer turns green (valid) or red (invalid) through the `connectingto` and `valid` classes, so only matching colours light up.',
  ),
};
