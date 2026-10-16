// The change pipeline made visible: every drag, selection and connection arrives as typed changes.
import { html } from 'lit';
import type { Edge, EdgeChange, Node, NodeChange, XyFlowElement } from '@xy-lit/flow';
import { brief, flowOf, logLine, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 20 }, data: { label: 'Node A' } },
  { id: 'b', position: { x: 200, y: 100 }, data: { label: 'Node B' } },
  { id: 'c', type: 'output', position: { x: 20, y: 190 }, data: { label: 'Node C' } },
];
const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

const describeNode = (c: NodeChange): string => {
  switch (c.type) {
    case 'position':
      return `position ${c.id} ${c.position ? brief(c.position, 30) : ''} dragging=${c.dragging}`;
    case 'select':
      return `select ${c.id} ${c.selected}`;
    case 'dimensions':
      return `dimensions ${c.id}`;
    case 'remove':
      return `remove ${c.id}`;
    default:
      return `${c.type} ${'id' in c ? c.id : ''}`;
  }
};

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-body">
      <xy-flow
        .nodes=${nodes}
        .edges=${edges}
        fit-view
        delete-key="Backspace"
        prevent-scrolling="false"
        zoom-on-scroll="false"
      >
        <xy-background></xy-background>
      </xy-flow>
      <div class="demo-log" id="log" aria-live="off" aria-label="Change log"></div>
    </div>`,
  );
  const flow: XyFlowElement = flowOf(el);
  const log = el.querySelector<HTMLElement>('#log')!;
  logLine(log, 'ready', 'drag a node, select it, connect two handles, press Backspace');
  flow.addEventListener('nodes-change', (e) => {
    const { changes, meta } = (e as CustomEvent<{ changes: NodeChange[]; meta: { phase: string; origin: string } }>).detail;
    for (const c of changes) {
      if (c.type === 'dimensions') continue;
      logLine(log, `nodes-change ${meta.origin}/${meta.phase}`, describeNode(c));
    }
  });
  flow.addEventListener('edges-change', (e) => {
    const { changes, meta } = (e as CustomEvent<{ changes: EdgeChange[]; meta: { phase: string; origin: string } }>).detail;
    for (const c of changes) logLine(log, `edges-change ${meta.origin}/${meta.phase}`, `${c.type} ${'id' in c ? c.id : ''}`);
  });
  flow.addEventListener('connect', (e) =>
    logLine(log, 'connect', brief((e as CustomEvent).detail.connection, 70)),
  );
  return dispose;
};
