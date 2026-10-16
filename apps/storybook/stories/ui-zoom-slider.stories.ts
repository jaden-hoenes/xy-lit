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
  title: 'UI/Zoom Slider',
  component: 'xy-zoom-slider',
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

class ZoomSliderStory extends UiStory<Args> {
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
    return html`<xy-zoom-slider
      position=${this.args.position ?? 'bottom-center'}
    ></xy-zoom-slider>`;
  }
}
defineStoryElement('sb-ui-zoom-slider', ZoomSliderStory);

export const Default: Story = {
  args: { position: 'bottom-center' },
  render: (args) => html`<sb-ui-zoom-slider .args=${args}></sb-ui-zoom-slider>`,
  parameters: describe(
    "`<xy-zoom-slider>` is a slider with minus and plus buttons and a percentage readout that resets the zoom to 100% when pressed. It follows the flow's `min-zoom` and `max-zoom` and any zoom (wheel, controls, fit view).",
  ),
};
