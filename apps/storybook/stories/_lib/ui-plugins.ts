/** Nodes shared by the zoom, search and devtools stories. */
import type { Edge, Node } from '@xy-lit/flow';

const names = [
  ['Ingest', 'Parse', 'Validate', 'Enrich'],
  ['Route', 'Notify', 'Archive', 'Report'],
  ['Audit', 'Score', 'Dedupe', 'Publish'],
];

/** Twelve labelled nodes in three rows, linked left to right (`rows` limits the number of rows). */
export function labelled(rows = 3): { nodes: Node[]; edges: Edge[] } {
  const shown = names.slice(0, rows);
  const nodes: Node[] = shown.flatMap((row, r) =>
    row.map((label, i) => ({
      id: `n-${r}-${i}`,
      type: 'small',
      position: { x: i * 210, y: r * 110 + (i % 2) * 28 },
      data: { label },
    })),
  );
  const edges: Edge[] = shown.flatMap((row, r) =>
    row.slice(1).map((_, i) => ({
      id: `e-${r}-${i}`,
      source: `n-${r}-${i}`,
      target: `n-${r}-${i + 1}`,
      type: 'smoothstep',
    })),
  );
  return { nodes, edges };
}
