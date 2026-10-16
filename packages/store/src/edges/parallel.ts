/** The endpoints of an edge, as far as parallel grouping is concerned. */
export type ParallelEdgeEnds = {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
};

/**
 * Perpendicular offsets that fan out edges connecting the same pair of handles (`parallel-edges="spread"`).
 *
 * Edges are grouped by the unordered pair `source:sourceHandle` / `target:targetHandle`. For a
 * group of `k` edges sorted by id, edge `i` gets `(i - (k - 1) / 2) * gap * dir`, where `dir` is 1
 * when the edge's `source:sourceHandle` is the lexicographically smaller endpoint and -1
 * otherwise (so edges running in opposite directions keep distinct lanes). Groups of one get 0.
 *
 * @param edges - The edges to group (usually the laid-out edges).
 * @param gap - Distance between neighbouring lanes in px.
 * @returns Map from edge id to offset. Every input edge has an entry.
 */
export function assignParallelOffsets(
  edges: Iterable<ParallelEdgeEnds>,
  gap: number,
): Map<string, number> {
  const groups = new Map<string, ParallelEdgeEnds[]>();
  for (const edge of edges) {
    const a = `${edge.source}:${edge.sourceHandle ?? ''}`;
    const b = `${edge.target}:${edge.targetHandle ?? ''}`;
    const key = a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    const group = groups.get(key);
    if (group) group.push(edge);
    else groups.set(key, [edge]);
  }

  const offsets = new Map<string, number>();
  for (const group of groups.values()) {
    const k = group.length;
    group.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    group.forEach((edge, i) => {
      const a = `${edge.source}:${edge.sourceHandle ?? ''}`;
      const b = `${edge.target}:${edge.targetHandle ?? ''}`;
      const dir = a <= b ? 1 : -1;
      // `+ 0` normalises -0 to 0
      offsets.set(edge.id, (i - (k - 1) / 2) * gap * dir + 0);
    });
  }
  return offsets;
}
