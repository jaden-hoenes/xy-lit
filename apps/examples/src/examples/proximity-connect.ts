// reactflow.dev "Proximity connect": drag a node close to another one and a dashed preview edge
// appears; drop it there and the edge is kept. The preview is a normal edge with the `temp` class.
import { html } from 'lit';
import type { Edge, FlowEventMap, Node, XyFlowElement } from '@xy-lit/flow';
import { ExampleElement, adoptCss, initial, mountExample } from '../lib/demo';

const MIN_DISTANCE = 150;

const nodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: '2', position: { x: 300, y: 60 }, data: { label: 'Node 2' } },
  { id: '3', position: { x: 0, y: 200 }, data: { label: 'Node 3' } },
  { id: '4', position: { x: 380, y: 260 }, data: { label: 'Node 4' } },
];

const css = `
  .lit-flow__edge.temp .lit-flow__edge-path { stroke: #6366f1; stroke-dasharray: 6 4; }
`;

/** The nearest other node closer than `MIN_DISTANCE`, as the edge that would connect it. */
function closestEdge(flow: XyFlowElement, dragged: Node): Edge | null {
  const me = flow.getInternalNode(dragged.id);
  if (!me) return null;
  let closest: { id: string; x: number; distance: number } | null = null;
  for (const node of flow.getNodes()) {
    if (node.id === dragged.id) continue;
    const other = flow.getInternalNode(node.id);
    if (!other) continue;
    const dx = other.internals.positionAbsolute.x - me.internals.positionAbsolute.x;
    const dy = other.internals.positionAbsolute.y - me.internals.positionAbsolute.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_DISTANCE && (!closest || distance < closest.distance)) {
      closest = { id: node.id, x: other.internals.positionAbsolute.x, distance };
    }
  }
  if (!closest) return null;
  // the left node is the source, so edges always run left to right
  const closestIsSource = closest.x < me.internals.positionAbsolute.x;
  return {
    id: closestIsSource ? `${closest.id}-${dragged.id}` : `${dragged.id}-${closest.id}`,
    source: closestIsSource ? closest.id : dragged.id,
    target: closestIsSource ? dragged.id : closest.id,
  };
}

class ProximityConnectExample extends ExampleElement {
  #onDrag = (e: CustomEvent<FlowEventMap['node-drag']>): void => {
    const flow = this.flow;
    const edge = closestEdge(flow, e.detail.node);
    flow.setEdges((edges) => {
      const rest = edges.filter((x) => x.class !== 'temp');
      const exists = edge && rest.some((x) => x.source === edge.source && x.target === edge.target);
      return edge && !exists ? [...rest, { ...edge, class: 'temp' }] : rest;
    });
  };

  #onDragStop = (e: CustomEvent<FlowEventMap['node-drag-stop']>): void => {
    const flow = this.flow;
    const edge = closestEdge(flow, e.detail.node);
    flow.setEdges((edges) => {
      const rest = edges.filter((x) => x.class !== 'temp');
      const exists = edge && rest.some((x) => x.source === edge.source && x.target === edge.target);
      return edge && !exists ? [...rest, edge] : rest;
    });
  };

  override firstUpdated(): void {
    super.firstUpdated();
    adoptCss(this.flow, css);
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      fit-view
      @node-drag=${this.#onDrag}
      @node-drag-stop=${this.#onDragStop}
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Drag a node within ${MIN_DISTANCE}px of another one.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-proximity-connect', ProximityConnectExample);
