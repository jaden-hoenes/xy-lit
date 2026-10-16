import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { MarkerType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { uiEdgeTypes } from '@xy-lit/ui';
import type { EdgePathType } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';

interface Args {
  pathType?: EdgePathType;
  rate?: number;
}

const meta: Meta<Args> = {
  title: 'UI/Data Edge',
  argTypes: {
    pathType: { control: 'inline-radio', options: ['bezier', 'smoothstep', 'step', 'straight'] },
    rate: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
      description: 'The value `edge.data.rate` shown as the label.',
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class DataEdgeStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { small: smallType };
    this.edgeTypes = { ...uiEdgeTypes };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'small', position: { x: 0, y: 0 }, data: { label: 'Gateway' } },
      { id: 'b', type: 'small', position: { x: 360, y: 90 }, data: { label: 'Service' } },
    ];
  }
  protected override edges(): Edge[] {
    return [
      {
        id: 'a-b',
        source: 'a',
        target: 'b',
        type: 'data',
        data: {
          key: 'rate',
          rate: `${this.args.rate ?? 120} req/s`,
          pathType: this.args.pathType ?? 'bezier',
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      },
    ];
  }
  protected override updated(): void {
    this.flow.updateEdgeData('a-b', {
      rate: `${this.args.rate ?? 120} req/s`,
      pathType: this.args.pathType ?? 'bezier',
    });
  }
}
defineStoryElement('sb-ui-data-edge', DataEdgeStory);

export const Default: Story = {
  args: { pathType: 'bezier', rate: 120 },
  render: (args) => html`<sb-ui-data-edge .args=${args}></sb-ui-data-edge>`,
  parameters: describe(
    'The `data` edge labels itself with a value from its own data: `data: { key: "rate", rate: "120 req/s" }` shows `120 req/s` at the middle of the edge (it falls back to the source node\'s data). Change the value in the controls and the label follows.',
  ),
};
