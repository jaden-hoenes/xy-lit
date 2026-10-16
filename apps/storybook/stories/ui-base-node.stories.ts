import { css, html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, uiStyles } from './_lib/ui.ts';

interface Args {
  title?: string;
  body?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  selected?: boolean;
}

const meta: Meta<Args> = {
  title: 'UI/Base Node',
  component: 'xy-base-node',
  argTypes: {
    title: { control: 'text', description: 'Content of the `header` slot.' },
    body: { control: 'text', description: 'Default slot.' },
    showHeader: { control: 'boolean', description: 'Header and footer are hidden unless slotted.' },
    showFooter: { control: 'boolean' },
    selected: { control: 'boolean', description: '`selected` attribute: the accent ring.' },
  },
  parameters: { controls: { include: ['title', 'body', 'showHeader', 'showFooter', 'selected'] } },
};
export default meta;
type Story = StoryObj<Args>;

const styles = css`
  .sb-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 12px;
  }
  .sb-footer button {
    font: inherit;
    padding: 2px 10px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
`;

class BaseNodeStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = {
      card: defineNodeType({
        styles: [uiStyles, styles],
        render: ({ data, selected }) => {
          const a = this.args;
          return html`<xy-base-node
            class="xy-ui-node"
            ?selected=${selected || ((data as { pin?: boolean }).pin === true && !!a.selected)}
            style="--xy-base-node-min-width: 200px"
          >
            ${a.showHeader ? html`<div slot="header"><strong>${a.title}</strong></div>` : ''}
            ${a.body}
            ${
              a.showFooter
                ? html`<div slot="footer" class="sb-footer">
                    <span>Footer</span><button class="nodrag">Action</button>
                  </div>`
                : ''
            }
            <xy-handle type="target" position="left"></xy-handle>
            <xy-handle type="source" position="right"></xy-handle>
          </xy-base-node>`;
        },
      }),
    };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'card', position: { x: 0, y: 30 }, data: { pin: true } },
      { id: 'b', type: 'card', position: { x: 330, y: 30 }, data: {} },
    ];
  }
  protected override edges(): Edge[] {
    return [{ id: 'ab', source: 'a', target: 'b' }];
  }
}
defineStoryElement('sb-ui-base-node', BaseNodeStory);

export const Default: Story = {
  args: {
    title: 'Base node',
    body: 'A card with optional header and footer slots.',
    showHeader: true,
    showFooter: true,
    selected: false,
  },
  render: (args) => html`<sb-ui-base-node .args=${args}></sb-ui-base-node>`,
  parameters: describe(
    '`<xy-base-node>` is the card the other UI components build on: a shadow-DOM box with `header`, default and `footer` slots (header and footer only appear when slotted) and a `selected` ring. Handles are slotted light-DOM children. Colours come from the flow tokens, so it follows the colour mode.',
  ),
};
