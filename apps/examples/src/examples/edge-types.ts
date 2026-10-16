// reactflow.dev "Edge types": every built-in edge type, with labels, markers, animation and
// handles on different sides.
import { html } from 'lit';
import { MarkerType, Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const types = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;
const label = (type: string) => (type === 'default' ? 'bezier' : type);

const nodes: Node[] = [];
const edges: Edge[] = [];

// one row per edge type: a left-to-right pair and, further right, a top-to-bottom pair
types.forEach((type, row) => {
  const y = row * 140;
  const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
  nodes.push(
    { id: `${type}-a`, position: { x: 0, y }, data: { label: `${label(type)} source` }, ...lr },
    {
      id: `${type}-b`,
      position: { x: 300, y: y + 60 },
      data: { label: `${label(type)} target` },
      ...lr,
    },
    { id: `${type}-c`, position: { x: 560, y }, data: { label: 'source' } },
    { id: `${type}-d`, position: { x: 760, y: y + 100 }, data: { label: 'target' } },
  );
  edges.push(
    {
      id: `${type}-ab`,
      type,
      source: `${type}-a`,
      target: `${type}-b`,
      label: label(type),
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: row % 2 === 1,
    },
    {
      id: `${type}-cd`,
      type,
      source: `${type}-c`,
      target: `${type}-d`,
      startLabel: 'start',
      endLabel: 'end',
      markerStart: { type: MarkerType.Arrow },
      style: 'stroke: #6366f1; stroke-width: 2;',
    },
  );
});

class EdgeTypesExample extends ExampleElement {
  override render() {
    return html`<xy-flow .nodes=${initial(nodes)} .edges=${initial(edges)} fit-view>
      <xy-controls></xy-controls>
      <xy-minimap pannable zoomable></xy-minimap>
      <xy-background></xy-background>
    </xy-flow>`;
  }
}

export default mountExample('ex-edge-types', EdgeTypesExample);
