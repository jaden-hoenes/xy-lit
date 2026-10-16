import { MarkerType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';

/** Note and idea colours: a soft tint and a strong accent each. */
export const SWATCHES = [
  { id: 'indigo', accent: '#6366f1', tint: '#eef2ff', dark: '#312e81' },
  { id: 'rose', accent: '#f43f5e', tint: '#fff1f2', dark: '#881337' },
  { id: 'amber', accent: '#f59e0b', tint: '#fffbeb', dark: '#78350f' },
  { id: 'emerald', accent: '#10b981', tint: '#ecfdf5', dark: '#064e3b' },
  { id: 'sky', accent: '#0ea5e9', tint: '#f0f9ff', dark: '#0c4a6e' },
  { id: 'violet', accent: '#8b5cf6', tint: '#f5f3ff', dark: '#4c1d95' },
] as const;
export type SwatchId = (typeof SWATCHES)[number]['id'];

const arrow = { type: MarkerType.ArrowClosed, width: 18, height: 18 };

/** The graph a new room starts with. Fixed ids keep two clients that seed at once from duplicating it. */
export function seedGraph(author: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'seed-launch',
      type: 'idea',
      position: { x: 0, y: 0 },
      data: { label: 'Launch plan', emoji: '🚀', color: 'indigo' },
    },
    {
      id: 'seed-design',
      type: 'idea',
      position: { x: -340, y: -150 },
      data: { label: 'Design', emoji: '🎨', color: 'rose' },
    },
    {
      id: 'seed-eng',
      type: 'idea',
      position: { x: -340, y: 70 },
      data: { label: 'Engineering', emoji: '🛠️', color: 'sky' },
    },
    {
      id: 'seed-marketing',
      type: 'idea',
      position: { x: 340, y: -150 },
      data: { label: 'Marketing', emoji: '📣', color: 'amber' },
    },
    {
      id: 'seed-docs',
      type: 'idea',
      position: { x: 340, y: 70 },
      data: { label: 'Docs', emoji: '📚', color: 'emerald' },
    },
    {
      id: 'seed-note',
      type: 'note',
      position: { x: -110, y: 190 },
      data: {
        title: 'Try it',
        color: 'violet',
        body: `Hi, ${author} started this room.\n\nOpen this URL in a second window, then drag nodes, connect handles and type in here: everyone sees it live.\n\nRight-click the canvas to add more.`,
      },
    },
  ];
  const edges: Edge[] = [
    {
      id: 'seed-e1',
      source: 'seed-launch',
      target: 'seed-design',
      sourceHandle: 'l',
      targetHandle: 'r',
      markerEnd: arrow,
    },
    {
      id: 'seed-e2',
      source: 'seed-launch',
      target: 'seed-eng',
      sourceHandle: 'l',
      targetHandle: 'r',
      markerEnd: arrow,
    },
    {
      id: 'seed-e3',
      source: 'seed-launch',
      target: 'seed-marketing',
      sourceHandle: 'r',
      targetHandle: 'l',
      markerEnd: arrow,
    },
    {
      id: 'seed-e4',
      source: 'seed-launch',
      target: 'seed-docs',
      sourceHandle: 'r',
      targetHandle: 'l',
      markerEnd: arrow,
    },
  ];
  return { nodes, edges };
}
