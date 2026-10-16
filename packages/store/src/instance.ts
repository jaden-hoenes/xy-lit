// Ported from xyflow (MIT) packages/react/src/hooks/useReactFlow.ts, hooks/useViewportHelper.ts@3d35b57
import { SetQueue, foldQueue } from './batch.js';
import { elementToRemoveChange, getElementsDiffChanges } from './changes.js';
import { DEFAULT_NODE_SIZE } from './constants.js';
import {
  evaluateAbsolutePosition,
  getElementsToRemove,
  getNodesBounds,
  getOverlappingArea,
  getViewportForBounds,
  isRectObject,
  nodeToRect,
  pointToRendererPoint,
  rendererPointToPoint,
} from './engine.js';
import type {
  Dimensions,
  EdgeBase,
  HandleConnection,
  NodeConnection,
  OnBeforeDeleteBase,
  Rect,
  XYPosition,
} from './engine.js';
import type { FlowStore } from './flow-store.js';
import {
  NodeSpatialIndex,
  findFreePosition,
  findFreeRect,
  topLeftToPosition,
} from './placement.js';
import type { ChangeMeta, EdgeChange, NodeChange } from './types/changes.js';
import type { Edge } from './types/edges.js';
import type { FlowInstance } from './types/instance.js';
import type { InternalNode, Node } from './types/nodes.js';
import { createId, isNode } from './utils.js';

/** Key under which the instance carries its store (non-enumerable). See {@link getStoreOf}. */
export const STORE_SYMBOL: unique symbol = Symbol.for('xy-lit.store');

/**
 * The store behind a flow instance. Renderers only ever receive the instance, and helpers such
 * as `edgeLabel()` reach the store through this.
 *
 * @param flow - An instance created by `createFlowInstance`.
 * @throws When `flow` is not an instance created by this library.
 */
export function getStoreOf<N extends Node = Node, E extends Edge = Edge>(
  flow: FlowInstance<N, E>,
): FlowStore<N, E> {
  const store = (flow as unknown as Record<symbol, FlowStore<N, E> | undefined>)[STORE_SYMBOL];
  if (!store) throw new Error('XY Lit: not a flow instance');
  return store;
}

/** A shallow copy of an element without the local-only `remote` presence field. */
function withoutRemote<T extends Node | Edge>(element: T): T {
  const copy = { ...element } as T & { remote?: unknown };
  delete copy.remote;
  return copy;
}

/**
 * Create the imperative API of a store. The instance has a stable identity for the lifetime of
 * the store; `viewportInitialized` is a getter.
 *
 * @param store - The store to operate on.
 */
