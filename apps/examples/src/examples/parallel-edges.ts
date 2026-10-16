// Demo: parallel edges (`parallel-edges="spread"`), start/end labels and a custom marker.
import '@xy-lit/flow/define.js';
import { MarkerType, Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const sides = { sourcePosition: Position.Right, targetPosition: Position.Left };
const diamond = {
  type: 'custom' as const,
  path: 'M-5,0 L0,-5 L5,0 L0,5 Z',
  color: '#e11d48',
  fill: '#fecdd3',
  strokeWidth: 1.5,
};

const mount: Mount = (root) => {
  const nodes: Node[] = [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, ...sides },
    { id: 'b', position: { x: 350, y: 0 }, data: { label: 'B' }, ...sides },
    { id: 'c', position: { x: 0, y: 220 }, data: { label: 'C' }, ...sides },
    { id: 'd', position: { x: 350, y: 220 }, data: { label: 'D' }, ...sides },
    { id: 'e', position: { x: 0, y: 440 }, data: { label: 'E' }, ...sides },
    { id: 'f', position: { x: 350, y: 540 }, data: { label: 'F' }, ...sides },
  ];
  const edges: Edge[] = [
    {
      id: 'ab1',
      source: 'a',
      target: 'b',
      label: 'one',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'ab2',
      source: 'a',
      target: 'b',
      label: 'two',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'ab3',
      source: 'b',
      target: 'a',
      label: 'back',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    { id: 'cd1', source: 'c', target: 'd', type: 'straight', markerEnd: diamond },
    { id: 'cd2', source: 'c', target: 'd', type: 'straight', markerEnd: diamond },
    { id: 'cd3', source: 'c', target: 'd', type: 'straight', markerEnd: diamond },
    {
      id: 'ef1',
      source: 'e',
      target: 'f',
      type: 'smoothstep',
      startLabel: 'start',
      endLabel: 'end',
    },
    { id: 'ef2', source: 'e', target: 'f', type: 'step', startLabel: 'start', endLabel: 'end' },
  ];
  show(
    root,
    createFlow({ nodes, edges, attributes: { 'parallel-edges': 'spread', 'fit-view': '' } }),
  );
};
export default mount;
