// The first flow of the getting-started guide: the snippet on the page, running.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
  { id: '2', position: { x: 180, y: 110 }, data: { label: 'World' } },
  { id: '3', type: 'output', position: { x: 0, y: 220 }, data: { label: 'Drag me' } },
];
const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
];

export const mount: Mount = (el) =>
  mountTemplate(
    el,
    html`<xy-flow
      .nodes=${nodes}
      .edges=${edges}
      fit-view
      prevent-scrolling="false"
      zoom-on-scroll="false"
    >
      <xy-background></xy-background>
      <xy-controls></xy-controls>
      <xy-minimap pannable zoomable></xy-minimap>
    </xy-flow>`,
  );
