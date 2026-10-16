import type {
  ChangeMeta,
  Edge,
  EdgeChange,
  FlowStore,
  Node,
  NodeChange,
  NodeDimensionChange,
} from '@xy-lit/store';

/** One batch of changes to one kind of element, as sent through the change pipeline. */
export type Entry =
  { kind: 'node'; changes: NodeChange[] } | { kind: 'edge'; changes: EdgeChange[] };

/** Fields that describe local state, not the document: a replace that only touches them is not a step. */
const LOCAL_FIELDS = new Set(['selected', 'dragging', 'resizing', 'measured', 'remote']);

function sameDocument(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (LOCAL_FIELDS.has(key)) continue;
    const x = (a as Record<string, unknown>)[key];
    const y = (b as Record<string, unknown>)[key];
    if (x === y) continue;
    if (typeof x === 'object' && typeof y === 'object' && x !== null && y !== null) {
      // `data`, `position`, `style` objects: compare by value (JSON-like content)
      try {
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
      } catch {
        // not serialisable: treat as different
      }
    }
    return false;
  }
  return true;
}

/** The sizes a `dimensions` change with `setAttributes` would overwrite. */
function currentSize(node: Node): { width: number | undefined; height: number | undefined } {
  return {
    width: node.width ?? node.measured?.width,
    height: node.height ?? node.measured?.height,
  };
}

/**
 * Invert a batch of node changes against the state *before* they are applied (or, when used
 * to compute a redo step, against the state before the inverse is applied).
 *
 * Selection changes, measurements (`dimensions` without `setAttributes`) and `dragging`-only
 * position changes have no inverse and are dropped, as are changes to elements that are not in
 * the store.
 */
export function invertNodeChanges(changes: readonly NodeChange[], store: FlowStore): NodeChange[] {
  const { nodes, nodeLookup } = store.getState();
  const out: NodeChange[] = [];
  const adds: { change: NodeChange; index: number }[] = [];
  for (const change of changes) {
    switch (change.type) {
      case 'position': {
        const node = nodeLookup.get(change.id);
        if (!change.position || !node) break;
        out.push({
          id: change.id,
          type: 'position',
          position: { ...node.position },
          dragging: false,
        });
        break;
      }
      case 'dimensions': {
        const node = nodeLookup.get(change.id);
        if (!change.setAttributes || !change.dimensions || !node) break;
        const { width, height } = currentSize(node.internals.userNode);
        const inverse: NodeDimensionChange = {
          id: change.id,
          type: 'dimensions',
          dimensions: {
            width: width ?? change.dimensions.width,
            height: height ?? change.dimensions.height,
          },
          setAttributes: change.setAttributes,
          resizing: false,
        };
        out.push(inverse);
        break;
      }
      case 'add':
        out.push({ id: change.item.id, type: 'remove' });
        break;
      case 'remove': {
        const node = nodeLookup.get(change.id);
        if (!node) break;
        adds.push({
          change: {
            type: 'add',
            item: node.internals.userNode,
            index: nodes.indexOf(node.internals.userNode),
          },
          index: nodes.indexOf(node.internals.userNode),
        });
        break;
      }
      case 'replace': {
        const node = nodeLookup.get(change.id);
        if (!node) break;
        if (sameDocument(node.internals.userNode, change.item)) break;
        out.push({ id: change.id, type: 'replace', item: node.internals.userNode });
        break;
      }
      default:
        break;
    }
  }
  adds.sort((a, b) => a.index - b.index);
  out.push(...adds.map((a) => a.change));
  return out;
}

/** Edge counterpart of {@link invertNodeChanges}. */
export function invertEdgeChanges(changes: readonly EdgeChange[], store: FlowStore): EdgeChange[] {
  const { edges, edgeLookup } = store.getState();
  const out: EdgeChange[] = [];
  const adds: { change: EdgeChange; index: number }[] = [];
  for (const change of changes) {
    switch (change.type) {
      case 'add':
        out.push({ id: change.item.id, type: 'remove' });
        break;
      case 'remove': {
        const edge = edgeLookup.get(change.id);
        if (!edge) break;
        const index = edges.indexOf(edge);
        adds.push({ change: { type: 'add', item: edge, index }, index });
        break;
      }
      case 'replace': {
        const edge = edgeLookup.get(change.id);
        if (!edge) break;
        if (sameDocument(edge, change.item)) break;
        out.push({ id: change.id, type: 'replace', item: edge });
        break;
      }
      default:
        break;
    }
  }
  adds.sort((a, b) => a.index - b.index);
  out.push(...adds.map((a) => a.change));
  return out;
}

/** Invert an entry against the current state of the store. */
export function invertEntry(entry: Entry, store: FlowStore): Entry {
  return entry.kind === 'node'
    ? { kind: 'node', changes: invertNodeChanges(entry.changes, store) }
    : { kind: 'edge', changes: invertEdgeChanges(entry.changes, store) };
}

/** Send an entry through the change pipeline. */
export function applyEntry(entry: Entry, store: FlowStore, meta: ChangeMeta): void {
  if (entry.kind === 'node') store.triggerNodeChanges(entry.changes, meta);
  else store.triggerEdgeChanges(entry.changes, meta);
}

/** Element types the helpers above work on (re-exported for the history class). */
export type { Edge, Node };
