import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';
import { labelled } from './_lib/ui-plugins.ts';

interface Args {
  position?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Zoom Select',
  component: 'xy-zoom-select',
  argTypes: {
    position: {
      control: 'select',
      options: [
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ],
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class ZoomSelectStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { small: smallType };
  }
  protected override nodes(): Node[] {
    return labelled().nodes;
  }
  protected override edges(): Edge[] {
    return labelled().edges;
  }
  protected override plugins() {
    return html`<xy-zoom-select position=${this.args.position ?? 'top-center'}></xy-zoom-select>`;
  }
}
defineStoryElement('sb-ui-zoom-select', ZoomSelectStory);

export const Default: Story = {
  args: { position: 'top-center' },
  render: (args) => html`<sb-ui-zoom-select .args=${args}></sb-ui-zoom-select>`,
  parameters: describe(
    '`<xy-zoom-select>` is a menu of zoom presets (50, 100, 150 and 200 percent) plus "Fit view". When the current zoom is none of the presets (scroll to zoom) it adds an entry for it.',
  ),
};
