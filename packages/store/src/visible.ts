// Ported from xyflow (MIT) packages/svelte/src/lib/store/visibleElements.ts@3d35b57
import { getEdgePosition, getElevatedEdgeZIndex, getNodesInside, isEdgeVisible } from './engine.js';
import type { ConnectionMode, NodeLookup, OnError, Transform, ZIndexMode } from './engine.js';
import { assignParallelOffsets } from './edges/parallel.js';
import type { DefaultEdgeOptions, Edge, EdgeLayouted } from './types/edges.js';
import type { InternalNode, Node } from './types/nodes.js';
import type { ParallelEdges } from './types/options.js';

/** Viewport used to cull elements outside the visible area. */
export type CullingViewport = { transform: Transform; width: number; height: number };

/** Everything the edge layout pass depends on. */
export interface EdgeLayoutOptions<N extends Node = Node, E extends Edge = Edge> {
  /** The user edges, in order. */
  edges: E[];
  /** Node lookup (must contain the endpoints). */
  nodeLookup: NodeLookup<InternalNode<N>>;
  /** Defaults merged into every edge. */
  defaultEdgeOptions: DefaultEdgeOptions | undefined;
  /** Strict or loose connections (handle lookup). */
  connectionMode: ConnectionMode;
  /** Raise selected edges. */
  elevateEdgesOnSelect: boolean;
  /** z-index strategy. */
  zIndexMode: ZIndexMode;
  /** Parallel edge handling. */
  parallelEdges: ParallelEdges;
  /** Lane distance for `parallelEdges: 'spread'`. */
  parallelEdgeGap: number;
  /** Result of the previous pass, for identity reuse. */
  previous: Map<string, EdgeLayouted<E>>;
  /** Set to only lay out edges that touch the viewport. */
  culling: CullingViewport | null;
  /** Error reporter (upstream error codes). */
  onError: OnError;
}

/** What the layout pass produced. */
export interface EdgeLayoutResult<E extends Edge = Edge> {
  /** Laid-out edges by id, in edge order. */
  edges: Map<string, EdgeLayouted<E>>;
  /** Ids of the endpoints of every laid-out edge (only filled when culling). */
  endpointIds: Set<string>;
}

/** What a laid-out edge was computed from, to detect in-place changes of the engine. */
type LayoutInputs = {
  sourcePosition: unknown;
  targetPosition: unknown;
  sourceHandles: unknown;
  targetHandles: unknown;
};
const layoutInputs = new WeakMap<object, LayoutInputs>();

function inputsOf(source: InternalNode, target: InternalNode): LayoutInputs {
  return {
    sourcePosition: source.internals.positionAbsolute,
    targetPosition: target.internals.positionAbsolute,
    sourceHandles: source.internals.handleBounds,
    targetHandles: target.internals.handleBounds,
  };
}

/**
 * The nodes that are inside the viewport (partially), as in Svelte Flow's `getVisibleNodes`.
 *
 * @param nodeLookup - All nodes.
 * @param transform - Viewport transform.
 * @param width - Wrapper width.
 * @param height - Wrapper height.
 * @returns Visible nodes in lookup order, excluding hidden ones.
 */
export function getNodesInViewport<N extends Node = Node>(
  nodeLookup: NodeLookup<InternalNode<N>>,
  transform: Transform,
  width: number,
  height: number,
): InternalNode<N>[] {
  return getNodesInside(nodeLookup, { x: 0, y: 0, width, height }, transform, true);
}

/**
 * Lay out edges: resolve endpoints and handle positions, skip hidden/culled edges and reuse the
 * previous result object whenever nothing it depends on changed.
 *
 * An edge's previous layout is reused when the edge object, both endpoint nodes, the endpoints'
 * `positionAbsolute` and `handleBounds` objects (the engine replaces these objects instead of
 * mutating them), and the resolved offset are all unchanged.
 *
 * @param options - See {@link EdgeLayoutOptions}.
 * @returns The laid-out edges and (when culling) the endpoint node ids.
 */
export function getLayoutedEdges<N extends Node = Node, E extends Edge = Edge>(
  options: EdgeLayoutOptions<N, E>,
): EdgeLayoutResult<E> {
  const {
    edges,
    nodeLookup,
    defaultEdgeOptions,
    connectionMode,
    elevateEdgesOnSelect,
    zIndexMode,
    parallelEdges,
    parallelEdgeGap,
    previous,
    culling,
    onError,
  } = options;

  const layouted = new Map<string, EdgeLayouted<E>>();
  const endpointIds = new Set<string>();

  // 1. endpoints, hidden and culling
  const candidates: { edge: E; sourceNode: InternalNode<N>; targetNode: InternalNode<N> }[] = [];
  for (const edge of edges) {
    // a hidden edge is not rendered at all (React EdgeWrapper, Svelte EdgeWrapper)
    if (edge.hidden ?? defaultEdgeOptions?.hidden) continue;
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);

    if (!sourceNode || !targetNode || sourceNode.hidden || targetNode.hidden) {
      continue;
    }

    if (culling) {
      if (
        isEdgeVisible({
          sourceNode,
          targetNode,
          width: culling.width,
          height: culling.height,
          transform: culling.transform,
        })
      ) {
        endpointIds.add(sourceNode.id);
        endpointIds.add(targetNode.id);
      } else {
        continue;
      }
    }

    candidates.push({ edge, sourceNode, targetNode });
  }

  // 2. parallel offsets
  const parallelOffsets =
    parallelEdges === 'spread'
      ? assignParallelOffsets(
          candidates.map((c) => c.edge),
          parallelEdgeGap,
        )
      : null;

  // 3. layout, with identity reuse
  for (const { edge, sourceNode, targetNode } of candidates) {
    const explicitOffset = edge.offset ?? defaultEdgeOptions?.offset;
    const resolvedOffset = explicitOffset ?? parallelOffsets?.get(edge.id) ?? 0;
    const inputs = inputsOf(sourceNode, targetNode);

    /*
     * we reuse the previous edge object if the current and previous edge are the same, the
     * source and target node are the same, the references to what the layout was computed from
     * are the same and the offset is the same
     */
    const prev = previous.get(edge.id);
    if (
      prev &&
      edge === prev.edge &&
      sourceNode === prev.sourceNode &&
      targetNode === prev.targetNode &&
      resolvedOffset === prev.resolvedOffset
    ) {
      const was = layoutInputs.get(prev);
      if (
        was &&
        was.sourcePosition === inputs.sourcePosition &&
        was.targetPosition === inputs.targetPosition &&
        was.sourceHandles === inputs.sourceHandles &&
        was.targetHandles === inputs.targetHandles
      ) {
        layouted.set(edge.id, prev);
        continue;
      }
    }

    const edgePosition = getEdgePosition({
      id: edge.id,
      sourceNode,
      targetNode,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      connectionMode,
      onError,
    });

    // missing handle (error 008): skip, the error was reported
    if (!edgePosition) continue;

    const next = {
      ...defaultEdgeOptions,
      ...edge,
      ...edgePosition,
      zIndex: getElevatedEdgeZIndex({
        selected: edge.selected,
        zIndex: edge.zIndex ?? defaultEdgeOptions?.zIndex,
        sourceNode,
        targetNode,
        elevateOnSelect: elevateEdgesOnSelect,
        zIndexMode,
      }),
      sourceNode,
      targetNode,
      edge,
      resolvedOffset,
    } as unknown as EdgeLayouted<E>;
    layoutInputs.set(next, inputs);
    layouted.set(edge.id, next);
  }

  return { edges: layouted, endpointIds };
}
