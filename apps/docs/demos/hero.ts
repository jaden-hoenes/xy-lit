// The home page demo: the architecture of XY Lit drawn with XY Lit.
import { css, html } from 'lit';
import { defineNodeType, Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { mountTemplate, type Mount } from './_shared';

type CardData = { title: string; sub: string; tone: 'indigo' | 'sky' | 'emerald' | 'amber' };

const card = defineNodeType<Node<CardData>>({
  styles: css`
    .hero-card {
      min-width: 170px;
      padding: 10px 14px 10px 12px;
      border: 1px solid var(--demo-node-border);
      border-left: 4px solid var(--tone);
      border-radius: 10px;
      background: var(--demo-node-bg);
      color: var(--demo-node-fg);
      font-family: var(--vp-font-family-base, system-ui, sans-serif);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 6px 16px -8px rgb(79 70 229 / 0.35);
      transition: box-shadow 0.15s;
    }
    .selected .hero-card {
      box-shadow: 0 0 0 2px var(--tone), 0 8px 20px -8px rgb(79 70 229 / 0.5);
    }
    .hero-card b {
      display: block;
      font-size: 13px;
      font-weight: 650;
    }
    .hero-card span {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      opacity: 0.7;
    }
    .hero-card .lit-flow__handle {
      width: 8px;
      height: 8px;
      background: var(--tone);
      border: 2px solid var(--demo-node-bg);
    }
  `,
  render: ({ data, selected }) => {
    const tone = { indigo: '#6366f1', sky: '#0ea5e9', emerald: '#10b981', amber: '#f59e0b' }[
      data.tone
    ];
    return html`<div class=${selected ? 'selected' : ''}>
      <div class="hero-card" style="--tone: ${tone}">
        <xy-handle type="target" position="left"></xy-handle>
        <b>${data.title}</b><span>${data.sub}</span>
        <xy-handle type="source" position="right"></xy-handle>
      </div>
    </div>`;
  },
});

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const n = (id: string, x: number, y: number, data: CardData): Node => ({
  id,
  type: 'card',
  position: { x, y },
  data,
  ...lr,
});

const nodes: Node[] = [
  n('ui', 0, 0, { title: 'UI components', sub: '@xy-lit/ui', tone: 'amber' }),
  n('app', 0, 110, { title: 'Your app', sub: 'any framework or none', tone: 'amber' }),
  n('pro', 0, 220, { title: 'Pro features', sub: 'history, layout, clipboard', tone: 'amber' }),
  n('flow', 260, 110, { title: '<xy-flow>', sub: '@xy-lit/flow', tone: 'indigo' }),
  n('store', 520, 110, { title: 'FlowStore', sub: '@xy-lit/store', tone: 'sky' }),
  n('array', 790, 20, { title: 'ArraySource', sub: 'uncontrolled or controlled', tone: 'emerald' }),
  n('yjs', 790, 200, { title: 'YjsFlowSource', sub: '@xy-lit/collab-yjs', tone: 'emerald' }),
  n('server', 1060, 200, { title: 'Collab server', sub: 'Hocuspocus + repair', tone: 'sky' }),
];
const e = (id: string, source: string, target: string, animated = false): Edge => ({
  id,
  source,
  target,
  animated,
  type: 'smoothstep',
});
const edges: Edge[] = [
  e('a-f', 'app', 'flow'),
  e('f-s', 'flow', 'store', true),
  e('s-arr', 'store', 'array'),
  e('s-yjs', 'store', 'yjs', true),
  e('yjs-srv', 'yjs', 'server', true),
  e('pro-f', 'pro', 'flow'),
  e('ui-f', 'ui', 'flow'),
];

export const mount: Mount = (el) =>
  mountTemplate(
    el,
    html`<xy-flow
      .nodes=${nodes}
      .edges=${edges}
      .nodeTypes=${{ card }}
      fit-view
      motion="enter"
      prevent-scrolling="false"
      zoom-on-scroll="false"
      hide-attribution
      .fitViewOptions=${{ padding: 0.06 }}
    >
      <xy-background variant="dots" gap="22" size="1.4"></xy-background>
      <xy-controls position="bottom-right" show-interactive="false"></xy-controls>
    </xy-flow>`,
  );
