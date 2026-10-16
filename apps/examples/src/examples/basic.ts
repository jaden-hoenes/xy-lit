import '@xy-lit/flow/define.js';
import { MarkerType, Position } from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';

const nodes: Node[] = [
  { id: 'in', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Input' } },
  { id: 'a', position: { x: 220, y: 0 }, data: { label: 'Node A' } },
  { id: 'b', position: { x: 220, y: 100 }, data: { label: 'Node B' } },
  { id: 'c', position: { x: 220, y: 200 }, data: { label: 'Node C' } },
  {
    id: 'd',
    position: { x: 440, y: 50 },
    data: { label: 'Node D (left/right handles)' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  { id: 'e', position: { x: 440, y: 180 }, data: { label: 'Node E' } },
  { id: 'out', type: 'output', position: { x: 660, y: 100 }, data: { label: 'Output' } },
  {
    id: 'styled',
    position: { x: 660, y: 220 },
    data: { label: 'Styled' },
    style: 'background: #fef3c7; border-color: #f59e0b;',
    class: 'custom-class',
  },
];

const edges: Edge[] = [
  {
    id: 'in-a',
    source: 'in',
    target: 'a',
    label: 'bezier',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'in-b',
    source: 'in',
    target: 'b',
    type: 'straight',
    markerEnd: { type: MarkerType.Arrow },
  },
  { id: 'in-c', source: 'in', target: 'c', type: 'step', animated: true },
  { id: 'a-d', source: 'a', target: 'd', type: 'smoothstep', label: 'smoothstep' },
  {
    id: 'b-e',
    source: 'b',
    target: 'e',
    type: 'simplebezier',
    startLabel: 'start',
    endLabel: 'end',
  },
  {
    id: 'd-out',
    source: 'd',
    target: 'out',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#e11d48' },
  },
  { id: 'e-out', source: 'e', target: 'out', style: 'stroke: #3b82f6; stroke-width: 2;' },
];

const mount: Mount = (root) => {
  root.replaceChildren();
  const flow = document.createElement('xy-flow') as XyFlowElement;
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  flow.nodes = nodes;
  flow.edges = edges;
  flow.setAttribute('fit-view', '');
  root.append(flow);
  Object.assign(window, { flow });
};
export default mount;
