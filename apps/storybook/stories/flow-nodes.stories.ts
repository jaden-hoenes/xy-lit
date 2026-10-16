import { css, html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import {
  FlowNodeElement,
  NodeConnectionsController,
  NodesDataController,
  Position,
  defineNodeType,
  nodeToolbar,
} from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  chrome,
  defineStoryElement,
  describe,
  fitWhenRendered,
  flowArgTypes,
  flowControls,
  flowPropsOf,
  nodeCardCss,
  once,
  props,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

interface Args extends FlowArgs {
  toolbarPosition?: 'top' | 'right' | 'bottom' | 'left';
  toolbarAlign?: 'start' | 'center' | 'end';
  alwaysVisible?: boolean;
  wheelScrollDetection?: 'auto' | 'off';
}

const meta: Meta<Args> = {
  title: 'Flow/Nodes',
  component: 'xy-flow',
  argTypes: {
    ...flowArgTypes,
    toolbarPosition: {
      control: 'inline-radio',
      options: ['top', 'right', 'bottom', 'left'],
      table: { category: 'Toolbar' },
    },
    toolbarAlign: {
      control: 'inline-radio',
      options: ['start', 'center', 'end'],
      table: { category: 'Toolbar' },
    },
    alwaysVisible: { control: 'boolean', table: { category: 'Toolbar' } },
    wheelScrollDetection: {
      control: 'inline-radio',
      options: ['auto', 'off'],
      table: { category: 'Interaction' },
    },
  },
  parameters: { controls: { include: flowControls } },
  args: { fitViewOnInit: true },
};
export default meta;
type Story = StoryObj<Args>;

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const label = (data: unknown) => String((data as { label?: unknown }).label ?? '');
const hint = (text: unknown) =>
  html`<xy-panel position="top-left"><div class="sb-card">${text}</div></xy-panel>`;

// ---- BuiltIns ---------------------------------------------------------------------------------------

export const BuiltIns: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      {
        id: 'input',
        type: 'input',
        position: { x: 0, y: 0 },
        data: { label: 'input: only a source handle' },
        ...lr,
      },
      {
        id: 'default',
        position: { x: 280, y: 80 },
        data: { label: 'default: both handles' },
        ...lr,
      },
      {
        id: 'output',
        type: 'output',
        position: { x: 560, y: 0 },
        data: { label: 'output: only a target handle' },
        ...lr,
      },
      { id: 'vertical', position: { x: 280, y: 200 }, data: { label: 'default, top to bottom' } },
      {
        id: 'styled',
        position: { x: 0, y: 160 },
        data: { label: 'style and class' },
        style: 'background: #fef3c7; border-color: #f59e0b; color: #78350f;',
        class: 'sb-custom',
        ...lr,
      },
      {
        id: 'group',
        type: 'group',
        position: { x: 520, y: 150 },
        width: 220,
        height: 120,
        data: { label: 'group: a container' },
        style: 'background: rgba(99,102,241,0.1); border: 1px dashed #6366f1;',
      },
    ];
    const edges = (): Edge[] => [
      { id: 'a', source: 'input', target: 'default' },
      { id: 'b', source: 'default', target: 'output' },
      { id: 'c', source: 'styled', target: 'default' },
      { id: 'd', source: 'default', target: 'vertical' },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      ${fitWhenRendered()}
      .nodes=${once(nodes)}
      .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    'The node types that ship with the library: `default`, `input`, `output` and `group`. `sourcePosition` / `targetPosition` move the handles, and `style` and `class` restyle a single node.',
  ),
};

// ---- TemplateRenderer -------------------------------------------------------------------------------

type Person = { name: string; role: string; online: boolean };
const personNode = defineNodeType<Node<Person>>({
  styles: [
    nodeCardCss,
    css`
      .sb-person {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 170px;
      }
      .sb-avatar {
        position: relative;
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        color: #fff;
        font-weight: 600;
      }
      .sb-avatar::after {
        content: '';
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--xy-node-background-color, var(--xy-node-background-color-default));
        background: #9ca3af;
      }
      .sb-avatar.online::after {
        background: #22c55e;
      }
      .sb-person small {
        display: block;
        opacity: 0.65;
      }
    `,
  ],
  render: ({ data }) => html`
    <xy-handle type="target" position="left"></xy-handle>
    <div class="sb-node sb-person">
      <div class="sb-avatar ${data.online ? 'online' : ''}" aria-hidden="true">
        ${data.name.charAt(0)}
      </div>
      <div>
        <strong>${data.name}</strong>
        <small>${data.role}</small>
      </div>
    </div>
    <xy-handle type="source" position="right"></xy-handle>
  `,
});
const personTypes = { person: personNode };

