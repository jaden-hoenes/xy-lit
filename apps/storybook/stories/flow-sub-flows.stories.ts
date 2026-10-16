import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  chrome,
  defineStoryElement,
  describe,
  fitWhenRendered,
  groupTypes,
  titled,
  flowArgTypes,
  flowControls,
  flowPropsOf,
  once,
  props,
} from './_lib/flow.ts';
import type { FlowArgs } from './_lib/flow.ts';

const meta: Meta<FlowArgs> = {
  title: 'Flow/Sub-flows',
  component: 'xy-flow',
  argTypes: flowArgTypes,
  parameters: { controls: { include: flowControls } },
  args: { fitViewOnInit: true },
};
export default meta;
type Story = StoryObj<FlowArgs>;

// ---- ParentExtent -----------------------------------------------------------------------------------

class ParentExtentStory extends StoryElement {
  static override properties = { args: { attribute: false }, confined: { state: true } };
  declare args: FlowArgs;
  declare confined: boolean;
  constructor() {
    super();
    this.confined = true;
  }
  get #flow() {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  #setExtent(confined: boolean): void {
    this.confined = confined;
    for (const id of ['in1', 'in2']) {
      this.#flow.updateNode(id, { extent: confined ? 'parent' : undefined });
    }
  }
  override render() {
    const nodes = (): Node[] => [
      { id: 'outside', type: 'input', position: { x: 0, y: 130 }, data: { label: 'Outside' } },
      titled('p', 'Parent', '99, 102, 241', {
        position: { x: 260, y: 0 },
        width: 340,
        height: 280,
      }),
      {
        id: 'in1',
        parentId: 'p',
        extent: 'parent',
        position: { x: 30, y: 50 },
        data: { label: 'Child 1' },
      },
      {
        id: 'in2',
        parentId: 'p',
        extent: 'parent',
        position: { x: 150, y: 170 },
        data: { label: 'Child 2' },
      },
    ];
    const edges = (): Edge[] => [
      { id: 'o-1', source: 'outside', target: 'in1' },
      { id: '1-2', source: 'in1', target: 'in2', animated: true },
    ];
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          aria-pressed=${this.confined}
          @click=${() => this.#setExtent(!this.confined)}
        >
          extent: ${this.confined ? "'parent'" : 'none'}
        </button>
        <span class="sb-muted"
          >${this.confined ? 'Children cannot leave the parent.' : 'Children can be dragged out of the parent.'}</span
        >
      </div>
      <xy-flow
        ${props(flowPropsOf(this.args))}
        ${fitWhenRendered()}
        .nodeTypes=${groupTypes}
        .nodes=${once(nodes)}
        .edges=${once(edges)}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-parent-extent', ParentExtentStory);

export const ParentExtent: Story = {
  render: (args) => html`<sb-parent-extent .args=${args}></sb-parent-extent>`,
  parameters: describe(
    'Nodes with a `parentId` are positioned relative to the parent and move with it. `extent: "parent"` keeps a child inside the parent while you drag it. Toggle the extent to see the difference; the edge from the outside node still works either way.',
  ),
};

// ---- ExpandParent -----------------------------------------------------------------------------------

export const ExpandParent: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      titled('p', 'Group', '16, 185, 129', { position: { x: 80, y: 40 }, width: 320, height: 200 }),
      {
        id: 'c1',
        parentId: 'p',
        expandParent: true,
        position: { x: 30, y: 40 },
        data: { label: 'Drag me out' },
      },
      {
        id: 'c2',
        parentId: 'p',
        expandParent: true,
        position: { x: 30, y: 120 },
        data: { label: 'Me too' },
      },
    ];
    return html`
      <xy-flow
        ${props(flowPropsOf(args))}
        ${fitWhenRendered()}
        .nodeTypes=${groupTypes}
        .nodes=${once(nodes)}
        .edges=${once((): Edge[] => [{ id: 'e', source: 'c1', target: 'c2' }])}
      >
        ${chrome({ minimap: false })}
        <xy-panel position="top-left"
          ><div class="sb-card">Drag a child past the edge: the group grows with it.</div></xy-panel
        >
      </xy-flow>
    `;
  },
  parameters: describe(
    '`expandParent: true` on a child makes the parent grow (and shift) when the child is dragged beyond its border, instead of clipping it. Works with groups that have an explicit `width` and `height`.',
  ),
};

// ---- NestedGroups -----------------------------------------------------------------------------------

export const NestedGroups: Story = {
  render: (args) => {
    const nodes = (): Node[] => [
      { id: 'start', type: 'input', position: { x: 0, y: 160 }, data: { label: 'Start' } },
      titled('a', 'Outer group', '99, 102, 241', {
        position: { x: 240, y: 0 },
        width: 460,
        height: 360,
      }),
      {
        id: 'a1',
        parentId: 'a',
        extent: 'parent',
        position: { x: 20, y: 50 },
        data: { label: 'Outer child' },
      },
      titled('b', 'Inner group', '236, 72, 153', {
        parentId: 'a',
        extent: 'parent',
        position: { x: 20, y: 130 },
        width: 420,
        height: 200,
      }),
      {
        id: 'b1',
        parentId: 'b',
        extent: 'parent',
        position: { x: 20, y: 50 },
        data: { label: 'Inner 1' },
      },
      {
        id: 'b2',
        parentId: 'b',
        extent: 'parent',
        position: { x: 220, y: 110 },
        data: { label: 'Inner 2' },
      },
      { id: 'end', type: 'output', position: { x: 800, y: 160 }, data: { label: 'End' } },
    ];
    const edges = (): Edge[] => [
      { id: 's-a1', source: 'start', target: 'a1' },
      { id: 'a1-b1', source: 'a1', target: 'b1' },
      { id: 'b1-b2', source: 'b1', target: 'b2', animated: true },
      { id: 'b2-end', source: 'b2', target: 'end' },
    ];
    return html`
      <xy-flow
        ${props(flowPropsOf(args))}
        ${fitWhenRendered()}
        .nodeTypes=${groupTypes}
        .nodes=${once(nodes)}
        .edges=${once(edges)}
      >
        ${chrome()}
      </xy-flow>
    `;
  },
  parameters: describe(
    'Groups can contain groups. Positions are relative to the direct parent, edges connect across levels, and dragging an outer group moves everything inside it. Parents must come before their children in the `nodes` array.',
  ),
};
