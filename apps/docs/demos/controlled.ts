// Controlled mode: the app keeps the arrays, the flow only reports changes.
import { html } from 'lit';
import { applyEdgeChanges, applyNodeChanges } from '@xy-lit/flow';
import type { Edge, EdgeChange, Node, NodeChange } from '@xy-lit/flow';
import { flowOf, logLine, mountTemplate, type Mount } from './_shared';

let nextId = 4;

export const mount: Mount = (el) => {
  let nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Mine' } },
    { id: '2', position: { x: 200, y: 80 }, data: { label: 'Mine too' } },
    { id: '3', type: 'output', position: { x: 20, y: 170 }, data: { label: 'Mine as well' } },
  ];
  let edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];
  let lockPositions = false;

  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <label
          ><input type="checkbox" id="lock" /> Veto position changes (app state wins)</label
        >
        <button id="add" type="button">Add node</button>
        <span class="spacer"></span>
        <span id="state" aria-live="polite"></span>
      </div>
      <div class="demo-body">
        <xy-flow
          fit-view
          delete-key="Backspace"
          prevent-scrolling="false"
          zoom-on-scroll="false"
        >
          <xy-background></xy-background>
        </xy-flow>
        <div class="demo-log" id="log" aria-label="Change log"></div>
      </div>`,
  );
  const flow = flowOf(el);
  const log = el.querySelector<HTMLElement>('#log')!;
  const state = el.querySelector<HTMLElement>('#state')!;
  const showState = (): void => {
    state.textContent = `app state: ${nodes.length} nodes, ${edges.length} edges`;
  };
  flow.nodes = nodes;
  flow.edges = edges;
  showState();

  flow.addEventListener('nodes-change', (e) => {
    e.preventDefault(); // take over: nothing is applied unless we apply it
    let { changes } = (e as CustomEvent<{ changes: NodeChange[] }>).detail;
    if (lockPositions) {
      const vetoed = changes.filter((c) => c.type === 'position').length;
      if (vetoed) logLine(log, 'vetoed', `${vetoed} position change(s)`);
      changes = changes.filter((c) => c.type !== 'position');
    }
    // measurements (`dimensions`) must be applied too, or nodes never become visible
    nodes = applyNodeChanges(changes, nodes);
    flow.nodes = nodes;
    showState();
  });
  flow.addEventListener('edges-change', (e) => {
    e.preventDefault();
    const { changes } = (e as CustomEvent<{ changes: EdgeChange[] }>).detail;
    edges = applyEdgeChanges(changes, edges);
    flow.edges = edges;
    for (const c of changes) logLine(log, 'edges-change', c.type);
    showState();
  });
  el.querySelector('#lock')!.addEventListener('change', (e) => {
    lockPositions = (e.target as HTMLInputElement).checked;
  });
  el.querySelector('#add')!.addEventListener('click', () => {
    const id = String(nextId++);
    nodes = [...nodes, { id, position: { x: 40 + (nextId % 5) * 40, y: 40 + (nextId % 4) * 30 }, data: { label: `Node ${id}` } }];
    flow.nodes = nodes; // assigning hands the flow the new array; no change event comes back
    logLine(log, 'app', `added node ${id}`);
    showState();
  });
  return dispose;
};
