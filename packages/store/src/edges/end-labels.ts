import { Position } from '../engine.js';
import type { EdgePosition, XYPosition } from '../engine.js';

const DIRECTION: Record<Position, XYPosition> = {
  [Position.Right]: { x: 1, y: 0 },
  [Position.Left]: { x: -1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

/**
 * Where to put the label at one end of an edge. Deterministic, no path sampling: the handle
 * point is moved `distance` px away from the node (along the handle's side) and `normalOffset`
 * px sideways, so the label sits next to the edge instead of on top of the node.
 *
 * Directions per handle side: right (1,0), left (-1,0), top (0,-1), bottom (0,1); the normal is
 * `(-dir.y, dir.x)`.
 *
 * @param p - Edge position (handle points and sides).
 * @param o.end - Which end of the edge.
 * @param o.distance - Distance from the handle along its side. Default 14.
 * @param o.normalOffset - Sideways offset. Default 10.
 * @returns Label anchor in flow coordinates.
 */
export function getEdgeEndLabelPosition(
  p: EdgePosition,
  o: { end: 'source' | 'target'; distance?: number; normalOffset?: number },
): XYPosition {
  const distance = o.distance ?? 14;
  const normalOffset = o.normalOffset ?? 10;
  const isSource = o.end === 'source';
  const x = isSource ? p.sourceX : p.targetX;
  const y = isSource ? p.sourceY : p.targetY;
  const dir = DIRECTION[isSource ? p.sourcePosition : p.targetPosition];
  const normal = { x: -dir.y, y: dir.x };
  return {
    x: x + dir.x * distance + normal.x * normalOffset,
    y: y + dir.y * distance + normal.y * normalOffset,
  };
}
