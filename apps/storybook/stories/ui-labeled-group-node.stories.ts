import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { uiNodeTypes } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';

interface Args {
  label?: string;
  labelPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const meta: Meta<Args> = {
  title: 'UI/Labeled Group Node',
  argTypes: {
    label: { control: 'text' },
    labelPosition: {
      control: 'inline-radio',
      options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class GroupStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { ...uiNodeTypes, small: smallType };
  }
  protected override nodes(): Node[] {
    return [
      {
        id: 'g',
        type: 'labeledGroup',
        position: { x: 0, y: 0 },
        width: 520,
        height: 260,
        zIndex: -1,
        data: { label: this.args.label, labelPosition: this.args.labelPosition },
      },
      {
        id: 'a',
        type: 'small',
        parentId: 'g',
        position: { x: 40, y: 80 },
        data: { label: 'Parse' },
      },
      {
        id: 'b',
        type: 'small',
        parentId: 'g',
        position: { x: 220, y: 40 },
        data: { label: 'Validate' },
      },
      {
        id: 'c',
        type: 'small',
        parentId: 'g',
        position: { x: 220, y: 140 },
        data: { label: 'Enrich' },
      },
      {
        id: 'd',
        type: 'small',
        parentId: 'g',
        position: { x: 390, y: 80 },
        data: { label: 'Store' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [
      { id: 'a-b', source: 'a', target: 'b', type: 'smoothstep' },
      { id: 'a-c', source: 'a', target: 'c', type: 'smoothstep' },
      { id: 'b-d', source: 'b', target: 'd', type: 'smoothstep' },
      { id: 'c-d', source: 'c', target: 'd', type: 'smoothstep' },
    ];
  }
}
defineStoryElement('sb-ui-group', GroupStory);

export const Default: Story = {
  args: { label: 'Ingest pipeline', labelPosition: 'top-left' },
  render: (args) => html`<sb-ui-group .args=${args}></sb-ui-group>`,
  parameters: describe(
    '`labeledGroup` is a group node with a label tag in one of the four corners. Give it a `width` and `height`, put nodes inside with `parentId` (the group comes first in the array), and select it to resize it by its edges (minimum 120 x 80).',
  ),
};
