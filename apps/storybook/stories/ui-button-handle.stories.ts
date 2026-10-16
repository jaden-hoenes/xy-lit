import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { FlowNodeElement, NodeConnectionsController } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { buttonHandle } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, uiStyles } from './_lib/ui.ts';

interface Args {
  label?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Button Handle',
  argTypes: { label: { control: 'text', description: 'Accessible name of the button.' } },
};
export default meta;
type Story = StoryObj<Args>;

let counter = 0;

/** A step with a "+" button on its output handle while nothing is connected to it. */
class StepNode extends FlowNodeElement<Node<{ title: string; sub?: string }>> {
  static override styles = [uiStyles];
  readonly #outgoing = new NodeConnectionsController(this, { handleType: 'source' });
  #addNext(): void {
    const { flow, props } = this;
    const id = `step-added-${++counter}`;
    flow.addNodes({
      id,
      type: 'step',
      position: { x: props.positionAbsoluteX + 240, y: props.positionAbsoluteY },
      data: { title: `Step ${counter + 1}`, sub: 'Added with the button' },
    });
    flow.addEdges({ id: `e-${props.id}-${id}`, source: props.id, target: id, type: 'smoothstep' });
  }
  protected override render() {
    const has = (this.#outgoing.value?.length ?? 0) > 0;
    return html`<xy-base-node
      class="xy-ui-node"
      ?selected=${this.props.selected}
      style="--xy-base-node-min-width: 150px"
    >
      <strong>${this.data.title}</strong>
      <div style="opacity: 0.65; font-size: 12px">${this.data.sub ?? ''}</div>
      <xy-handle type="target" position="left"></xy-handle>
      ${buttonHandle({
        type: 'source',
        position: 'right',
        showButton: !has,
        label: 'Add next step',
        onClick: () => this.#addNext(),
      })}
    </xy-base-node>`;
  }
}

class ButtonHandleStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { step: defineStoryElement('sb-ui-step-node', StepNode) };
  }
  protected override nodes(): Node[] {
    return [
      {
        id: 'start',
        type: 'step',
        position: { x: 0, y: 30 },
        data: { title: 'Step 1', sub: 'Click + to add the next step' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [];
  }
}
defineStoryElement('sb-ui-button-handle', ButtonHandleStory);

export const Default: Story = {
  args: { label: 'Add next step' },
  render: (args) => html`<sb-ui-button-handle .args=${args}></sb-ui-button-handle>`,
  parameters: describe(
    '`buttonHandle({ type, position, showButton, onClick })` puts a button beside a handle, on the outer side of the node. Show it while the handle has no connection (here via `NodeConnectionsController`) to grow a flow one step at a time. The button is `nodrag nopan`, and pressing it never starts a connection.',
  ),
};
