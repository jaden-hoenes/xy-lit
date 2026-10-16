import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { labeledHandle } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType, uiStyles } from './_lib/ui.ts';

interface Args {
  inputs?: number;
  title?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Labeled Handle',
  argTypes: {
    inputs: {
      control: { type: 'range', min: 1, max: 5, step: 1 },
      description: 'Number of labeled target handles.',
    },
    title: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<Args>;

class LabeledStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = {
      small: smallType,
      mixer: defineNodeType({
        styles: uiStyles,
        render: ({ selected }) =>
          html`<xy-base-node
            class="xy-ui-node"
            ?selected=${selected}
            style="--xy-base-node-padding: 6px 14px; --xy-base-node-min-width: 200px"
          >
            <div slot="header">${this.args.title}</div>
            ${Array.from({ length: this.args.inputs ?? 2 }, (_, i) =>
              labeledHandle({
                type: 'target',
                position: 'left',
                id: `in-${i}`,
                label: `Signal ${String.fromCharCode(65 + i)}`,
              }),
            )}
            ${labeledHandle({ type: 'source', position: 'right', id: 'out', label: 'Mix' })}
          </xy-base-node>`,
      }),
    };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'small', position: { x: 0, y: 0 }, data: { label: 'Source A' } },
      { id: 'b', type: 'small', position: { x: 0, y: 70 }, data: { label: 'Source B' } },
      { id: 'mixer', type: 'mixer', position: { x: 190, y: -10 }, data: {} },
      { id: 'out', type: 'small', position: { x: 470, y: 30 }, data: { label: 'Output' } },
    ];
  }
  protected override edges(): Edge[] {
    return [
      { id: 'a-m', source: 'a', target: 'mixer', targetHandle: 'in-0', type: 'smoothstep' },
      { id: 'b-m', source: 'b', target: 'mixer', targetHandle: 'in-1', type: 'smoothstep' },
      { id: 'm-o', source: 'mixer', sourceHandle: 'out', target: 'out', type: 'smoothstep' },
    ];
  }
}
defineStoryElement('sb-ui-labeled-handle', LabeledStory);

export const Default: Story = {
  args: { inputs: 2, title: 'Mixer' },
  render: (args) => html`<sb-ui-labeled-handle .args=${args}></sb-ui-labeled-handle>`,
  parameters: describe(
    '`labeledHandle({ type, position, id, label })` is a handle with a text label on the node border, the usual way to name the ports of a node with several inputs or outputs. Use it directly inside `<xy-base-node>`; give each handle an `id` so edges can pick a port with `sourceHandle` / `targetHandle`.',
  ),
};
