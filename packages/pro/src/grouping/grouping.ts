import { createId, topLeftToPosition } from '@xy-lit/store';
import type {
  FlowStore,
  InternalNode,
  Node,
  NodeChange,
  NodeOrigin,
  Rect,
  XYPosition,
} from '@xy-lit/store';
import type { XyFlowElement } from '@xy-lit/flow';
import { storeOf, withStore } from '../common.js';
import type { Disposer, FlowLike } from '../common.js';

/** Options of {@link groupSelection}. */
export interface GroupOptions {
  /** Node type of the new group. Default `'group'`. */
  type?: string;
  /** Space around the grouped nodes, in flow units. Default 20. */
  padding?: number;
  /** `data` of the group node. */
  data?: Record<string, unknown>;
  /** Id of the group node. Default: a generated one. */
  id?: string;
  /** More fields for the group node (`style`, `class`, ...). `position`, `width`, `height` are set for you. */
  node?: Partial<Node>;
}

function sizeOf(node: InternalNode): { width: number; height: number } {
  return {
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0,
  };
}

function originOf(node: InternalNode, flowOrigin: NodeOrigin): NodeOrigin {
  return node.origin ?? flowOrigin;
}

function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, ...sizeOf(node) };
}

/** The `position` a node needs to sit at absolute top-left `topLeft` inside `parent` (null: root). */
function positionAt(
  node: InternalNode,
  topLeft: XYPosition,
  parent: InternalNode | null,
  flowOrigin: NodeOrigin,
): XYPosition {
  const o = originOf(node, flowOrigin);
  const { width, height } = sizeOf(node);
  const base = parent ? parent.internals.positionAbsolute : { x: 0, y: 0 };
  return { x: topLeft.x - base.x + o[0] * width, y: topLeft.y - base.y + o[1] * height };
}

function send(store: FlowStore, changes: NodeChange[], gestureId = createId()): void {
  store.triggerNodeChanges(changes, { phase: 'discrete', origin: 'api', gestureId });
}

/**
 * Put the selected root nodes into a new group node. The group gets the bounds of the selection
 * plus `padding`, the nodes get `parentId` and positions relative to the group, and the group is
 * inserted before its children in the nodes array (a parent must come before its children).
 * One change batch: one history step. The group ends up selected, the children unselected.
 *
 * Selected nodes that already have a parent are not grouped.
 *
 * @param flow - The `<xy-flow>` or its instance.
 * @returns The id of the group, or null when no root node is selected.
 */
