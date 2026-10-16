import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { uiEdgeTypes } from '@xy-lit/ui';
import type { EdgePathType } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';

interface Args {
  pathType?: EdgePathType;
}

const meta: Meta<Args> = {
  title: 'UI/Button Edge',
  argTypes: {
    pathType: {
      control: 'inline-radio',
      options: ['bezier', 'smoothstep', 'step', 'straight'],
      description: '`edge.data.pathType`.',
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class ButtonEdgeStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { small: smallType };
    this.edgeTypes = { ...uiEdgeTypes };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'small', position: { x: 0, y: 0 }, data: { label: 'Alpha' } },
      { id: 'b', type: 'small', position: { x: 340, y: 80 }, data: { label: 'Beta' } },
      { id: 'c', type: 'small', position: { x: 0, y: 140 }, data: { label: 'Gamma' } },
    ];
  }
  protected override edges(): Edge[] {
    return [
      {
        id: 'a-b',
        source: 'a',
        target: 'b',
        type: 'button',
        data: { pathType: this.args.pathType ?? 'bezier' },
      },
      {
        id: 'c-b',
        source: 'c',
        target: 'b',
        type: 'button',
        data: { pathType: this.args.pathType ?? 'bezier' },
      },
    ];
  }
  protected override updated(): void {
    for (const e of this.flow.getEdges())
      this.flow.updateEdgeData(e.id, { pathType: this.args.pathType ?? 'bezier' });
  }
  protected override plugins() {
    return html`<xy-panel position="top-left"
      ><div class="sb-card">Press the button on an edge to delete it.</div></xy-panel
    >`;
  }
}
defineStoryElement('sb-ui-button-edge', ButtonEdgeStory);

export const Default: Story = {
  args: { pathType: 'bezier' },
  render: (args) => html`<sb-ui-button-edge .args=${args}></sb-ui-button-edge>`,
  parameters: describe(
    'The `button` edge draws a delete button at the middle of the edge. `data.pathType` picks the path (`bezier`, `smoothstep`, `step`, `straight`); the button is `nodrag nopan` so it never starts a drag.',
  ),
};