export const TemplateRenderer: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      {
        id: 'ada',
        type: 'person',
        position: { x: 0, y: 80 },
        data: { name: 'Ada', role: 'Engineering lead', online: true },
      },
      {
        id: 'grace',
        type: 'person',
        position: { x: 300, y: 0 },
        data: { name: 'Grace', role: 'Compiler team', online: true },
      },
      {
        id: 'alan',
        type: 'person',
        position: { x: 300, y: 160 },
        data: { name: 'Alan', role: 'Research', online: false },
      },
    ];
    const edges = (): Edge[] => [
      { id: 'a-g', source: 'ada', target: 'grace' },
      { id: 'a-a', source: 'ada', target: 'alan' },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .nodeTypes=${personTypes}
      .nodes=${once(nodes)}
      .edges=${once(edges)}
      >${chrome({ minimap: false })}</xy-flow
    >`;
  },
  parameters: describe(
    '`defineNodeType({ render, styles })` registers a node type from a Lit template function. The template receives the node props (`data`, `selected`, ...). Styles go in `styles` because the flow adopts them into its single shadow root: page CSS does not reach nodes.',
  ),
};

// ---- ElementNode ------------------------------------------------------------------------------------

class NumberNode extends FlowNodeElement<Node<{ value: number; label: string }>> {
  static override styles = [
    nodeCardCss,
    css`
      input {
        display: block;
        width: 130px;
        margin-top: 6px;
        accent-color: #6366f1;
      }
    `,
  ];
  override render() {
    return html`<div class="sb-node">
      <strong>${this.data.label}: ${this.data.value}</strong>
      <input
        class="nodrag"
        type="range"
        min="0"
        max="20"
        aria-label=${this.data.label}
        .value=${String(this.data.value)}
        @input=${(e: Event) => this.flow.updateNodeData(this.nodeId, { value: Number((e.target as HTMLInputElement).value) })}
      />
      <xy-handle type="source" position="right"></xy-handle>
    </div>`;
  }
}
class SumNode extends FlowNodeElement<Node<Record<string, never>>> {
  static override styles = [
    nodeCardCss,
    css`
      .sb-sum {
        font-size: 16px;
        font-weight: 700;
        min-width: 70px;
        text-align: center;
      }
    `,
  ];
  // the sources of the edges that end here, and their data: the node re-renders when any changes
  private inputs = new NodeConnectionsController(this, { handleType: 'target' });
  private values = new NodesDataController(this, () => this.inputs.value.map((c) => c.source));
  override render() {
    const list = Array.isArray(this.values.value) ? this.values.value : [];
    const total = list.reduce((sum, n) => sum + ((n.data as { value?: number }).value ?? 0), 0);
    return html`<xy-handle type="target" position="left"></xy-handle>
      <div class="sb-node sb-sum" title="${list.length} inputs">&Sigma; ${total}</div>`;
  }
}
const nodeTypeElements = {
  number: defineStoryElement('sb-number-node', NumberNode),
  sum: defineStoryElement('sb-sum-node', SumNode),
};

export const ElementNode: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      { id: 'a', type: 'number', position: { x: 0, y: 0 }, data: { label: 'A', value: 4 } },
      { id: 'b', type: 'number', position: { x: 0, y: 110 }, data: { label: 'B', value: 7 } },
      { id: 'c', type: 'number', position: { x: 0, y: 220 }, data: { label: 'C', value: 2 } },
      { id: 's1', type: 'sum', position: { x: 260, y: 40 }, data: {} },
      { id: 's2', type: 'sum', position: { x: 260, y: 190 }, data: {} },
    ];
    const edges = (): Edge[] => [
      { id: 'a-s1', source: 'a', target: 's1' },
      { id: 'b-s1', source: 'b', target: 's1' },
      { id: 'b-s2', source: 'b', target: 's2' },
      { id: 'c-s2', source: 'c', target: 's2' },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .nodeTypes=${nodeTypeElements}
      .nodes=${once(nodes)}
      .edges=${once(edges)}
    >
      ${chrome({ minimap: false })} ${hint('Move the sliders: the sums follow their inputs.')}
    </xy-flow>`;
  },
  parameters: describe(
    'A node can be a custom element extending `FlowNodeElement` (give its tag name as the node type). It has `static styles`, reactive state, and the reactive controllers `NodeConnectionsController` and `NodesDataController`: the sum nodes re-render when an input node changes, with no wiring code. `nodrag` keeps the sliders usable.',
  ),
};

// ---- DragHandle -------------------------------------------------------------------------------------

