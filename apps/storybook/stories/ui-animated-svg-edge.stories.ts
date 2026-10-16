import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { uiEdgeTypes } from '@xy-lit/ui';
import type { EdgePathType } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory, smallType } from './_lib/ui.ts';

interface Args {
  pathType?: EdgePathType;
  duration?: number;
  radius?: number;
}

const meta: Meta<Args> = {
  title: 'UI/Animated SVG Edge',
  argTypes: {
    pathType: { control: 'inline-radio', options: ['bezier', 'smoothstep', 'step', 'straight'] },
    duration: {
      control: { type: 'range', min: 0.5, max: 6, step: 0.5 },
      description: 'Seconds per trip.',
    },
    radius: {
      control: { type: 'range', min: 2, max: 10, step: 1 },
      description: 'Radius of the travelling dot.',
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

class AnimatedEdgeStory extends UiStory<Args> {
  constructor() {
    super();
    this.nodeTypes = { small: smallType };
    this.edgeTypes = { ...uiEdgeTypes };
  }
  protected override nodes(): Node[] {
    return [
      { id: 'a', type: 'small', position: { x: 0, y: 0 }, data: { label: 'Producer' } },
      { id: 'b', type: 'small', position: { x: 380, y: 100 }, data: { label: 'Consumer' } },
    ];
  }
  protected data() {
    return {
      duration: `${this.args.duration ?? 2}s`,
      radius: this.args.radius ?? 4,
      pathType: this.args.pathType ?? 'bezier',
    };
  }
  protected override edges(): Edge[] {
    return [{ id: 'a-b', source: 'a', target: 'b', type: 'animatedSvg', data: this.data() }];
  }
  protected override updated(): void {
    this.flow.updateEdgeData('a-b', this.data());
  }
}
defineStoryElement('sb-ui-animated-edge', AnimatedEdgeStory);

export const Default: Story = {
  args: { pathType: 'bezier', duration: 2, radius: 4 },
  render: (args) => html`<sb-ui-animated-edge .args=${args}></sb-ui-animated-edge>`,
  parameters: describe(
    'The `animatedSvg` edge sends a dot along the path (SVG `animateMotion`), a clearer "data is flowing" cue than dashes. `data: { duration, radius, pathType }`; the animation is switched off under `prefers-reduced-motion`.',
  ),
};
