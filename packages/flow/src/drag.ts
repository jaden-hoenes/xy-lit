// Ported from xyflow (MIT) packages/svelte/src/lib/actions/drag/index.ts, packages/react/src/hooks/useDrag.ts, packages/react/src/components/Nodes/utils.ts@3d35b57
import type { XYDrag } from '@xy-lit/store/internal';
import type { EdgeBase, FlowStore } from '@xy-lit/store';
import type { XyFlowElement } from './elements/xy-flow.js';

type XYDragParams = Parameters<typeof XYDrag>[0];

/** What `XYDrag` reads from the flow on every event. */
export type XYDragStoreItems = ReturnType<XYDragParams['getStoreItems']>;

/**
 * Build the `getStoreItems` callback `XYDrag` needs. It reads the current state on every call, so
 * the drag instance never holds stale values.
 *
 * @param store - The flow's store.
 * @param host - The flow element (events are emitted through it).
 * @returns The callback to pass as `XYDrag({ getStoreItems })`.
 */
export function createDragStoreItems(
  store: FlowStore,
  host: XyFlowElement,
): () => XYDragStoreItems {
  return () => {
    const s = store.getState();
    return {
      nodes: s.nodes,
      nodeLookup: s.nodeLookup,
      edges: s.edges as unknown as EdgeBase[],
      nodeExtent: s.nodeExtent,
      snapGrid: s.snapGrid,
      snapToGrid: s.snapToGrid,
      nodeOrigin: s.nodeOrigin,
      multiSelectionActive: s.multiSelectionActive,
      domNode: s.domNode,
      transform: s.transform,
      autoPanOnNodeDrag: s.autoPanOnNodeDrag,
      nodesDraggable: s.nodesDraggable,
      selectNodesOnDrag: s.selectNodesOnDrag,
      nodeDragThreshold: s.nodeDragThreshold,
      autoPanSpeed: s.autoPanSpeed,
      unselectNodesAndEdges: (params) => {
        store.unselectNodesAndEdges(params);
      },
      updateNodePositions: (items, dragging) => {
        store.updateNodePositions(items, dragging);
      },
      panBy: (delta) => store.panBy(delta),
      onError: store.onError,
      onNodeDragStart: (event, node, nodes) => {
        host.emit('node-drag-start', {
          event: event as MouseEvent,
          node: node,
          nodes: nodes,
        });
      },
      onNodeDrag: (event, node, nodes) => {
        host.emit('node-drag', {
          event: event as MouseEvent,
          node: node,
          nodes: nodes,
        });
      },
      onNodeDragStop: (event, node, nodes) => {
        host.emit('node-drag-stop', {
          event: event as MouseEvent,
          node: node,
          nodes: nodes,
        });
      },
      onSelectionDragStart: (event, nodes) => {
        host.emit('selection-drag-start', { event, nodes: nodes });
      },
      onSelectionDrag: (event, nodes) => {
        host.emit('selection-drag', { event, nodes: nodes });
      },
      onSelectionDragStop: (event, nodes) => {
        host.emit('selection-drag-stop', { event, nodes: nodes });
      },
    };
  };
}

/**
 * Select (or unselect) a node because it was clicked, or because its drag started.
 *
 * Called by the click handler when the node is not draggable or `selectNodesOnDrag` is off, and
 * by `XYDrag` (`onNodeMouseDown`) when a drag starts on a selectable node.
 *
 * @param o.id - Node id.
 * @param o.store - The flow's store.
 * @param o.unselect - Unselect an already selected node.
 * @param o.nodeEl - The node element; blurred after unselecting.
 */
export function handleNodeClick(o: {
  id: string;
  store: FlowStore;
  unselect?: boolean;
  nodeEl?: HTMLElement | null;
}): void {
  o.store.handleNodeSelection(o.id, o.unselect ?? false, o.nodeEl);
}
