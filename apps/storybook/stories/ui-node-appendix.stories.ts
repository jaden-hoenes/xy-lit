import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { nodeAppendix } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, uiStyles } from './_lib/ui.ts';

interface Args {
  side?: 'top' | 'right' | 'bottom' | 'left';
  text?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Node Appendix',
  argTypes: {
    side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
    text: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<Args>;

class AppendixStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = {
      worker: defineNodeType({
        styles: uiStyles,
        render: ({ data, selected }) =>
          html`<xy-base-node class="xy-ui-node" ?selected=${selected}>
            ${String((data as { label: string }).label)}
            ${nodeAppendix(this.args.side ?? 'bottom', (data as { note: string }).note || this.args.text)}
            <xy-handle type="target" position="left"></xy-handle>
            <xy-handle type="source" position="right"></xy-handle>
          </xy-base-node>`,
      }),
    };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'worker', position: { x: 0, y: 40 }, data: { label: 'Worker A', note: '' } },
      {
        id: 'b',
        type: 'worker',
        position: { x: 280, y: 40 },
        data: { label: 'Worker B', note: 'Fixed note: idle' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [{ id: 'ab', source: 'a', target: 'b' }];
  }
}
defineStoryElement('sb-ui-appendix', AppendixStory);

export const Default: Story = {
  args: { side: 'bottom', text: 'Last run 3 min ago' },
  render: (args) => html`<sb-ui-appendix .args=${args}></sb-ui-appendix>`,
  parameters: describe(
    '`nodeAppendix(side, content)` attaches a small label to one side of a node, outside its box (a timestamp, a count, a state). It is positioned against the node, moves with it and is part of the node template.',
  ),
};
