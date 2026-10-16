// Sub-flows: children positioned relative to a parent, confined to it, or growing it.
import { html } from 'lit';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
import { flowOf, mountTemplate, type Mount } from './_shared';

const nodes: Node[] = [
  { id: 'outside', position: { x: 0, y: 40 }, data: { label: 'Outside' }, ...lr },
  {
    id: 'g1',
    type: 'group',
    position: { x: 200, y: 0 },
    width: 360,
    height: 190,
    data: {},
    style: 'background: rgba(99, 102, 241, 0.12); border-color: #6366f1',
  },
  { id: 'confined', parentId: 'g1', extent: 'parent', position: { x: 20, y: 30 }, data: { label: 'extent: parent' }, ...lr },
  { id: 'grows', parentId: 'g1', expandParent: true, position: { x: 20, y: 110 }, data: { label: 'expandParent' }, ...lr },
  { id: 'free', parentId: 'g1', position: { x: 190, y: 110 }, data: { label: 'free child' }, ...lr },
];
const edges: Edge[] = [{ id: 'o-c', source: 'outside', target: 'confined' }];

export const mount: Mount = (el) => {
  let n = 0;
  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <button id="add" type="button">Add a child to the group</button>
        <span class="spacer"></span>
        <span>Drag the children towards the edge of the group, or drag the whole group.</span>
      </div>
      <xy-flow .nodes=${nodes} .edges=${edges} fit-view prevent-scrolling="false" zoom-on-scroll="false">
        <xy-background></xy-background>
      </xy-flow>`,
  );
  const flow = flowOf(el);
  el.querySelector('#add')!.addEventListener('click', () => {
    n++;
    flow.addNodes({ id: `extra-${n}`, parentId: 'g1', extent: 'parent', position: { x: 10 + n * 14, y: 150 - n * 6 }, data: { label: `child ${n}` }, ...lr });
  });
  return dispose;
};