const gripNode = defineNodeType<Node<{ label: string }>>({
  styles: [
    nodeCardCss,
    css`
      .sb-grip-node {
        padding: 0;
        overflow: hidden;
        width: 190px;
      }
      .sb-grip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: #6366f1;
        color: #fff;
        cursor: grab;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .sb-grip-body {
        padding: 10px;
        cursor: text;
      }
    `,
  ],
  render: ({ data }) => html`
    <xy-handle type="target" position="left"></xy-handle>
    <div class="sb-node sb-grip-node">
      <div class="sb-grip">&#10303; ${data.label}</div>
      <div class="sb-grip-body">
        Only the coloured bar drags this node. The body can be clicked and selected.
      </div>
    </div>
    <xy-handle type="source" position="right"></xy-handle>
  `,
});
const gripTypes = { grip: gripNode };

export const DragHandle: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      {
        id: 'a',
        type: 'grip',
        position: { x: 0, y: 20 },
        dragHandle: '.sb-grip',
        data: { label: 'Drag here' },
      },
      {
        id: 'b',
        type: 'grip',
        position: { x: 330, y: 120 },
        dragHandle: '.sb-grip',
        data: { label: 'Or here' },
      },
      { id: 'c', position: { x: 0, y: 190 }, data: { label: 'Regular node' }, ...lr },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .nodeTypes=${gripTypes}
      .nodes=${once(nodes)}
      .edges=${once((): Edge[] => [{ id: 'e', source: 'a', target: 'b' }])}
    >
      ${chrome({ minimap: false })}
    </xy-flow>`;
  },
  parameters: describe(
    '`node.dragHandle` is a CSS selector: the node can only be dragged by the matching element. The rest of the node stays free for text, inputs and buttons (the `nodrag` class does the same for any element).',
  ),
};

// ---- Resizer ----------------------------------------------------------------------------------------

const resizeBody = (text: string) => html`
  <xy-handle type="target" position="left"></xy-handle>
  <div class="sb-node sb-fill">${text}</div>
  <xy-handle type="source" position="right"></xy-handle>
