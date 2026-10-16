// Testing a flow: whenRendered() and the instance API, as a test would use them.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { brief, flowOf, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'b', type: 'output', position: { x: 200, y: 100 }, data: { label: 'B' } },
];
const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <button type="button" id="check">await flow.whenRendered()</button>
        <button type="button" id="add">flow.addNodes(...)</button>
        <button type="button" id="dom">query the DOM</button>
      </div>
      <div class="demo-body">
        <xy-flow .nodes=${nodes} .edges=${edges} fit-view id="subject" prevent-scrolling="false" zoom-on-scroll="false">
          <xy-background></xy-background>
        </xy-flow>
        <div class="demo-log" id="out" style="width: 300px" aria-label="Result"></div>
      </div>`,
  );
  const flow = flowOf(el);
  const out = el.querySelector<HTMLElement>('#out')!;
  const show = (code: string, value: unknown): void => {
    out.textContent = `${code}\n\n${typeof value === 'string' ? value : brief(value, 400)}`;
  };
  el.querySelector('#check')!.addEventListener('click', async () => show('await flow.whenRendered()', await flow.whenRendered()));
  el.querySelector('#add')!.addEventListener('click', async () => {
    flow.addNodes({ id: `n${flow.getNodes().length}`, data: { label: 'new' } });
    const detail = await flow.whenRendered();
    show('flow.addNodes(...); await flow.whenRendered()', { ...detail, ids: flow.getNodes().map((n) => n.id) });
  });
  el.querySelector('#dom')!.addEventListener('click', () => {
    const nodeEls = flow.shadowRoot!.querySelectorAll('.lit-flow__node');
    show(`flow.shadowRoot.querySelectorAll('.lit-flow__node')`, `${nodeEls.length} elements, ids: ${[...nodeEls].map((n) => n.getAttribute('data-id')).join(', ')}`);
  });
  return dispose;
};
