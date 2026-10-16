import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { statusIndicator } from '@xy-lit/ui';
import type { NodeStatus } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, uiStyles } from './_lib/ui.ts';

interface Args {
  status?: NodeStatus;
}

const meta: Meta<Args> = {
  title: 'UI/Status Indicator',
  argTypes: {
    status: { control: 'inline-radio', options: ['initial', 'loading', 'success', 'error'] },
  },
};
export default meta;
type Story = StoryObj<Args>;

class StatusStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = {
      task: defineNodeType({
        styles: uiStyles,
        render: ({ id, data, selected }, flow) => {
          const d = data as { title: string; status: NodeStatus; live?: boolean };
          const status = d.live ? (this.args.status ?? 'loading') : d.status;
          const run = (): void => {
            flow.updateNodeData(id, { status: 'loading', live: false });
            setTimeout(() => flow.updateNodeData(id, { status: 'success' }), 1500);
          };
          return statusIndicator(
            status,
            html`<xy-base-node
              class="xy-ui-node"
              ?selected=${selected}
              style="--xy-base-node-min-width: 150px"
            >
              <div slot="header">${d.title}</div>
              <span style="text-transform: capitalize">${status}</span>
              <div slot="footer">
                <button class="nodrag" ?disabled=${status === 'loading'} @click=${run}>Run</button>
              </div>
              <xy-handle type="target" position="left"></xy-handle>
              <xy-handle type="source" position="right"></xy-handle>
            </xy-base-node>`,
          );
        },
      }),
    };
  }
  protected override nodes(): Node[] {
    return [
      {
        id: 'live',
        type: 'task',
        position: { x: 0, y: 0 },
        data: { title: 'Controlled by the story', status: 'loading', live: true },
      },
      {
        id: 'initial',
        type: 'task',
        position: { x: 300, y: -60 },
        data: { title: 'Initial', status: 'initial' },
      },
      {
        id: 'success',
        type: 'task',
        position: { x: 300, y: 60 },
        data: { title: 'Success', status: 'success' },
      },
      {
        id: 'error',
        type: 'task',
        position: { x: 520, y: -60 },
        data: { title: 'Error', status: 'error' },
      },
      {
        id: 'loading',
        type: 'task',
        position: { x: 520, y: 60 },
        data: { title: 'Loading', status: 'loading' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [
      { id: 'a', source: 'live', target: 'initial' },
      { id: 'b', source: 'live', target: 'success' },
    ];
  }
}
defineStoryElement('sb-ui-status', StatusStory);

export const Default: Story = {
  args: { status: 'loading' },
  render: (args) => html`<sb-ui-status .args=${args}></sb-ui-status>`,
  parameters: describe(
    '`statusIndicator(status, content)` wraps node content in a status ring drawn outside the box, so the node does not change size: a rotating ring while `loading`, green on `success`, red on `error`, none for `initial`. It sets `aria-busy` and stops spinning under `prefers-reduced-motion`. The first node follows the status control; press Run on any node to see a loading-to-success run.',
  ),
};
