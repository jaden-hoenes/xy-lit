import { html } from 'lit';
import { action } from 'storybook/actions';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { describe, on, once } from './_lib/flow.ts';

interface Args {
  variant?: 'dots' | 'lines' | 'cross';
  gap?: number;
  size?: number;
  lineWidth?: number;
  color?: string;
  twoLayers?: boolean;
  orientation?: 'vertical' | 'horizontal';
  showZoom?: boolean;
  showFitView?: boolean;
  showInteractive?: boolean;
  position?: string;
  pannable?: boolean;
  zoomable?: boolean;
  width?: number;
  height?: number;
  maskColor?: string;
  inversePan?: boolean;
  target?: 'front' | 'back';
}

const positions = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const meta: Meta<Args> = { title: 'Plugins' };
export default meta;
type Story = StoryObj<Args>;

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const small = (): Node[] => [
  { id: 'a', position: { x: 0, y: 40 }, data: { label: 'Node A' }, ...lr },
  { id: 'b', position: { x: 260, y: 0 }, data: { label: 'Node B' }, ...lr },
  { id: 'c', position: { x: 260, y: 100 }, data: { label: 'Node C' }, ...lr },
];
const smallEdges = (): Edge[] => [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'ac', source: 'a', target: 'c' },
];

// ---- Background -------------------------------------------------------------------------------------

export const Background: Story = {
  args: { variant: 'dots', gap: 20, size: 1, lineWidth: 1, twoLayers: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['dots', 'lines', 'cross'] },
    gap: { control: { type: 'range', min: 5, max: 100, step: 5 } },
    size: {
      control: { type: 'range', min: 0.5, max: 6, step: 0.5 },
      description: 'Dot or cross size.',
    },
    lineWidth: { control: { type: 'range', min: 0.5, max: 4, step: 0.5 } },
    color: { control: 'color', description: 'Pattern colour; unset follows the colour mode.' },
    twoLayers: {
      control: 'boolean',
      description: 'Adds a second, larger grid with its own `bg-id`.',
    },
  },
  parameters: {
    ...describe(
      '`<xy-background>` draws a dot, line or cross pattern that pans and zooms with the viewport. `gap`, `size`, `line-width` and `color` style it. Several backgrounds in one flow need distinct `bg-id`s: here a second layer draws a major grid every 5 cells.',
    ),
    controls: { include: ['variant', 'gap', 'size', 'lineWidth', 'color', 'twoLayers'] },
  },
  render: (args) => html`
    <xy-flow .nodes=${once(small)} .edges=${once(smallEdges)} fit-view>
      <xy-background
        bg-id="minor"
        variant=${args.variant ?? 'dots'}
        gap=${args.gap ?? 20}
        size=${args.size ?? 1}
        line-width=${args.lineWidth ?? 1}
        color=${args.color ?? ''}
      ></xy-background>
      ${
        args.twoLayers
          ? html`<xy-background
              bg-id="major"
              variant="lines"
              gap=${(args.gap ?? 20) * 5}
              line-width="1.5"
              color="rgba(99, 102, 241, 0.25)"
            ></xy-background>`
          : ''
      }
      <xy-controls></xy-controls>
    </xy-flow>
  `,
};

// ---- Controls ---------------------------------------------------------------------------------------

export const Controls: Story = {
  args: {
    orientation: 'vertical',
    showZoom: true,
    showFitView: true,
    showInteractive: true,
    position: 'bottom-left',
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    showZoom: { control: 'boolean' },
    showFitView: { control: 'boolean' },
    showInteractive: { control: 'boolean' },
    position: { control: 'select', options: positions },
  },
  parameters: {
    ...describe(
      '`<xy-controls>` gives zoom in and out, fit view and a lock toggle; the `show-*` attributes hide parts, `orientation` lays them out in a row, `position` places the panel. Your own `<xy-control-button>`s go in the default slot (or `before` / `after`). Events (`zoom-in`, `fit-view`, `interactive-change`) are logged in the Actions panel.',
    ),
    controls: {
      include: ['orientation', 'showZoom', 'showFitView', 'showInteractive', 'position'],
    },
  },
  render: (args) => {
    const log = {
      zoomIn: action('zoom-in'),
      zoomOut: action('zoom-out'),
      fit: action('fit-view'),
      interactive: action('interactive-change'),
      custom: action('custom-button'),
    };
    return html`
      <xy-flow .nodes=${once(small)} .edges=${once(smallEdges)} fit-view>
        <xy-background></xy-background>
        <xy-controls
          orientation=${args.orientation ?? 'vertical'}
          position=${args.position ?? 'bottom-left'}
          show-zoom=${args.showZoom ?? true}
          show-fit-view=${args.showFitView ?? true}
          show-interactive=${args.showInteractive ?? true}
          ${on({
            'zoom-in': () => log.zoomIn(),
            'zoom-out': () => log.zoomOut(),
            'fit-view': () => log.fit(),
            'interactive-change': (e) => log.interactive((e as CustomEvent).detail),
          })}
        >
          <xy-control-button
            aria-label="Custom button"
            title="Custom button"
            @click=${() => log.custom()}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3 6.5 20.3l1.1-6.3L3 9.6l6.3-.9z"
              />
            </svg>
          </xy-control-button>
        </xy-controls>
      </xy-flow>
    `;
  },
};

// ---- MiniMap ----------------------------------------------------------------------------------------

