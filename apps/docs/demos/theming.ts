// Theming: colour mode, CSS custom properties, ::part() and adoptStyles on one flow.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { flowOf, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Input' } },
  { id: 'b', position: { x: 200, y: 90 }, data: { label: 'Default' } },
  { id: 'c', type: 'output', position: { x: 0, y: 170 }, data: { label: 'Output' } },
];
const edges: Edge[] = [
  { id: 'a-b', source: 'a', target: 'b', label: 'label' },
  { id: 'b-c', source: 'b', target: 'c', animated: true },
];

const STYLE_ID = 'docs-theming-style';

export const mount: Mount = (el) => {
  // `::part()` styles are page CSS: they reach the parts the flow exposes (the node box, the edge)
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .docs-theming.parts xy-flow::part(node) { border-radius: 14px; border-style: dashed; }
    .docs-theming.parts xy-flow::part(handle) { width: 10px; height: 10px; }
  `;
  document.head.append(style);
  el.classList.add('docs-theming');

  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <span>Override:</span>
        <label>--xy-node-background-color <input type="color" id="bg" value="#eef2ff" /></label>
        <label>--xy-edge-stroke <input type="color" id="edge" value="#6366f1" /></label>
        <label>--xy-handle-background-color <input type="color" id="handle" value="#f59e0b" /></label>
      </div>
      <div class="demo-bar">
        <label><input type="checkbox" id="parts" /> <code>::part(node)</code> and <code>::part(handle)</code></label>
        <label><input type="checkbox" id="adopt" /> <code>adoptStyles()</code>: uppercase labels</label>
        <button type="button" id="reset">Reset variables</button>
      </div>
      <xy-flow .nodes=${nodes} .edges=${edges} fit-view prevent-scrolling="false" zoom-on-scroll="false">
        <xy-background></xy-background>
        <xy-controls show-interactive="false"></xy-controls>
      </xy-flow>`,
  );
  const flow = flowOf(el);
  const set = (name: string, value: string | null): void => {
    if (value === null) flow.style.removeProperty(name);
    else flow.style.setProperty(name, value);
  };
  const bind = (id: string, variable: string): void => {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.addEventListener('input', () => set(variable, input.value));
  };
  bind('bg', '--xy-node-background-color');
  bind('edge', '--xy-edge-stroke');
  bind('handle', '--xy-handle-background-color');
  // the colour mode of the page decides the starting point; the variables win over both modes
  el.querySelector('#parts')!.addEventListener('change', (e) =>
    el.classList.toggle('parts', (e.target as HTMLInputElement).checked),
  );
  // one constructable sheet, adopted once (adoptStyles dedupes by identity); the checkbox fills it
  const UPPER =
    '.lit-flow__node-default, .lit-flow__node-input, .lit-flow__node-output { text-transform: uppercase; letter-spacing: 0.06em; }';
  const sheet = new CSSStyleSheet();
  flow.adoptStyles(sheet);
  el.querySelector('#adopt')!.addEventListener('change', (e) => {
    sheet.replaceSync((e.target as HTMLInputElement).checked ? UPPER : '');
  });
  el.querySelector('#reset')!.addEventListener('click', () => {
    for (const v of ['--xy-node-background-color', '--xy-edge-stroke', '--xy-handle-background-color']) set(v, null);
  });
  return () => {
    style.remove();
    dispose();
  };
};
