// Ported from xyflow (MIT) packages/react/src/utils/changes.ts@3d35b57
import type { NodeLookup, XYPosition } from './engine.js';
import type { NodeChange } from './types/changes.js';
import type { EdgeChange, NodeRemoveChange, NodeSelectionChange } from './types/changes.js';
import type { Edge, EdgeLookup } from './types/edges.js';
import type { InternalNode, Node } from './types/nodes.js';

type AnyChange = NodeChange<Node> | EdgeChange<Edge>;

/** The fields `applyChange` writes. Elements are shallow-copied before this is applied. */
type MutableElement = {
  selected?: boolean;
  position?: XYPosition;
  dragging?: boolean;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
  resizing?: boolean;
};

/*
 * This function applies changes to nodes or edges that are triggered by XY Lit internally.
 * When you drag a node for example, XY Lit will send a position change update.
 * This function then applies the changes and returns the updated elements.
 */
function applyChanges<T extends { id: string }>(changes: readonly AnyChange[], elements: T[]): T[] {
  const updatedElements: T[] = [];
  /*
   * By storing a map of changes for each element, we can a quick lookup as we
   * iterate over the elements array!
   */
  const changesMap = new Map<string, AnyChange[]>();
  const addItemChanges: Extract<AnyChange, { type: 'add' }>[] = [];

  for (const change of changes) {
    if (change.type === 'add') {
      addItemChanges.push(change);
      continue;
    } else if (change.type === 'remove' || change.type === 'replace') {
      /*
       * For a 'remove' change we can safely ignore any other changes queued for
       * the same element, it's going to be removed anyway!
       */
      changesMap.set(change.id, [change]);
    } else {
      const elementChanges = changesMap.get(change.id);

      if (elementChanges) {
        /*
         * If we have some changes queued already, we can do a mutable update of
         * that array and save ourselves some copying.
         */
        elementChanges.push(change);
      } else {
        changesMap.set(change.id, [change]);
      }
    }
  }

  for (const element of elements) {
    const elementChanges = changesMap.get(element.id);

    /*
     * When there are no changes for an element we can just push it unmodified,
     * no need to copy it.
     */
    if (!elementChanges) {
      updatedElements.push(element);
      continue;
    }

    const first = elementChanges[0];

    // If we have a 'remove' change queued, it'll be the only change in the array
    if (first?.type === 'remove') {
      continue;
    }

    if (first?.type === 'replace') {
      updatedElements.push({ ...first.item } as unknown as T);
      continue;
    }

    /**
     * For other types of changes, we want to start with a shallow copy of the
     * object so consumers know this element has changed. Sequential changes will
     * each _mutate_ this object, so there's only ever one copy.
     */
    const updatedElement = { ...element };

    for (const change of elementChanges) {
      applyChange(change, updatedElement as unknown as MutableElement);
    }

    updatedElements.push(updatedElement);
  }

  /*
   * we need to wait for all changes to be applied before adding new items
   * to be able to add them at the correct index
   */
  for (const change of addItemChanges) {
    const item = { ...change.item } as unknown as T;
    if (change.index !== undefined) {
      updatedElements.splice(change.index, 0, item);
    } else {
      updatedElements.push(item);
    }
  }

  return updatedElements;
}

// Applies a single change to an element. This is a *mutable* update.
function applyChange(change: AnyChange, element: MutableElement): void {
  switch (change.type) {
    case 'select': {
      element.selected = change.selected;
      break;
    }

    case 'position': {
      if (typeof change.position !== 'undefined') {
        element.position = change.position;
      }

      if (typeof change.dragging !== 'undefined') {
        element.dragging = change.dragging;
      }

      break;
    }

    case 'dimensions': {
      if (typeof change.dimensions !== 'undefined') {
        element.measured = {
          ...change.dimensions,
        };

        if (change.setAttributes) {
          if (change.setAttributes === true || change.setAttributes === 'width') {
            element.width = change.dimensions.width;
          }
          if (change.setAttributes === true || change.setAttributes === 'height') {
            element.height = change.dimensions.height;
          }
        }
      }

      if (typeof change.resizing === 'boolean') {
        element.resizing = change.resizing;
      }

      break;
    }
  }
}

/**
 * Apply node changes to an array of nodes. Elements without changes keep their identity;
 * changed elements are shallow copies. A `remove` or `replace` for an id wins over the other
 * changes for that id; `add` changes are applied last (at `index` when given).
 *
 * @param changes - Changes to apply.
 * @param nodes - Nodes to apply the changes to.
 * @returns The updated nodes.
 */
