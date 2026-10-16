// Port of React Flow's `examples/react/src/examples/Backgrounds` (spec/13 §Fixture pages).
// Four flows (`flow-a` .. `flow-d`) with `<xy-background>`s; `conformance/background.spec.ts` reads
// the pattern ids and transforms.
import '@xy-lit/flow/define.js';
import type { Node, XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';

type BackgroundProps = {
  variant: 'dots' | 'lines' | 'cross';
  gap?: string;
  offset?: string;
  color?: string;
};

const nodes: Node[] = [{ id: '1', data: { label: 'Node 1' }, position: { x: 50, y: 50 } }];

const flows: { id: string; backgrounds: BackgroundProps[] }[] = [
  { id: 'flow-a', backgrounds: [{ variant: 'dots' }] },
  { id: 'flow-b', backgrounds: [{ variant: 'lines', gap: '50 50' }] },
  { id: 'flow-c', backgrounds: [{ variant: 'cross', gap: '100 50' }] },
  {
    id: 'flow-d',
    backgrounds: [
      { variant: 'lines', gap: '10' },
      { variant: 'lines', gap: '100', offset: '2', color: '#ccc' },
    ],
  },
];

const mount: Mount = (root) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'display:grid;grid-template-columns:50vw 50vw;grid-template-rows:50vh 50vh;width:100vw;height:100vh';
  for (const { id, backgrounds } of flows) {
    const provider = document.createElement('xy-flow-provider');
    const flow = document.createElement('xy-flow') as XyFlowElement;
    flow.setAttribute('id', id);
    flow.style.cssText = 'display:block;width:50vw;height:50vh';
    flow.nodes = nodes;
    backgrounds.forEach((props, index) => {
      const bg = document.createElement('xy-background');
      bg.setAttribute('bg-id', String(index));
      bg.setAttribute('variant', props.variant);
      if (props.gap) bg.setAttribute('gap', props.gap);
      if (props.offset) bg.setAttribute('offset', props.offset);
      if (props.color) bg.setAttribute('color', props.color);
      flow.append(bg);
    });
    provider.append(flow);
    wrapper.append(provider);
  }
  root.replaceChildren(wrapper);
};
export default mount;
