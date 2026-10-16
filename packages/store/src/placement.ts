import RBush from 'rbush';
import { getNodeDimensions, pointToRendererPoint, snapPosition } from './engine.js';
import type { Dimensions, NodeLookup, NodeOrigin, Rect, XYPosition } from './engine.js';
import { DEFAULT_NODE_SIZE } from './constants.js';
import type { FlowStore } from './flow-store.js';
import type { Edge } from './types/edges.js';
import type { InternalNode, Node } from './types/nodes.js';
import type { PlacementOptions } from './types/instance.js';

type IndexItem = { minX: number; minY: number; maxX: number; maxY: number };

const toItem = (r: Rect): IndexItem => ({
  minX: r.x,
  minY: r.y,
  maxX: r.x + r.width,
  maxY: r.y + r.height,
});

/**
 * Spatial index (rbush) of the absolute rectangles of the nodes in a lookup, used to find free
 * space. Nodes without dimensions count as {@link DEFAULT_NODE_SIZE}; hidden nodes are ignored.
 */
export class NodeSpatialIndex {
  private readonly tree = new RBush<IndexItem>();

  /**
   * @param nodeLookup - Nodes whose rectangles are indexed.
   * @param gap - Spacing kept around every indexed rectangle.
   * @param exclude - Ids of nodes to leave out (the ancestors of a node placed inside a parent).
   */
  constructor(
    nodeLookup: NodeLookup<InternalNode<Node>>,
    private readonly gap: number,
    exclude?: ReadonlySet<string>,
  ) {
    const items: IndexItem[] = [];
    for (const node of nodeLookup.values()) {
      if (node.hidden || exclude?.has(node.id)) continue;
      const { width, height } = getNodeDimensions(node);
      items.push(
        toItem({
          x: node.internals.positionAbsolute.x,
          y: node.internals.positionAbsolute.y,
          width: width || DEFAULT_NODE_SIZE.width,
          height: height || DEFAULT_NODE_SIZE.height,
        }),
      );
    }
    this.tree.load(items);
  }

  /** Add a rectangle (so a batch of new nodes does not overlap itself). */
  insert(rect: Rect): void {
    this.tree.insert(toItem(rect));
  }

  /** Whether `rect`, inflated by the gap, touches any indexed rectangle. */
  collides(rect: Rect): boolean {
    const gap = this.gap;
    return this.tree.collides({
      minX: rect.x - gap,
      minY: rect.y - gap,
      maxX: rect.x + rect.width + gap,
      maxY: rect.y + rect.height + gap,
    });
  }
}

/** Internal knobs of {@link findFreeRect}. */
export type FindFreeInternals = {
  /** Reuse an index (batch placement). Its own gap applies. */
  index?: NodeSpatialIndex;
  /** Node origin used for the conversion to `position`. Default: the store's `nodeOrigin`. */
  origin?: NodeOrigin;
};

/**
 * Like {@link findFreePosition} but returns the free top-left corner in flow coordinates, before
 * the conversion with the node origin. `addNodes` uses it to insert the placed rectangle into the
 * shared index.
 */
export function findFreeRect<N extends Node, E extends Edge>(
  store: FlowStore<N, E>,
  size: Dimensions,
  options: PlacementOptions = {},
  internals: FindFreeInternals = {},
): XYPosition {
  const state = store.getState();
  const gap = options.gap ?? 20;
  const step = options.step ?? (state.snapToGrid ? state.snapGrid[0] : 20);
  const maxRings = options.maxRings ?? 200;
  const around = options.around ?? 'viewport-center';

  let centre: XYPosition;
  if (typeof around === 'object') {
    centre = around;
  } else {
    const viewportCentre = pointToRendererPoint(
      { x: state.width / 2, y: state.height / 2 },
      state.transform,
    );
    centre =
      around === 'pointer' ? (state.lastPointerFlowPosition ?? viewportCentre) : viewportCentre;
  }

  const index = internals.index ?? new NodeSpatialIndex(state.nodeLookup, gap);

  const candidate = (i: number, j: number): XYPosition => {
    const topLeft = {
      x: centre.x + i * step - size.width / 2,
      y: centre.y + j * step - size.height / 2,
    };
    if (!state.snapToGrid) return topLeft;
    const snapped = snapPosition(topLeft, state.snapGrid);
    // `+ 0` turns -0 into 0
    return { x: snapped.x + 0, y: snapped.y + 0 };
  };
  const fits = (p: XYPosition): boolean =>
    !index.collides({ x: p.x, y: p.y, width: size.width, height: size.height });

  for (let r = 0; r <= maxRings; r++) {
    if (r === 0) {
      const p = candidate(0, 0);
      if (fits(p)) return p;
      continue;
    }
    // top edge left to right, right edge top to bottom, bottom edge right to left, left edge bottom to top
    for (let i = -r; i <= r; i++) {
      const p = candidate(i, -r);
      if (fits(p)) return p;
    }
    for (let j = -r + 1; j <= r; j++) {
      const p = candidate(r, j);
      if (fits(p)) return p;
    }
    for (let i = r - 1; i >= -r; i--) {
      const p = candidate(i, r);
      if (fits(p)) return p;
    }
    for (let j = r - 1; j >= -r + 1; j--) {
      const p = candidate(-r, j);
      if (fits(p)) return p;
    }
  }

  return { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
}

/**
 * Convert a top-left corner to a node `position` for the given node origin
 * (`position = topLeft + origin * size`).
 *
 * @param topLeft - Top-left corner in flow coordinates.
 * @param size - Node size.
 * @param origin - Node origin.
 */
export function topLeftToPosition(
  topLeft: XYPosition,
  size: Dimensions,
  origin: NodeOrigin,
): XYPosition {
  return { x: topLeft.x + origin[0] * size.width, y: topLeft.y + origin[1] * size.height };
}

/**
 * Find free space for a node of the given size: a spiral search of rings around a centre
 * (`around`), returning the first candidate that keeps `gap` distance to every existing node.
 * Candidates are snapped to the grid when `snapToGrid` is on. If nothing is free within
 * `maxRings`, the centre itself is returned.
 *
 * @param store - The flow store (nodes, viewport, snap settings, node origin).
 * @param size - Size of the node to place.
 * @param options - Placement options.
 * @param internals - Internal: shared index and origin for batch placement.
 * @returns The `position` to give the node (accounts for `nodeOrigin`).
 */
export function findFreePosition<N extends Node, E extends Edge>(
  store: FlowStore<N, E>,
  size: Dimensions,
  options: PlacementOptions = {},
  internals: FindFreeInternals = {},
): XYPosition {
  const topLeft = findFreeRect(store, size, options, internals);
  return topLeftToPosition(topLeft, size, internals.origin ?? store.getState().nodeOrigin);
}
