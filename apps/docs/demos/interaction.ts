// The interaction switches of <xy-flow>, live.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { flowOf, mountTemplate, toggleBar, type Mount } from './_shared';

const nodes: Node[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  position: { x: (i % 4) * 190, y: Math.floor(i / 4) * 90 },
  data: { label: `Node ${i}` },
}));
const edges: Edge[] = [
  { id: 'e0', source: '0', target: '5' },
  { id: 'e1', source: '1', target: '6' },
  { id: 'e2', source: '4', target: '9' },
];

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<xy-flow
      .nodes=${nodes}
      .edges=${edges}
      fit-view
      zoom-on-scroll="false"
      prevent-scrolling="false"
      delete-key="Backspace"
    >
      <xy-background></xy-background>
      <xy-controls></xy-controls>
    </xy-flow>`,
  );
  const flow = flowOf(el);
  const bar = toggleBar(flow, [
    { label: 'selection-on-drag', prop: 'selectionOnDrag', value: false },
    { label: 'pan-on-scroll', prop: 'panOnScroll', value: false },
    { label: 'zoom-on-scroll', prop: 'zoomOnScroll', value: false },
    { label: 'snap-to-grid', prop: 'snapToGrid', value: false },
    { label: 'nodes-draggable', prop: 'nodesDraggable', value: true },
    { label: 'zoom-on-double-click', prop: 'zoomOnDoubleClick', value: true },
  ]);
  // prevent-scrolling stays off so the docs page can scroll past the demo; turning on a
  // wheel gesture needs it on while the pointer is over the flow
  bar.querySelectorAll('input').forEach((input) =>
    input.addEventListener('change', () => {
      flow.preventScrolling = flow.panOnScroll || flow.zoomOnScroll;
    }),
  );
  el.prepend(bar);
  return dispose;
};
