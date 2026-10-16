// @xy-lit/ui: node card with status ring and tooltip, schema, shape and placeholder nodes, the
// button and data edges, zoom slider and node search.
import { css, html } from 'lit';
import { Position, defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { nodeTooltip, statusIndicator, uiEdgeTypes, uiNodeTypes, uiStyles } from '@xy-lit/ui';
import type { NodeStatus } from '@xy-lit/ui';
import { mountTemplate, type Mount } from './_shared';

type JobData = { title: string; status: NodeStatus };

const job = defineNodeType<Node<JobData>>({
  styles: [
    uiStyles,
    css`
      .doc-job-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 11px;
      }
      .doc-job-foot button {
        padding: 1px 9px;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
    `,
  ],
  render: ({ id, data, selected }, flow) =>
    statusIndicator(
      data.status,
      html`<xy-base-node class="xy-ui-node" ?selected=${selected} style="--xy-base-node-min-width: 160px">
        ${nodeTooltip({ position: 'top' }, `Status: ${data.status}`)}
        <div slot="header">${data.title}</div>
        <div slot="footer" class="doc-job-foot">
          <span>${data.status}</span>
          <button class="nodrag" type="button" ?disabled=${data.status === 'loading'}
            @click=${() => {
              flow.updateNodeData(id, { status: 'loading' });
              setTimeout(() => flow.updateNodeData(id, { status: 'success' }), 1500);
            }}>Run</button>
        </div>
        <xy-handle type="target" position="left"></xy-handle>
        <xy-handle type="source" position="right"></xy-handle>
      </xy-base-node>`,
    ),
});

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const nodes: Node[] = [
  { id: 'job-1', type: 'job', position: { x: 0, y: 0 }, data: { title: 'Fetch', status: 'success' }, ...lr },
  { id: 'job-2', type: 'job', position: { x: 0, y: 130 }, data: { title: 'Transform', status: 'initial' }, ...lr },
  {
    id: 'users',
    type: 'databaseSchema',
    position: { x: 290, y: -20 },
    data: {
      label: 'users',
      schema: [
        { title: 'id', type: 'uuid', key: 'PK' },
        { title: 'email', type: 'text' },
        { title: 'team_id', type: 'uuid', key: 'FK' },
      ],
    },
  },
  { id: 'decide', type: 'shape', position: { x: 300, y: 170 }, width: 120, height: 80, data: { shape: 'diamond', label: 'Valid?', color: '#6366f1' } },
  { id: 'more', type: 'placeholder', position: { x: 520, y: 170 }, width: 110, height: 80, data: { label: 'Add step' } },
];
const edges: Edge[] = [
  { id: 'j1-j2', source: 'job-1', target: 'job-2', type: 'button', data: { pathType: 'smoothstep' } },
  { id: 'j2-d', source: 'job-2', target: 'decide', type: 'animatedSvg', data: { pathType: 'bezier' } },
];

export const mount: Mount = (el) =>
  mountTemplate(
    el,
    html`<xy-flow
      .nodes=${nodes}
      .edges=${edges}
      .nodeTypes=${{ job, ...uiNodeTypes }}
      .edgeTypes=${{ ...uiEdgeTypes }}
      fit-view
      prevent-scrolling="false"
      zoom-on-scroll="false"
    >
      <xy-background></xy-background>
      <xy-zoom-slider position="bottom-left"></xy-zoom-slider>
      <xy-node-search position="top-left"></xy-node-search>
    </xy-flow>`,
  );
