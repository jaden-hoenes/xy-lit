// Port of the Svelte Flow example `routes/examples/color-mode` (spec/13 §Fixture pages).
import '@xy-lit/flow/define.js';
import { Position } from '@xy-lit/flow';
import type { ColorMode, Edge, Node, XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';

const nodeDefaults = { sourcePosition: Position.Right, targetPosition: Position.Left };

const nodes: Node[] = [
  { id: 'A', position: { x: 0, y: 150 }, data: { label: 'A' }, ...nodeDefaults },
  { id: 'B', position: { x: 250, y: 0 }, data: { label: 'B' }, ...nodeDefaults },
  { id: 'C', position: { x: 250, y: 150 }, data: { label: 'C' }, ...nodeDefaults },
  { id: 'D', position: { x: 250, y: 300 }, data: { label: 'D' }, ...nodeDefaults },
];

const edges: Edge[] = [
  { id: 'A-B', source: 'A', target: 'B' },
  { id: 'A-C', source: 'A', target: 'C' },
  { id: 'A-D', source: 'A', target: 'D' },
];

const mount: Mount = (root) => {
  const flow = document.createElement('xy-flow') as XyFlowElement;
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  flow.nodes = nodes;
  flow.edges = edges;
  flow.setAttribute('fit-view', '');

  const controls = document.createElement('xy-controls');
  const background = document.createElement('xy-background');
  background.setAttribute('variant', 'dots');
  const minimap = document.createElement('xy-minimap');

  const panel = document.createElement('xy-panel');
  const select = document.createElement('select');
  select.dataset.testid = 'colormode-select';
  select.setAttribute('aria-label', 'Color mode');
  for (const mode of ['light', 'dark', 'system'] as const) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode;
    select.append(option);
  }
  select.addEventListener('change', () => {
    flow.colorMode = select.value as ColorMode;
  });
  panel.append(select);

  flow.append(controls, background, minimap, panel);
  root.replaceChildren(flow);
  Object.assign(window, { flow });
};
export default mount;
