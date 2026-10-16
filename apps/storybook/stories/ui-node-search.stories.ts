import { html } from 'lit';
import { action } from 'storybook/actions';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import type { NodeSearchSelectDetail } from '@xy-lit/ui';
import { defineStoryElement, describe, on } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';
import { labelled } from './_lib/ui-plugins.ts';

interface Args {
  placeholder?: string;
  maxResults?: number;
  zoom?: number;
  position?: string;
}

const meta: Meta<Args> = {
  title: 'UI/Node Search',
  component: 'xy-node-search',
  argTypes: {
    placeholder: { control: 'text' },
    maxResults: { control: { type: 'range', min: 1, max: 12, step: 1 } },
    zoom: {
      control: { type: 'range', min: 0.5, max: 2, step: 0.1 },
      description: 'Zoom when centring on a result.',
    },
    position: {
      control: 'select',
      options: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'],
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class NodeSearchStory extends UiStory<Args> {
  readonly #log = action('node-search-select');
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
    return html`<xy-node-search
      position=${this.args.position ?? 'top-left'}
      placeholder=${this.args.placeholder ?? 'Search nodes'}
      max-results=${this.args.maxResults ?? 8}
      zoom=${this.args.zoom ?? 1}
      ${on({ 'node-search-select': (e) => this.#log((e as CustomEvent<NodeSearchSelectDetail>).detail.node.id) })}
    ></xy-node-search>`;
  }
}
defineStoryElement('sb-ui-node-search', NodeSearchStory);

export const Default: Story = {
  args: { placeholder: 'Search nodes', maxResults: 8, zoom: 1, position: 'top-left' },
  render: (args) => html`<sb-ui-node-search .args=${args}></sb-ui-node-search>`,
  parameters: describe(
    '`<xy-node-search>` is a combobox that filters nodes by label (`.getLabel` changes what is searched), pans and zooms to the one you pick, and selects it. It is keyboard operable (arrows, Enter, Escape) and fires `node-search-select`, logged in the Actions panel. Try typing "re".',
  ),
};
