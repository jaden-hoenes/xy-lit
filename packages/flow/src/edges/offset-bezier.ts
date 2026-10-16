// Control-point maths ported from xyflow (MIT) packages/system/src/utils/edges/bezier-edge.ts@3d35b57
import { Position } from '@xy-lit/store';

/** Positions of an edge's two ends (the layout part of `EdgeProps`). */
export type EdgeEnds = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
};

function controlOffset(distance: number, curvature: number): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

function control(
  pos: Position,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c: number,
): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - controlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + controlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - controlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + controlOffset(y2 - y1, c)];
  }
}

/**
 * Unit normal of the line from source to target (rotated 90 degrees clockwise on screen), or
 * `[0, 0]` when both ends coincide.
 *
 * @param e - The edge ends.
 */
export function edgeNormal(e: EdgeEnds): [number, number] {
  const dx = e.targetX - e.sourceX;
  const dy = e.targetY - e.sourceY;
  const length = Math.hypot(dx, dy);
  return length === 0 ? [0, 0] : [-dy / length, dx / length];
}

/**
 * A bezier path like `getBezierPath`, with both control points moved sideways by `offset * 1.5`
 * so that several edges between the same two handles fan out. The label sits on the curve at
 * t = 0.5.
 *
 * @param e - The edge ends.
 * @param offset - Sideways offset in px (negative goes to the other side).
 * @param curvature - As in `getBezierPath`. Default 0.25.
 * @returns `[path, labelX, labelY]`.
 */
export function getOffsetBezierPath(
  e: EdgeEnds,
  offset: number,
  curvature = 0.25,
): [path: string, labelX: number, labelY: number] {
  const { sourceX, sourceY, targetX, targetY } = e;
  const [c1x, c1y] = control(
    e.sourcePosition ?? Position.Bottom,
    sourceX,
    sourceY,
    targetX,
    targetY,
    curvature,
  );
  const [c2x, c2y] = control(
    e.targetPosition ?? Position.Top,
    targetX,
    targetY,
    sourceX,
    sourceY,
    curvature,
  );
  const [nx, ny] = edgeNormal(e);
  const shiftX = nx * offset * 1.5;
  const shiftY = ny * offset * 1.5;
  const sx = c1x + shiftX;
  const sy = c1y + shiftY;
  const tx = c2x + shiftX;
  const ty = c2y + shiftY;
  return [
    `M${sourceX},${sourceY} C${sx},${sy} ${tx},${ty} ${targetX},${targetY}`,
    sourceX * 0.125 + sx * 0.375 + tx * 0.375 + targetX * 0.125,
    sourceY * 0.125 + sy * 0.375 + ty * 0.375 + targetY * 0.125,
  ];
}

/**
 * A quadratic curve between the ends whose control point is the midpoint pushed sideways by
 * `2 * offset`; the label is at the curve's midpoint (midpoint + normal * offset).
 *
 * @param e - The edge ends.
 * @param offset - Sideways offset in px.
 * @returns `[path, labelX, labelY]`.
 */
export function getOffsetStraightPath(
  e: EdgeEnds,
  offset: number,
): [path: string, labelX: number, labelY: number] {
  const { sourceX, sourceY, targetX, targetY } = e;
  const [nx, ny] = edgeNormal(e);
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  return [
    `M${sourceX},${sourceY} Q${mx + nx * 2 * offset},${my + ny * 2 * offset} ${targetX},${targetY}`,
    mx + nx * offset,
    my + ny * offset,
  ];
}

/**
 * The `stepPosition` of a step edge shifted by a parallel-edge offset:
 * `clamp(0.5 + offset / max(|dx|, |dy|, 1), 0.1, 0.9)`.
 *
 * @param e - The edge ends.
 * @param offset - The edge's resolved offset.
 */
export function offsetStepPosition(e: EdgeEnds, offset: number): number {
  const span = Math.max(Math.abs(e.targetX - e.sourceX), Math.abs(e.targetY - e.sourceY), 1);
  return Math.min(0.9, Math.max(0.1, 0.5 + offset / span));
}