export function createFlowInstance<N extends Node = Node, E extends Edge = Edge>(
  store: FlowStore<N, E>,
): FlowInstance<N, E> {
  const nodeQueue = new SetQueue<N>((items) => {
    const { nodes, nodeLookup } = store.getState();
    const next = foldQueue(nodes, items);
    const changes = getElementsDiffChanges<N>({ items: next, lookup: nodeLookup });
    store.triggerNodeChanges(changes, { phase: 'discrete', origin: 'api', snapshotNodes: next });
  });
  const edgeQueue = new SetQueue<E>((items) => {
    const { edges, edgeLookup } = store.getState();
    const next = foldQueue(edges, items);
    const changes = getElementsDiffChanges<E>({ items: next, lookup: edgeLookup });
    store.triggerEdgeChanges(changes, { phase: 'discrete', origin: 'api', snapshotEdges: next });
  });

  const setNodes: FlowInstance<N, E>['setNodes'] = (payload) => {
    nodeQueue.push(payload);
  };
  const setEdges: FlowInstance<N, E>['setEdges'] = (payload) => {
    edgeQueue.push(payload);
  };

  const getInternalNode = (id: string): InternalNode<N> | undefined =>
    store.getState().nodeLookup.get(id);

  const getNodeRect = (node: N | { id: string }): Rect | null => {
    const { nodeLookup, nodeOrigin } = store.getState();

    const nodeToUse = isNode<N>(node) ? node : nodeLookup.get(node.id);
    if (!nodeToUse) return null;
    const position = nodeToUse.parentId
      ? evaluateAbsolutePosition(
          nodeToUse.position,
          nodeToUse.measured,
          nodeToUse.parentId,
          nodeLookup,
          nodeOrigin,
        )
      : nodeToUse.position;

    const nodeWithPosition = {
      ...nodeToUse,
      position,
      width: nodeToUse.measured?.width ?? nodeToUse.width,
      height: nodeToUse.measured?.height ?? nodeToUse.height,
    };

    return nodeToRect(nodeWithPosition);
  };

  const updateNode: FlowInstance<N, E>['updateNode'] = (
    id,
    nodeUpdate,
    options = { replace: false },
  ) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === id) {
          const nextNode = typeof nodeUpdate === 'function' ? nodeUpdate(node) : nodeUpdate;
          return options.replace && isNode<N>(nextNode) ? nextNode : { ...node, ...nextNode };
        }

        return node;
      }),
    );
  };

  const updateEdge: FlowInstance<N, E>['updateEdge'] = (
    id,
    edgeUpdate,
    options = { replace: false },
  ) => {
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        if (edge.id === id) {
          const nextEdge = typeof edgeUpdate === 'function' ? edgeUpdate(edge) : edgeUpdate;
          return options.replace && isEdgeLike<E>(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
        }

        return edge;
      }),
    );
  };

  const instance: FlowInstance<N, E> = {
    // graph ------------------------------------------------------------------------------------
    getNodes: () => store.getState().nodes.map((n) => withoutRemote(n)),
    getNode: (id) => getInternalNode(id)?.internals.userNode,
    getInternalNode,
    getEdges: () => store.getState().edges.map((e) => withoutRemote(e)),
    getEdge: (id) => store.getState().edgeLookup.get(id),
    setNodes,
    setEdges,

    addNodes: (payload, options) => {
      // keep call order with queued setNodes() calls
      nodeQueue.flush();
      const incoming = Array.isArray(payload) ? payload : [payload];
      const state = store.getState();
      const gap = options?.placement?.gap ?? 20;
      // one index per parent: a child may be placed inside its parent, so ancestors are no obstacle
      const indexes = new Map<string | undefined, NodeSpatialIndex>();
      const placed: Rect[] = [];
      const indexFor = (parentId: string | undefined): NodeSpatialIndex => {
        let index = indexes.get(parentId);
        if (!index) {
          const ancestors = new Set<string>();
          for (let id = parentId; id !== undefined; id = state.nodeLookup.get(id)?.parentId) {
            if (ancestors.has(id)) break;
            ancestors.add(id);
          }
          index = new NodeSpatialIndex(state.nodeLookup, gap, ancestors);
          for (const rect of placed) index.insert(rect);
          indexes.set(parentId, index);
        }
        return index;
      };

      const nodes = incoming.map((item): N => {
        if (item.position) return item as N;

        const size: Dimensions = {
          width: item.width ?? item.initialWidth ?? DEFAULT_NODE_SIZE.width,
          height: item.height ?? item.initialHeight ?? DEFAULT_NODE_SIZE.height,
        };
        // placed nodes are added one by one into the spatial index so a batch doesn't overlap itself
        const index = indexFor(item.parentId);
        const topLeft = findFreeRect(store, size, options?.placement, { index });
        const rect = { x: topLeft.x, y: topLeft.y, width: size.width, height: size.height };
        placed.push(rect);
        for (const other of indexes.values()) other.insert(rect);

        let position = topLeftToPosition(topLeft, size, item.origin ?? state.nodeOrigin);
        // positions of children are relative to their parent
        const parent = item.parentId ? state.nodeLookup.get(item.parentId) : undefined;
        if (parent) {
          position = {
            x: position.x - parent.internals.positionAbsolute.x,
            y: position.y - parent.internals.positionAbsolute.y,
          };
        }
        return { ...item, position } as N;
      });

      store.triggerNodeChanges(
        nodes.map((item): NodeChange<N> => ({ type: 'add', item })),
        { phase: 'discrete', origin: 'api' },
      );
    },

    addEdges: (payload) => {
      edgeQueue.flush();
      const incoming = Array.isArray(payload) ? payload : [payload];
      store.triggerEdgeChanges(
        incoming.map((item): EdgeChange<E> => ({ type: 'add', item })),
        { phase: 'discrete', origin: 'api' },
      );
    },

    toObject: () => {
      const { nodes, edges, transform } = store.getState();
      const [x, y, zoom] = transform;
      return {
        nodes: nodes.map((n) => withoutRemote(n)),
        edges: edges.map((e) => withoutRemote(e)),
        viewport: { x, y, zoom },
      };
    },

    deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      // keep call order with queued setNodes()/setEdges() calls
      nodeQueue.flush();
      edgeQueue.flush();
      const { nodes, edges, onBeforeDelete } = store.getState();
      const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
        nodesToRemove: nodesToRemove as Partial<N>[],
        edgesToRemove: edgesToRemove,
        nodes,
        edges: edges as unknown as EdgeBase[],
        onBeforeDelete: onBeforeDelete as OnBeforeDeleteBase<N, EdgeBase> | undefined,
      });
      const deletedEdges = matchingEdges as unknown as E[];

      const hasMatchingEdges = deletedEdges.length > 0;
      const hasMatchingNodes = matchingNodes.length > 0;

      const run = (): void => {
        // one gesture id so history can group both triggers
        const meta: ChangeMeta<N, E> = {
          phase: 'discrete',
          origin: 'delete',
          gestureId: createId(),
        };

        if (hasMatchingEdges) {
          store.emit('edges-delete', { edges: deletedEdges });
          store.triggerEdgeChanges(deletedEdges.map(elementToRemoveChange), meta);
        }

        if (hasMatchingNodes) {
          store.emit('nodes-delete', { nodes: matchingNodes });
          store.triggerNodeChanges(matchingNodes.map(elementToRemoveChange), meta);
        }

        if (hasMatchingNodes || hasMatchingEdges) {
          store.emit('delete', { nodes: matchingNodes, edges: deletedEdges });
        }
      };

      const { source } = store;
      if (source.transact && (hasMatchingEdges || hasMatchingNodes)) source.transact(run, 'delete');
      else run();

      return { deletedNodes: matchingNodes, deletedEdges };
    },

    /**
     * Partial is defined as "the 2 nodes/areas are intersecting partially".
     * If a is contained in b or b is contained in a, they are both
     * considered fully intersecting.
     */
    getIntersectingNodes: (nodeOrRect, partially = true, nodes) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
      const hasNodesOption = nodes !== undefined;

      if (!nodeRect) {
        return [];
      }

      return (nodes ?? store.getState().nodes).filter((n) => {
        const internalNode = store.getState().nodeLookup.get(n.id);

        if (
          internalNode &&
          !isRect &&
          (n.id === nodeOrRect.id || !internalNode.internals.positionAbsolute)
        ) {
          return false;
        }

        const currNodeRect = nodeToRect(hasNodesOption ? n : (internalNode ?? n));
        const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
        const partiallyVisible = partially && overlappingArea > 0;

        return (
          partiallyVisible ||
          overlappingArea >= currNodeRect.width * currNodeRect.height ||
          overlappingArea >= nodeRect.width * nodeRect.height
        );
      });
    },

    isNodeIntersecting: (nodeOrRect, area, partially = true) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) {
        return false;
      }

      const overlappingArea = getOverlappingArea(nodeRect, area);
      const partiallyVisible = partially && overlappingArea > 0;

      return (
        partiallyVisible ||
        overlappingArea >= area.width * area.height ||
        overlappingArea >= nodeRect.width * nodeRect.height
      );
    },

    updateNode,

    updateNodeData: (id, dataUpdate, options = { replace: false }) => {
      const { source } = store;
      if (source.updateNodeData && !options.replace) {
        // precise data update: the source merges the patch itself (e.g. one Yjs map entry)
        nodeQueue.flush();
        const userNode = getInternalNode(id)?.internals.userNode;
        if (!userNode) return;
        const patch = typeof dataUpdate === 'function' ? dataUpdate(userNode) : dataUpdate;
        const replaceChange: NodeChange<N> = {
          id,
          type: 'replace',
          item: { ...userNode, data: { ...userNode.data, ...patch } },
        };
        store.triggerNodeChanges(
          [replaceChange],
          { phase: 'discrete', origin: 'api' },
          {
            apply: (changes, meta) => {
              // a middleware that rewrote the change gets the generic path
              if (changes.length === 1 && changes[0] === replaceChange) {
                source.updateNodeData?.(id, patch, meta);
              } else {
                source.applyNodeChanges(changes, meta);
              }
            },
          },
        );
        return;
      }

      updateNode(
        id,
        (node) => {
          const nextData = typeof dataUpdate === 'function' ? dataUpdate(node) : dataUpdate;
          return options.replace
            ? { ...node, data: nextData }
            : { ...node, data: { ...node.data, ...nextData } };
        },
        options,
      );
    },

    updateEdge,

    updateEdgeData: (id, dataUpdate, options = { replace: false }) => {
      const { source } = store;
      if (source.updateEdgeData && !options.replace) {
        edgeQueue.flush();
        const userEdge = store.getState().edgeLookup.get(id);
        if (!userEdge) return;
        const patch = typeof dataUpdate === 'function' ? dataUpdate(userEdge) : dataUpdate;
        const replaceChange: EdgeChange<E> = {
          id,
          type: 'replace',
          item: { ...userEdge, data: { ...userEdge.data, ...patch } },
        };
        store.triggerEdgeChanges(
          [replaceChange],
          { phase: 'discrete', origin: 'api' },
          {
            apply: (changes, meta) => {
              if (changes.length === 1 && changes[0] === replaceChange) {
                source.updateEdgeData?.(id, patch as Partial<NonNullable<E['data']>>, meta);
              } else {
                source.applyEdgeChanges(changes, meta);
              }
            },
          },
        );
        return;
      }

      updateEdge(
        id,
        (edge) => {
          const nextData = typeof dataUpdate === 'function' ? dataUpdate(edge) : dataUpdate;
          return options.replace
            ? { ...edge, data: nextData }
            : { ...edge, data: { ...edge.data, ...nextData } };
        },
        options,
      );
    },

    getNodesBounds: (nodes) => {
      const { nodeLookup, nodeOrigin } = store.getState();
      return getNodesBounds(nodes, { nodeLookup, nodeOrigin });
    },

    getHandleConnections: ({ type, id, nodeId }): HandleConnection[] =>
      Array.from(
        store
          .getState()
          .connectionLookup.get(`${nodeId}-${type}${id ? `-${id}` : ''}`)
          ?.values() ?? [],
      ),

    getNodeConnections: ({ type, handleId, nodeId }): NodeConnection[] =>
      Array.from(
        store
          .getState()
          .connectionLookup.get(
            `${nodeId}${type ? (handleId ? `-${type}-${handleId}` : `-${type}`) : ''}`,
          )
          ?.values() ?? [],
      ),

    updateNodeInternals: (ids) => {
      store.requestNodeMeasure?.(Array.isArray(ids) ? ids : [ids]);
    },

    findFreePosition: (size, options) => findFreePosition(store, size, options),

    // viewport ---------------------------------------------------------------------------------
    zoomIn: (options) => {
      const { panZoom } = store.getState();
      return Promise.resolve(panZoom ? panZoom.scaleBy(1.2, options) : false);
    },

    zoomOut: (options) => {
      const { panZoom } = store.getState();
      return Promise.resolve(panZoom ? panZoom.scaleBy(1 / 1.2, options) : false);
    },

    zoomTo: (zoomLevel, options) => {
      const { panZoom } = store.getState();
      return Promise.resolve(panZoom ? panZoom.scaleTo(zoomLevel, options) : false);
    },

    getZoom: () => store.getState().transform[2],

    setViewport: async (viewport, options) => {
      const {
        transform: [tX, tY, tZoom],
        panZoom,
      } = store.getState();

      if (!panZoom) {
        return false;
      }

      await panZoom.setViewport(
        {
          x: viewport.x ?? tX,
          y: viewport.y ?? tY,
          zoom: viewport.zoom ?? tZoom,
        },
        options,
      );

      return true;
    },

    getViewport: () => {
      const [x, y, zoom] = store.getState().transform;
      return { x, y, zoom };
    },

    setCenter: (x, y, options) => store.setCenter(x, y, options),

    fitView: (options) => store.fitView(options),

    fitBounds: async (bounds, options) => {
      const { width, height, minZoom, maxZoom, panZoom } = store.getState();
      const viewport = getViewportForBounds(
        bounds,
        width,
        height,
        minZoom,
        maxZoom,
        options?.padding ?? 0.1,
      );

      if (!panZoom) {
        return false;
      }

      await panZoom.setViewport(viewport, {
        duration: options?.duration,
        ease: options?.ease,
        interpolate: options?.interpolate,
      });

      return true;
    },

    screenToFlowPosition: (clientPosition: XYPosition, options = {}) => {
      const { transform, snapGrid, snapToGrid, domNode } = store.getState();

      if (!domNode) {
        return clientPosition;
      }

      const { x: domX, y: domY } = domNode.getBoundingClientRect();
      const correctedPosition = {
        x: clientPosition.x - domX,
        y: clientPosition.y - domY,
      };
      const _snapGrid = options.snapGrid ?? snapGrid;
      const _snapToGrid = options.snapToGrid ?? snapToGrid;

      return pointToRendererPoint(correctedPosition, transform, _snapToGrid, _snapGrid);
    },

    flowToScreenPosition: (flowPosition: XYPosition) => {
      const { transform, domNode } = store.getState();

      if (!domNode) {
        return flowPosition;
      }

      const { x: domX, y: domY } = domNode.getBoundingClientRect();
      const rendererPosition = rendererPointToPoint(flowPosition, transform);

      return {
        x: rendererPosition.x + domX,
        y: rendererPosition.y + domY,
      };
    },

    get viewportInitialized() {
      return !!store.getState().panZoom;
    },
  };

  Object.defineProperty(instance, STORE_SYMBOL, { value: store, enumerable: false });
  return instance;
}

/** Edge counterpart of `isNode` for update payloads (`replace` needs a complete edge). */
function isEdgeLike<E extends Edge>(element: unknown): element is E {
  return (
    typeof element === 'object' &&
    element !== null &&
    'id' in element &&
    'source' in element &&
    'target' in element
  );
}
