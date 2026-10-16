/** Anything with an id and a selection flag (nodes and edges). */
export type Selectable = { id: string; selected?: boolean };

/**
 * The selected elements of a list, in model order.
 *
 * @param items - Nodes or edges.
 */
export function getSelected<T extends Selectable>(items: readonly T[]): T[] {
  return items.filter((item) => item.selected);
}

/**
 * Whether a set of ids equals a list of selected elements.
 *
 * @param previous - Previously selected ids.
 * @param selected - Currently selected elements.
 */
export function sameSelection(
  previous: ReadonlySet<string>,
  selected: readonly Selectable[],
): boolean {
  if (previous.size !== selected.length) return false;
  for (const item of selected) if (!previous.has(item.id)) return false;
  return true;
}
