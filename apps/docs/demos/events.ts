// React Flow callbacks are events here: interact with the flow and see which one fires, with its detail.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { brief, flowOf, logLine, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'b', position: { x: 190, y: 90 }, data: { label: 'B' } },
  { id: 'c', type: 'output', position: { x: 0, y: 170 }, data: { label: 'C' } },
];
const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

/** event name -> the React Flow prop it replaces */
const EVENTS: Record<string, string> = {
  'node-click': 'onNodeClick',
  'node-double-click': 'onNodeDoubleClick',
  'node-context-menu': 'onNodeContextMenu',
  'node-drag-start': 'onNodeDragStart',
  'node-drag-stop': 'onNodeDragStop',
  'edge-click': 'onEdgeClick',
  'pane-click': 'onPaneClick',
  'pane-context-menu': 'onPaneContextMenu',
  'selection-change': 'onSelectionChange',
  'connect-start': 'onConnectStart',
  connect: 'onConnect',
  'connect-end': 'onConnectEnd',
  'move-end': 'onMoveEnd',
  delete: 'onDelete',
};

const summarize = (name: string, detail: Record<string, unknown>): string => {
  if (name.startsWith('node-') && detail.node) return `node ${(detail.node as Node).id}`;
  if (name === 'edge-click') return `edge ${(detail.edge as Edge).id}`;
  if (name === 'selection-change') return `${(detail.nodes as Node[]).length} nodes, ${(detail.edges as Edge[]).length} edges`;
  if (name === 'connect') return brief(detail.connection, 60);
  if (name === 'move-end') return brief(detail.viewport, 60);
  if (name === 'delete') return `${(detail.nodes as Node[]).length} nodes, ${(detail.edges as Edge[]).length} edges`;
  return '';
};

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-body">
      <xy-flow .nodes=${nodes} .edges=${edges} fit-view delete-key="Backspace" prevent-scrolling="false" zoom-on-scroll="false">
        <xy-background></xy-background>
      </xy-flow>
      <div class="demo-log" id="log" style="width: 280px" aria-label="Events"></div>
    </div>`,
  );
  const flow = flowOf(el);
  const log = el.querySelector<HTMLElement>('#log')!;
  logLine(log, 'try', 'click, double-click, right-click, drag, connect, delete');
  for (const [name, prop] of Object.entries(EVENTS)) {
    flow.addEventListener(name, (e) =>
      logLine(log, name, `(${prop}) ${summarize(name, (e as CustomEvent).detail ?? {})}`),
    );
  }
  return dispose;
};
