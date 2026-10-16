import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';
import { labelled } from './_lib/ui-plugins.ts';

interface Args {
  viewportLogger?: boolean;
  nodeInspector?: boolean;
  changeLogger?: boolean;
  position?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Devtools',
  component: 'xy-devtools',
  argTypes: {
    viewportLogger: { control: 'boolean', description: 'Live x, y and zoom.' },
    nodeInspector: {
      control: 'boolean',
      description: 'Boxes with id, position, size and data on the nodes.',
    },
    changeLogger: { control: 'boolean', description: 'The last 50 node and edge changes.' },
    position: {
      control: 'select',
      options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class DevtoolsStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { small: smallType };
  }
  protected override nodes(): Node[] {
    return labelled(2).nodes;
  }
  protected override edges(): Edge[] {
    return labelled(2).edges;
  }
  protected override plugins() {
    return html`<xy-devtools
      position=${this.args.position ?? 'bottom-right'}
      ?viewport-logger=${this.args.viewportLogger}
      ?node-inspector=${this.args.nodeInspector}
      ?change-logger=${this.args.changeLogger}
    ></xy-devtools>`;
  }
}
defineStoryElement('sb-ui-devtools', DevtoolsStory);

export const Default: Story = {
  args: { viewportLogger: true, nodeInspector: true, changeLogger: true, position: 'bottom-right' },
  render: (args) => html`<sb-ui-devtools .args=${args}></sb-ui-devtools>`,
  parameters: describe(
    '`<xy-devtools>` is a debugging panel with three tools you can switch on and off: a viewport readout, boxes on the nodes that show their id, position, size and (when selected) data, and a log of node and edge changes with their gesture phase and origin. It only listens, so the flow stays uncontrolled. Drag a node and watch the log.',
  ),
};
