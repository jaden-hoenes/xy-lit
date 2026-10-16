import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { uiNodeTypes } from '@xy-lit/ui';
import type { PlaceholderClickDetail } from '@xy-lit/ui';
import { action } from 'storybook/actions';
import { defineStoryElement, describe, on } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';

interface Args {
  label?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Placeholder Node',
  argTypes: { label: { control: 'text', description: '`data.label`: text under the plus sign.' } },
};
export default meta;
type Story = StoryObj<Args>;

class PlaceholderStory extends UiStory<Args> {
  readonly #log = action('placeholder-click');
  constructor() {
    super();
    this.nodeTypes = { ...uiNodeTypes, small: smallType };
  }
  protected override nodes(): Node[] {
    return [
      {
        id: 'start',
        type: 'small',
        position: { x: 0, y: 0 },
        data: { label: 'Start' },
        sourcePosition: Position.Bottom,
      },
      {
        id: 'next',
        type: 'placeholder',
        position: { x: -10, y: 120 },
        data: { label: this.args.label ?? 'Add node' },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [{ id: 'e', source: 'start', target: 'next', type: 'smoothstep' }];
  }
  protected override plugins() {
    return html`<xy-panel position="top-left"
      ><div class="sb-card">Click the placeholder to turn it into a node.</div></xy-panel
    >`;
  }
  override render() {
    // listen on the flow: the placeholder's click event is composed and bubbles
    return html`<div
      style="display: contents"
      ${on({
        'placeholder-click': (e) => {
          const d = (e as CustomEvent<PlaceholderClickDetail>).detail;
          this.#log(d);
          this.flow.updateNode(d.id, { type: 'small', data: { label: 'New step' } });
        },
      })}
    >
      ${super.render()}
    </div>`;
  }
}
defineStoryElement('sb-ui-placeholder', PlaceholderStory);

export const Default: Story = {
  args: { label: 'Add node' },
  render: (args) => html`<sb-ui-placeholder .args=${args}></sb-ui-placeholder>`,
  parameters: describe(
    'The `placeholder` node is a dashed box with a plus: the slot where the next node goes. Clicking it dispatches a bubbling, composed `placeholder-click` event (`detail: { id, data }`); here the handler swaps the placeholder for a real node with `updateNode`.',
  ),
};
