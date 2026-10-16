import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { nodeTooltip } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, uiStyles } from './_lib/ui.ts';

interface Args {
  position?: 'top' | 'right' | 'bottom' | 'left';
  text?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Node Tooltip',
  argTypes: {
    position: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
    text: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<Args>;

class TooltipStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = {
      tip: defineNodeType({
        styles: uiStyles,
        render: ({ data, selected }) =>
          html`<xy-base-node class="xy-ui-node" ?selected=${selected} tabindex="0">
            ${nodeTooltip({ position: this.args.position ?? 'top' }, this.args.text)}
            ${String((data as { label: string }).label)}
            <xy-handle type="target" position="left"></xy-handle>
            <xy-handle type="source" position="right"></xy-handle>
          </xy-base-node>`,
      }),
    };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'tip', position: { x: 0, y: 60 }, data: { label: 'Hover me' } },
      {
        id: 'b',
        type: 'tip',
        position: { x: 260, y: 60 },
        data: { label: 'Or focus me with Tab' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [{ id: 'ab', source: 'a', target: 'b' }];
  }
  protected override plugins() {
    return html`<xy-panel position="top-left"
      ><div class="sb-card">Hover a node to see its tooltip.</div></xy-panel
    >`;
  }
}
defineStoryElement('sb-ui-tooltip', TooltipStory);

export const Default: Story = {
  args: { position: 'top', text: 'Runs nightly at 02:00' },
  render: (args) => html`<sb-ui-tooltip .args=${args}></sb-ui-tooltip>`,
  parameters: describe(
    '`nodeTooltip({ position }, content)` is a node toolbar driven by hover and keyboard focus of the node that contains it. It is not scaled with the viewport, never takes pointer events and works with the same positions as `nodeToolbar`.',
  ),
};