export function applyNodeChanges<N extends Node = Node>(
  changes: readonly NodeChange<N>[],
  nodes: N[],
): N[] {
  return applyChanges(changes as readonly AnyChange[], nodes);
}

/**
 * Apply edge changes to an array of edges. See {@link applyNodeChanges} for the rules.
 *
 * @param changes - Changes to apply.
 * @param edges - Edges to apply the changes to.
 * @returns The updated edges.
 */
export function applyEdgeChanges<E extends Edge = Edge>(
  changes: readonly EdgeChange<E>[],
  edges: E[],
): E[] {
  return applyChanges(changes as readonly AnyChange[], edges);
}

/**
 * Create a selection change for a node or an edge.
 *
 * @param id - Element id.
 * @param selected - New selection state.
 * @returns A `select` change (node and edge selection changes have the same shape).
 */
export function createSelectionChange(id: string, selected: boolean): NodeSelectionChange {
  return {
    id,
    type: 'select',
    selected,
  };
}

/**
 * Selection changes that make exactly `selectedIds` selected. Elements that are already in the
 * right state (and elements that never had a `selected` flag and stay unselected) produce no
 * change.
 *
 * @param items - Lookup of elements to check.
 * @param selectedIds - Ids that should end up selected.
 * @param mutateItem - Also write `selected` on the looked-up item (the "drag starts on an
 * unselected node" hack, see upstream).
 */
export function getSelectionChanges(
  items: Map<string, { id: string; selected?: boolean }>,
  selectedIds: Set<string> = new Set(),
  mutateItem = false,
): NodeSelectionChange[] {
  const changes: NodeSelectionChange[] = [];

  for (const [id, item] of items) {
    const willBeSelected = selectedIds.has(id);

    // we don't want to set all items to selected=false on the first selection
    if (!(item.selected === undefined && !willBeSelected) && item.selected !== willBeSelected) {
      if (mutateItem) {
        /*
         * this hack is needed for nodes. When the user dragged a node, it's selected.
         * When another node gets dragged, we need to deselect the previous one,
         * in order to have only one selected node at a time - the change callback comes too late here :/
         */
        item.selected = willBeSelected;
      }
      changes.push(createSelectionChange(item.id, willBeSelected));
    }
  }

  return changes;
}

/**
 * Find the changes between a next set of elements and the elements currently in the store.
 * Used to turn `setNodes(next)` / `setEdges(next)` into add/remove/replace changes.
 *
 * @param params.items - The next elements (nodes or edges).
 * @param params.lookup - Lookup of the current store elements.
 * @returns The changes, in the order add/replace (by next index) then remove.
 */
export function getElementsDiffChanges<N extends Node>(params: {
  items: N[] | undefined;
  lookup: NodeLookup<InternalNode<N>>;
}): NodeChange<N>[];
export function getElementsDiffChanges<E extends Edge>(params: {
  items: E[] | undefined;
  lookup: EdgeLookup<E>;
}): EdgeChange<E>[];
export function getElementsDiffChanges({
  items = [],
  lookup,
}: {
  items: (Node | Edge)[] | undefined;
  lookup: Map<string, unknown>;
}): unknown[] {
  const changes: AnyChange[] = [];
  const itemsLookup = new Map<string, Node | Edge>(items.map((item) => [item.id, item]));

  for (const [index, item] of items.entries()) {
    const lookupItem = lookup.get(item.id);
    const storeItem =
      typeof lookupItem === 'object' && lookupItem !== null && 'internals' in lookupItem
        ? (lookupItem as InternalNode).internals.userNode
        : lookupItem;

    if (storeItem !== undefined && storeItem !== item) {
      changes.push({ id: item.id, item, type: 'replace' } as AnyChange);
    }

    if (storeItem === undefined) {
      changes.push({ item, type: 'add', index } as AnyChange);
    }
  }

  for (const [id] of lookup) {
    const nextNode = itemsLookup.get(id);

    if (nextNode === undefined) {
      changes.push({ id, type: 'remove' });
    }
  }

  return changes;
}

/**
 * Turn an element into a `remove` change.
 *
 * @param item - Node or edge to remove.
 */
export function elementToRemoveChange<T extends Node | Edge>(item: T): NodeRemoveChange {
  return {
    id: item.id,
    type: 'remove',
  };
}