export const MiniMap: Story = {
  args: {
    pannable: true,
    zoomable: true,
    width: 200,
    height: 150,
    inversePan: false,
    position: 'bottom-right',
  },
  argTypes: {
    pannable: { control: 'boolean', description: 'Drag inside the map to pan the flow.' },
    zoomable: { control: 'boolean', description: 'Scroll inside the map to zoom the flow.' },
    width: { control: { type: 'range', min: 100, max: 320, step: 10 } },
    height: { control: { type: 'range', min: 80, max: 240, step: 10 } },
    inversePan: { control: 'boolean' },
    maskColor: { control: 'color', description: 'Colour of the area outside the viewport.' },
    position: { control: 'select', options: positions },
  },
  parameters: {
    ...describe(
      '`<xy-minimap>` shows the whole graph and the visible viewport. `pannable` and `zoomable` make it interactive. `.nodeColor` takes a function, so nodes can be coloured by anything: here the accent nodes (every third) are indigo. `minimap-click` and `minimap-node-click` are logged.',
    ),
    controls: {
      include: ['pannable', 'zoomable', 'width', 'height', 'inversePan', 'maskColor', 'position'],
    },
  },
  render: (args) => {
    const nodes = (): Node[] =>
      Array.from({ length: 40 }, (_, i) => ({
        id: `n${i}`,
        position: { x: (i % 8) * 220, y: Math.floor((i / 8) | 0) * 140 },
        data: { label: `Node ${i}` },
        class: i % 3 === 0 ? 'sb-accent' : '',
        ...lr,
      }));
    const colorOf = (node: Node): string => (node.class === 'sb-accent' ? '#6366f1' : '#cbd5e1');
    const logClick = action('minimap-click');
    const logNode = action('minimap-node-click');
    return html`
      <xy-flow .nodes=${once(nodes)} .edges=${once((): Edge[] => [])} min-zoom="0.1" fit-view>
        <xy-background></xy-background>
        <xy-controls position="bottom-left"></xy-controls>
        <xy-minimap
          ?pannable=${args.pannable}
          ?zoomable=${args.zoomable}
          ?inverse-pan=${args.inversePan}
          width=${args.width ?? 200}
          height=${args.height ?? 150}
          position=${args.position ?? 'bottom-right'}
          mask-color=${args.maskColor ?? ''}
          node-stroke-width="2"
          .nodeColor=${colorOf}
          ${on({
            'minimap-click': (e) =>
              logClick((e as CustomEvent<{ position: unknown }>).detail.position),
            'minimap-node-click': (e) => logNode((e as CustomEvent<{ node: Node }>).detail.node.id),
          })}
        ></xy-minimap>
      </xy-flow>
    `;
  },
};

// ---- Panel ------------------------------------------------------------------------------------------

export const PanelPositions: Story = {
  name: 'Panel',
  parameters: describe(
    '`<xy-panel position>` pins any content to a corner or edge of the flow, above the canvas and not scaled by the viewport. The eight positions are `top-left` ... `bottom-right`, plus `top-center`, `bottom-center`, `center-left` and `center-right`. Panels keep working with `pointer-events` on, so they can hold forms and buttons.',
  ),
  render: () => html`
    <xy-flow
      .nodes=${once(() => [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'Panels around me' } }] as Node[])}
      fit-view
    >
      <xy-background></xy-background>
      ${positions.map((p) => html`<xy-panel position=${p}><div class="sb-card sb-mono">${p}</div></xy-panel>`)}
    </xy-flow>
  `,
};

// ---- ViewportPortal ---------------------------------------------------------------------------------

export const ViewportPortal: Story = {
  args: { target: 'front' },
  argTypes: {
    target: {
      control: 'inline-radio',
      options: ['front', 'back'],
      description: 'Draw above or below the nodes.',
    },
  },
  parameters: {
    ...describe(
      '`<xy-viewport-portal>` puts content inside the scaled viewport, in flow coordinates: it pans and zooms with the nodes. `target="back"` draws behind the nodes (a zone, a grid label), `front` above them (an annotation). The layers ignore pointer events, so interactive content needs `pointer-events: all`.',
    ),
    controls: { include: ['target'] },
  },
  render: (args) => html`
    <xy-flow
      .nodes=${once(
        () =>
          [
            { id: 'a', position: { x: 60, y: 60 }, data: { label: 'Node in the zone' }, ...lr },
            { id: 'b', position: { x: 380, y: 160 }, data: { label: 'Node outside' }, ...lr },
          ] as Node[],
      )}
      .edges=${once((): Edge[] => [{ id: 'ab', source: 'a', target: 'b' }])}
      fit-view
    >
      <xy-background></xy-background>
      <xy-controls></xy-controls>
      <xy-viewport-portal target="back">
        <div
          style="position:absolute;transform:translate(20px,20px);width:300px;height:150px;border:2px dashed #6366f1;border-radius:12px;background:rgba(99,102,241,.1);box-sizing:border-box;padding:8px;font:600 11px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6366f1"
        >
          zone, behind the nodes
        </div>
      </xy-viewport-portal>
      <xy-viewport-portal target=${args.target ?? 'front'}>
        <div
          style="position:absolute;transform:translate(330px,60px);padding:6px 10px;border-radius:8px;background:#fef3c7;color:#78350f;font:12px Inter,sans-serif;pointer-events:all;box-shadow:0 2px 6px rgba(0,0,0,.15)"
        >
          pinned at flow position (330, 60)
        </div>
      </xy-viewport-portal>
    </xy-flow>
  `,
};