`;
const resizeTypes = {
  handles: defineNodeType({
    styles: nodeCardCss,
    render: ({ data }) => resizeBody(label(data)),
    resizer: { minWidth: 100, minHeight: 50 },
  }),
  lines: defineNodeType({
    styles: nodeCardCss,
    render: ({ data }) => resizeBody(label(data)),
    resizer: { variant: 'lines' },
  }),
  corner: defineNodeType({
    styles: nodeCardCss,
    render: ({ data }) => resizeBody(label(data)),
    resizer: { variant: 'hover-corner' },
  }),
  aspect: defineNodeType({
    styles: nodeCardCss,
    render: ({ data }) => resizeBody(label(data)),
    resizer: { keepAspectRatio: true, minWidth: 80, minHeight: 40 },
  }),
};

export const Resizer: Story = {
  render: (args) => {
    const at = (id: string, type: string, x: number, y: number, text: string): Node => ({
      id,
      type,
      position: { x, y },
      width: 180,
      height: 80,
      data: { label: text },
    });
    const nodes = (): Node[] => [
      { ...at('a', 'handles', 0, 0, 'handles (selected)'), selected: true },
      at('b', 'lines', 280, 0, 'lines (select me)'),
      at('c', 'corner', 0, 160, 'hover-corner (hover me)'),
      at('d', 'aspect', 280, 160, 'keeps aspect ratio'),
    ];
    return html`<xy-flow
      ${props(flowPropsOf(args))}
      .nodeTypes=${resizeTypes}
      .nodes=${once(nodes)}
      .edges=${once((): Edge[] => [])}
    >
      ${chrome({ minimap: false })}
    </xy-flow>`;
  },
  parameters: describe(
    'Add `resizer` to `defineNodeType` to make a node resizable. `variant` is `handles` (corner and edge handles while selected), `lines` (edge lines) or `hover-corner` (one corner handle on hover); `minWidth`, `keepAspectRatio` and friends constrain the size. Resize events carry `origin: "resize"` through the change pipeline.',
  ),
};

// ---- NodeToolbar ------------------------------------------------------------------------------------

const toolbar = { position: 'top' as const, align: 'center' as const, always: false };
const toolbarNode = defineNodeType<Node<{ label: string }>>({
  styles: nodeCardCss,
  render: ({ id, data }) => html`
    ${nodeToolbar(
      {
        position: toolbar.position,
        align: toolbar.align,
        isVisible: toolbar.always ? true : undefined,
      },
      html`<div
        class="sb-card"
        style="display:flex;gap:4px;padding:4px"
        role="toolbar"
        aria-label="Actions for ${id}"
      >
        <button class="sb-btn">Copy</button><button class="sb-btn">Delete</button
        ><button class="sb-btn">More</button>
      </div>`,
    )}
    <xy-handle type="target" position="left"></xy-handle>
    <div class="sb-node">${data.label}</div>
    <xy-handle type="source" position="right"></xy-handle>
  `,
});
const toolbarTypes = { toolbar: toolbarNode };

class NodeToolbarStory extends StoryElement {
  static override properties = { args: { attribute: false } };
  declare args: Args;
  #dirty = false;
  protected override willUpdate(): void {
    const next = {
      position: this.args.toolbarPosition ?? 'top',
      align: this.args.toolbarAlign ?? 'center',
      always: this.args.alwaysVisible ?? false,
    };
    this.#dirty =
      next.position !== toolbar.position ||
      next.align !== toolbar.align ||
      next.always !== toolbar.always;
    Object.assign(toolbar, next);
  }
  protected override updated(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    // the toolbar is part of the node template: re-render the nodes by touching their data
    const flow = this.querySelector('xy-flow') as XyFlowElement;
    for (const n of flow.getNodes()) flow.updateNodeData(n.id, { rev: Math.random() });
  }
  override render() {
    const nodes = (): Node[] => [
      {
        id: 'a',
        type: 'toolbar',
        position: { x: 0, y: 70 },
        selected: true,
        data: { label: 'Select me' },
      },
      { id: 'b', type: 'toolbar', position: { x: 280, y: 0 }, data: { label: 'Or me' } },
      { id: 'c', type: 'toolbar', position: { x: 280, y: 150 }, data: { label: 'Or me too' } },
    ];
    return html`<xy-flow
      ${props(flowPropsOf(this.args))}
      .nodeTypes=${toolbarTypes}
      .nodes=${once(nodes)}
      .edges=${once((): Edge[] => [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'ac', source: 'a', target: 'c' },
      ])}
    >
      ${chrome({ minimap: false })}
    </xy-flow>`;
  }
}
defineStoryElement('sb-node-toolbar', NodeToolbarStory);

export const NodeToolbar: Story = {
  args: { toolbarPosition: 'top', toolbarAlign: 'center', alwaysVisible: false },
  parameters: {
    ...describe(
      '`nodeToolbar(options, content)` inside a node template renders a toolbar next to the node. It is not scaled with the viewport, follows the node, and shows for the selected node by default. Use the controls to change `position`, `align` and `isVisible`.',
    ),
    controls: { include: ['toolbarPosition', 'toolbarAlign', 'alwaysVisible'] },
  },
  render: (args) => html`<sb-node-toolbar .args=${args}></sb-node-toolbar>`,
};

// ---- WheelScrollInside ------------------------------------------------------------------------------

const scrollNode = defineNodeType<Node<{ title: string }>>({
  styles: nodeCardCss,
  render: ({ data }) => html`
    <xy-handle type="target" position="left"></xy-handle>
    <div class="sb-node" style="width: 200px">
      <strong>${data.title}</strong>
      <div
        tabindex="0"
        role="region"
        aria-label="Scrollable list"
        style="height: 110px; overflow: auto; margin-top: 6px; border: 1px solid rgba(128,128,128,.35); border-radius: 4px; padding: 4px 8px"
      >
        ${Array.from({ length: 24 }, (_, i) => html`<div style="padding: 2px 0">Row ${i + 1}</div>`)}
      </div>
    </div>
    <xy-handle type="source" position="right"></xy-handle>
  `,
});
const scrollTypes = { scroll: scrollNode };

export const WheelScrollInside: Story = {
  args: { wheelScrollDetection: 'auto' },
  parameters: { controls: { include: ['wheelScrollDetection', 'zoomOnScroll'] } },
  render: (args) => {
    const nodes = (): Node[] => [
      { id: 'a', type: 'scroll', position: { x: 0, y: 40 }, data: { title: 'Scrollable list' } },
      { id: 'b', position: { x: 320, y: 100 }, data: { label: 'Plain node: wheel zooms' }, ...lr },
    ];
    return html`<xy-flow
      ${props({ ...flowPropsOf(args), wheelScrollDetection: args.wheelScrollDetection })}
      .nodeTypes=${scrollTypes}
      .nodes=${once(nodes)}
      .edges=${once((): Edge[] => [{ id: 'e', source: 'a', target: 'b' }])}
    >
      ${chrome({ minimap: false })}
      ${hint('Scroll over the list: it scrolls, the canvas does not zoom.')}
    </xy-flow>`;
  },
  argTypes: { wheelScrollDetection: { control: 'inline-radio', options: ['auto', 'off'] } },
};
