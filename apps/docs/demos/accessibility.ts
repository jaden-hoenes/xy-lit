// Keyboard use and announcements: the flow's live region, mirrored next to it.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { flowOf, logLine, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'First' }, ariaLabel: 'First node: start of the flow' },
  { id: 'b', position: { x: 200, y: 90 }, data: { label: 'Second' } },
  { id: 'c', type: 'output', position: { x: 0, y: 170 }, data: { label: 'Third' } },
];
const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }, { id: 'b-c', source: 'b', target: 'c' }];

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-body">
      <xy-flow .nodes=${nodes} .edges=${edges} fit-view prevent-scrolling="false" zoom-on-scroll="false"
        .ariaLabelConfig=${{
          'controls.ariaLabel': 'Flow controls',
          'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
            `Node moved ${direction} to ${x}, ${y}`,
        }}
      >
        <xy-background></xy-background>
        <xy-controls></xy-controls>
      </xy-flow>
      <div class="demo-log" id="log" aria-hidden="true"></div>
    </div>`,
  );
  const flow = flowOf(el);
  const log = el.querySelector<HTMLElement>('#log')!;
  logLine(log, 'screen reader says', 'Tab into the flow, Tab to a node, press Enter, then use the arrow keys.');
  let obs: MutationObserver | undefined;
  void flow.whenRendered().then(() => {
    const live = flow.shadowRoot?.querySelector('.lit-flow__a11y-live');
    if (!live) return;
    let last = '';
    obs = new MutationObserver(() => {
      const text = live.textContent?.trim() ?? '';
      if (text && text !== last) {
        last = text;
        logLine(log, 'announced', text);
      }
    });
    obs.observe(live, { childList: true, characterData: true, subtree: true });
  });
  return () => {
    obs?.disconnect();
    dispose();
  };
};
