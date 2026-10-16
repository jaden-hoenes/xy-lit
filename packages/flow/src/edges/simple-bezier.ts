// Ported from xyflow (MIT) packages/react/src/components/Edges/SimpleBezierEdge.tsx@3d35b57
import { Position, getBezierEdgeCenter } from '@xy-lit/store';

/** Parameters of {@link getSimpleBezierPath}. */
export interface GetSimpleBezierPathParams {
  /** X of the source handle. */
  sourceX: number;
  /** Y of the source handle. */
  sourceY: number;
  /** @default Position.Bottom */
  sourcePosition?: Position;
  /** X of the target handle. */
  targetX: number;
  /** Y of the target handle. */
  targetY: number;
  /** @default Position.Top */
  targetPosition?: Position;
}

function getControl(
  pos: Position,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number] {
  if (pos === Position.Left || pos === Position.Right) {
    return [0.5 * (x1 + x2), y1];
  }
  return [x1, 0.5 * (y1 + y2)];
}

/**
 * The path of a simple bezier edge between two points.
 *
 * @returns `[path, labelX, labelY, offsetX, offsetY]`: the SVG path data, the label position and
 * the absolute distance between the source and the middle of the path.
 */
export function getSimpleBezierPath({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
}: GetSimpleBezierPathParams): [
  path: string,
  labelX: number,
  labelY: number,
  offsetX: number,
  offsetY: number,
] {
  const [sourceControlX, sourceControlY] = getControl(
    sourcePosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
  );
  const [targetControlX, targetControlY] = getControl(
    targetPosition,
    targetX,
    targetY,
    sourceX,
    sourceY,
  );
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY,
  });

  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY,
  ];
}
