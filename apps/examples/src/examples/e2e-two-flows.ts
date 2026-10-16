// e2e page for tests/e2e/lit/two-flows.spec.ts: two flows with the same default id and the same
// marker ids, side by side.
import type { Edge, Node } from '@xy-lit/flow';
import { MarkerType } from '@xy-lit/flow';
import type { XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow } from '../lib/e2e';

const nodes = (prefix: string): Node[] => [
  { id: `${prefix}1`, position: { x: 40, y: 40 }, data: { label: `${prefix} one` } },
  { id: `${prefix}2`, position: { x: 40, y: 200 }, data: { label: `${prefix} two` } },
];
const edges = (prefix: string): Edge[] => [
  {
    id: `${prefix}-e`,
    source: `${prefix}1`,
    target: `${prefix}2`,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

const mount: Mount = (root) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;width:100vw;height:100vh';
  const make = (prefix: string): XyFlowElement => {
    const flow = createFlow({
      nodes: nodes(prefix),
      edges: edges(prefix),
      attributes: { 'delete-key': 'Delete' },
      style: 'display:block;width:50vw;height:100vh',
    });
    flow.dataset.testid = `flow-${prefix}`;
    return flow;
  };
  const left = make('l');
  const right = make('r');
  wrapper.append(left, right);
  root.replaceChildren(wrapper);
  Object.assign(window, { left, right });
};
export default mount;
