import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Node } from '@xy-lit/flow';
import { defaultShapes, uiNodeTypes } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory } from './_lib/ui.ts';

interface Args {
  color?: string;
  labels?: boolean;
}

const meta: Meta<Args> = {
  title: 'UI/Shape Node',
  argTypes: {
    color: {
      control: 'color',
      description: 'One colour for every shape; unset gives each its own.',
    },
    labels: { control: 'boolean', description: 'Show the shape name inside.' },
  },
};
export default meta;
type Story = StoryObj<Args>;

const palette = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

class ShapeStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { ...uiNodeTypes };
  }
  protected override nodes(): Node[] {
    return defaultShapes.names().map((name, i) => ({
      id: `shape-${name}`,
      type: 'shape',
      position: { x: (i % 4) * 190, y: Math.floor(i / 4) * 150 },
      width: 148,
      height: 112,
      data: {
        shape: name,
        label: this.args.labels === false ? '' : name,
        color: this.args.color || palette[i % palette.length],
      },
    }));
  }
  protected override updated(): void {
    // data comes from the args: write it into the nodes when a control changes
    for (const [i, name] of defaultShapes.names().entries()) {
      this.flow.updateNodeData(`shape-${name}`, {
        label: this.args.labels === false ? '' : name,
        color: this.args.color || palette[i % palette.length],
      });
    }
  }
}
defineStoryElement('sb-ui-shape', ShapeStory);

export const Default: Story = {
  args: { labels: true },
  render: (args) => html`<sb-ui-shape .args=${args}></sb-ui-shape>`,
  parameters: describe(
    'The `shape` node type draws any shape from a `ShapeRegistry` (twelve ship by default: rectangle, diamond, hexagon, cylinder, ...). Select a shape to resize it with the handles; every shape has connection points on its outline. `register(name, { path, handles, textBox })` adds your own.',
  ),
};
