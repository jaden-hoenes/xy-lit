// Ported from the xyflow examples (MIT) examples/react/src/examples/FloatingEdges/utils.ts@3d35b57
// Geometry for floating edges: an edge leaves a node where the line between the two node centres
// crosses the node's border, instead of at a fixed handle.
import { svg } from 'lit';
import { MarkerType, Position, defineEdgeType, getBezierPath } from '@xy-lit/flow';
import type { ConnectionLineRenderer, InternalNode } from '@xy-lit/flow';

type Box = { x: number; y: number; width: number; height: number };

const boxOf = (node: InternalNode): Box => ({
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
  width: node.measured.width ?? 0,
  height: node.measured.height ?? 0,
});

/** The point where the line from `from`'s centre to `to`'s centre leaves `from`. */
function getNodeIntersection(from: Box, to: Box): { x: number; y: number } {
  const w = from.width / 2;
  const h = from.height / 2;
  const x2 = from.x + w;
  const y2 = from.y + h;
  const x1 = to.x + to.width / 2;
  const y1 = to.y + to.height / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

/** Which side of `box` the point lies on. */
function getEdgePosition(box: Box, point: { x: number; y: number }): Position {
  const nx = Math.round(box.x);
  const ny = Math.round(box.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  if (px <= nx + 1) return Position.Left;
  if (px >= nx + box.width - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + box.height - 1) return Position.Bottom;
  return Position.Top;
}

/** Start and end points (and sides) of a floating edge between two nodes. */
export function getEdgeParams(source: Box, target: Box) {
  const s = getNodeIntersection(source, target);
  const t = getNodeIntersection(target, source);
  return {
    sx: s.x,
    sy: s.y,
    tx: t.x,
    ty: t.y,
    sourcePos: getEdgePosition(source, s),
    targetPos: getEdgePosition(target, t),
  };
}

/** The `floating` edge type: nodes are looked up through the instance on every render. */
export const floatingEdge = defineEdgeType({
  render: (p, flow) => {
    const source = flow.getInternalNode(p.source);
    const target = flow.getInternalNode(p.target);
    if (!source || !target) return { path: svg`` };
    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(boxOf(source), boxOf(target));
    const [path] = getBezierPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sourcePos,
      targetPosition: targetPos,
      targetX: tx,
      targetY: ty,
    });
    return {
      path: svg`<path id=${p.id} class="lit-flow__edge-path" d=${path} fill="none"
        marker-end=${p.markerEnd ?? ''} style=${p.style ?? ''}></path>`,
    };
  },
});

/** Connection line that leaves the source node at its border, like the floating edges. */
export const floatingConnectionLine: ConnectionLineRenderer = (p) => {
  const target: Box = { x: p.toX, y: p.toY, width: 1, height: 1 };
  const { sx, sy } = getEdgeParams(boxOf(p.fromNode), target);
  const [path] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: p.fromPosition,
    targetPosition: p.toPosition,
    targetX: p.toX,
    targetY: p.toY,
  });
  return svg`<g>
    <path fill="none" stroke="#222" stroke-width="1.5" class="animated" d=${path}></path>
    <circle cx=${p.toX} cy=${p.toY} fill="#fff" r="3" stroke="#222" stroke-width="1.5"></circle>
  </g>`;
};

export const floatingEdgeOptions = {
  type: 'floating',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#b1b1b7' },
};
