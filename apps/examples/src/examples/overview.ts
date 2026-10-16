// reactflow.dev "Overview": input / default / output nodes, animated and labelled edges, markers,
// minimap, controls, dots background and an event panel.
import { html } from 'lit';
import { MarkerType, Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const nodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'An input node' },
    position: { x: 0, y: 50 },
    sourcePosition: Position.Right,
  },
  {
    id: '2',
    data: { label: 'A default node' },
    position: { x: 250, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: 'background: #d1fae5; border-color: #10b981;',
  },
  {
    id: '3',
    data: { label: 'Another default node' },
    position: { x: 250, y: 120 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: 'background: #fee2e2; border-color: #ef4444;',
  },
  {
    id: '4',
    data: { label: 'A node you cannot drag' },
    position: { x: 250, y: 240 },
    draggable: false,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: '5',
    type: 'output',
    data: { label: 'An output node' },
    position: { x: 550, y: 100 },
    targetPosition: Position.Left,
  },
  {
    id: '6',
    type: 'output',
    data: { label: 'Another output node' },
    position: { x: 550, y: 220 },
    targetPosition: Position.Left,
  },
];

const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'this is an edge label' },
  { id: 'e1-3', source: '1', target: '3', animated: true },
  {
    id: 'e2-5',
    source: '2',
    target: '5',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  { id: 'e3-5', source: '3', target: '5', type: 'step' },
  { id: 'e4-6', source: '4', target: '6', type: 'straight', animated: true },
];

const nodeColors: Record<string, string> = { input: '#6ede87', output: '#6865a5' };

class OverviewExample extends ExampleElement {
  static override properties = { event: { state: true } };
  declare event: string;
  constructor() {
    super();
    this.event = 'Click, drag or connect something';
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      fit-view
      min-zoom="0.2"
      @node-click=${(e: CustomEvent) => (this.event = `node-click: ${e.detail.node.id}`)}
      @node-drag-stop=${(e: CustomEvent) => (this.event = `node-drag-stop: ${e.detail.node.id}`)}
      @connect=${(e: CustomEvent) => (this.event = `connect: ${e.detail.connection.source} to ${e.detail.connection.target}`)}
      @selection-change=${(e: CustomEvent) => (this.event = `selection: ${e.detail.nodes.length} nodes, ${e.detail.edges.length} edges`)}
    >
      <xy-minimap
        pannable
        zoomable
        .nodeColor=${(n: Node) => nodeColors[n.type ?? ''] ?? n.style?.match(/background:\s*([^;]+)/)?.[1] ?? '#e2e2e2'}
      ></xy-minimap>
      <xy-controls></xy-controls>
      <xy-background variant="dots" gap="12" size="1"></xy-background>
      <xy-panel position="top-left">
        <div class="ex-box" data-testid="overview-status">${this.event}</div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-overview', OverviewExample);
