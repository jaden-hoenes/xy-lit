// reactflow.dev "Floating edges": edges attach to the border of a node where the line between the
// two centres crosses it, so they never end at a fixed handle. New connections are floating too.
import { html } from 'lit';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';
import { floatingConnectionLine, floatingEdge, floatingEdgeOptions } from '../lib/floating';

const ring = ['a', 'b', 'c', 'd', 'e', 'f'];
const nodes: Node[] = [
  { id: 'center', position: { x: 0, y: 0 }, data: { label: 'Center' } },
  ...ring.map((id, i) => {
    const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id,
      position: { x: Math.cos(angle) * 320, y: Math.sin(angle) * 220 },
      data: { label: `Node ${id.toUpperCase()}` },
    };
  }),
];
const edges: Edge[] = [
  ...ring.map((id) => ({ id: `center-${id}`, source: 'center', target: id })),
  { id: 'a-c', source: 'a', target: 'c' },
  { id: 'd-f', source: 'd', target: 'f' },
].map((e) => ({ ...e, ...floatingEdgeOptions }));

class FloatingEdgesExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .edgeTypes=${{ floating: floatingEdge }}
      .defaultEdgeOptions=${floatingEdgeOptions}
      .connectionLineRenderer=${floatingConnectionLine}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Drag a node around: the edges follow its border.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-floating-edges', FloatingEdgesExample);