export function groupSelection(flow: FlowLike, options: GroupOptions = {}): string | null {
  const store = storeOf(flow);
  const { nodes, nodeLookup, nodeOrigin } = store.getState();
  const padding = options.padding ?? 20;
  const members = nodes
    .filter((n) => n.selected && !n.parentId)
    .map((n) => nodeLookup.get(n.id))
    .filter((n): n is InternalNode => !!n && !n.hidden);
  if (!members.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of members) {
    const r = rectOf(n);
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  const topLeft = { x: minX - padding, y: minY - padding };
  const width = maxX - minX + 2 * padding;
  const height = maxY - minY + 2 * padding;

  const taken = new Set(nodes.map((n) => n.id));
  let id = options.id ?? `group-${createId()}`;
  while (taken.has(id)) id = `group-${createId()}`;

  const group: Node = {
    ...options.node,
    id,
    type: options.type ?? 'group',
    position: topLeftToPosition(topLeft, { width, height }, nodeOrigin),
    data: options.data ?? {},
    width,
    height,
    selected: true,
  };
  const groupInternal = { internals: { positionAbsolute: topLeft } } as InternalNode;

  const changes: NodeChange[] = members.map((n) => ({
    id: n.id,
    type: 'replace',
    item: {
      ...n.internals.userNode,
      parentId: id,
      position: positionAt(n, rectOf(n), groupInternal, nodeOrigin),
      selected: false,
    },
  }));
  const index = Math.min(...members.map((n) => nodes.indexOf(n.internals.userNode)));
  changes.push({ type: 'add', item: group, index });
  send(store, changes);
  return id;
}

/**
 * Dissolve a group: its children get absolute positions (or positions relative to the group's own
 * parent, for nested groups), lose `parentId` and stay selected; the group node is removed.
 * Their descendants stay with them. One change batch: one history step.
 *
 * @param flow - The `<xy-flow>` or its instance.
 * @param groupId - The group node.
 * @returns The ids of the freed children (empty when there is no such group).
 */
export function ungroup(flow: FlowLike, groupId: string): string[] {
  const store = storeOf(flow);
  const { nodeLookup, parentLookup, nodeOrigin } = store.getState();
  const group = nodeLookup.get(groupId);
  if (!group) return [];
  const newParent = group.parentId ? (nodeLookup.get(group.parentId) ?? null) : null;
  // parentLookup can hold stale internal node objects: take the ids and read the nodes from nodeLookup
  const children = [...(parentLookup.get(groupId)?.keys() ?? [])]
    .map((id) => nodeLookup.get(id))
    .filter((n): n is InternalNode => !!n);

  const changes: NodeChange[] = children.map((child) => {
    const item: Node = {
      ...child.internals.userNode,
      position: positionAt(child, rectOf(child), newParent, nodeOrigin),
      selected: true,
    };
    if (newParent) {
      item.parentId = newParent.id;
    } else {
      delete item.parentId;
      delete item.expandParent;
    }
    if (item.extent === 'parent' && !newParent) delete item.extent;
    return { id: child.id, type: 'replace', item };
  });
  changes.push({ id: groupId, type: 'remove' });
  send(store, changes);
  return children.map((c) => c.id);
}

/** Options of {@link installDropIntoGroup}. */
export interface DropIntoGroupOptions {
  /** Node types that act as groups. Default `['group']`. */
  groupTypes?: string[];
}

function isDescendant(
  lookup: Map<string, InternalNode>,
  node: InternalNode,
  ancestorId: string,
): boolean {
  for (let p = node.parentId; p; p = lookup.get(p)?.parentId) if (p === ancestorId) return true;
  return false;
}

const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Reparent one node (and its subtree) and fix the array order. */
function reparent(
  store: FlowStore,
  nodeId: string,
  parentId: string | null,
  gestureId: string,
): void {
  const { nodes, nodeLookup, nodeOrigin } = store.getState();
  const node = nodeLookup.get(nodeId);
  const parent = parentId ? (nodeLookup.get(parentId) ?? null) : null;
  if (!node || (parentId && !parent)) return;

  const item: Node = {
    ...node.internals.userNode,
    position: positionAt(node, rectOf(node), parent, nodeOrigin),
  };
  if (parent) item.parentId = parent.id;
  else {
    delete item.parentId;
    delete item.expandParent;
    if (item.extent === 'parent') delete item.extent;
  }

  const index = nodes.indexOf(node.internals.userNode);
  const parentIndex = parent ? nodes.indexOf(parent.internals.userNode) : -1;
  if (!parent || index > parentIndex) {
    send(store, [{ id: nodeId, type: 'replace', item }], gestureId);
    return;
  }
  // the parent must come before its children: move the subtree behind it
  const subtree = nodes.filter((n) => {
    if (n.id === nodeId) return true;
    const internal = nodeLookup.get(n.id);
    return !!internal && isDescendant(nodeLookup, internal, nodeId);
  });
  const subtreeIds = new Set(subtree.map((n) => n.id));
  const base = nodes.filter((n) => !subtreeIds.has(n.id));
  const at = base.findIndex((n) => n.id === parent.id) + 1;
  const changes: NodeChange[] = subtree.map((n) => ({ id: n.id, type: 'remove' }));
  subtree.forEach((n, i) => {
    changes.push({ type: 'add', item: n.id === nodeId ? item : n, index: at + i });
  });
  send(store, changes, gestureId);
}

/**
 * Drag nodes into and out of groups. On `node-drag-stop`, for each dragged node (not counting
 * nodes that move with a dragged ancestor): the topmost group (of `groupTypes`) that fully
 * contains it becomes its parent, with the position converted; a child that is dragged completely
 * out of its group is unparented. The reparenting joins the drag's history step.
 *
 * Needs the data source to apply changes synchronously (the built-in one does).
 *
 * @returns A disposer.
 */
export function installDropIntoGroup(
  flow: XyFlowElement,
  options: DropIntoGroupOptions = {},
): Disposer {
  const groupTypes = new Set(options.groupTypes ?? ['group']);
  return withStore(flow, (store, host) => {
    if (!host) return;
    let lastGesture: string | undefined;
    const off = store.addNodeChangeMiddleware((changes, meta) => {
      if (meta.origin === 'drag' && meta.phase === 'end') lastGesture = meta.gestureId;
      return changes;
    });

    const onStop = (event: Event): void => {
      const { nodes: dragged } = (event as CustomEvent<{ nodes: Node[] }>).detail;
      const draggedIds = new Set(dragged.map((n) => n.id));
      const gestureId = lastGesture ?? createId();
      for (const id of draggedIds) {
        const { nodes, nodeLookup } = store.getState();
        const node = nodeLookup.get(id);
        if (!node) continue;
        // children of a dragged group moved with it
        let carried = false;
        for (let p = node.parentId; p; p = nodeLookup.get(p)?.parentId) {
          if (draggedIds.has(p)) carried = true;
        }
        if (carried) continue;

        const rect = rectOf(node);
        let target: InternalNode | null = null;
        let targetIndex = -1;
        nodes.forEach((candidate, index) => {
          const c = nodeLookup.get(candidate.id);
          if (!c || c.hidden || c.id === id || !groupTypes.has(c.type ?? '')) return;
          if (isDescendant(nodeLookup, c, id)) return;
          if (!contains(rectOf(c), rect)) return;
          if (index > targetIndex) {
            target = c;
            targetIndex = index;
          }
        });

        const currentParent = node.parentId ? nodeLookup.get(node.parentId) : undefined;
        if (target) {
          const t: InternalNode = target;
          if (t.id !== node.parentId) reparent(store, id, t.id, gestureId);
        } else if (
          currentParent &&
          groupTypes.has(currentParent.type ?? '') &&
          !overlaps(rectOf(currentParent), rect)
        ) {
          reparent(store, id, null, gestureId);
        }
      }
    };
    host.addEventListener('node-drag-stop', onStop);
    return () => {
      off();
      host.removeEventListener('node-drag-stop', onStop);
    };
  });
}
