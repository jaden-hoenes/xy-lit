// Ported from xyflow (MIT) packages/svelte/src/lib/components/edges/*EdgeInternal.svelte@3d35b57
import {
  getBezierPath,
  getEdgeEndLabelPosition,
  getSmoothStepPath,
  getStraightPath,
} from '@xy-lit/store';
import type {
  BezierPathOptions,
  EdgeProps,
  FlowInstance,
  SmoothStepPathOptions,
  StepPathOptions,
} from '@xy-lit/store';
import { baseEdge } from './base-edge.js';
import { defineEdgeType } from './define-edge-type.js';
import type { EdgeRenderResult, EdgeTypes } from './define-edge-type.js';
import { edgeText } from './edge-text.js';
import { getOffsetBezierPath, getOffsetStraightPath, offsetStepPosition } from './offset-bezier.js';
import { getSimpleBezierPath } from './simple-bezier.js';

const positions = (p: EdgeProps) => ({
  sourceX: p.sourceX,
  sourceY: p.sourceY,
  sourcePosition: p.sourcePosition,
  targetX: p.targetX,
  targetY: p.targetY,
  targetPosition: p.targetPosition,
});

/**
 * Assemble the render result every built-in edge returns: the base edge plus the centre, start and
 * end text labels.
 */
function withLabels(
  p: EdgeProps,
  flow: FlowInstance,
  path: string,
  labelX: number,
  labelY: number,
): EdgeRenderResult {
  const base = baseEdge({
    id: p.id,
    path,
    markerStart: p.markerStart,
    markerEnd: p.markerEnd,
    style: p.style,
    interactionWidth: p.interactionWidth,
  });
  return {
    path: base,
    label: p.label ? edgeText(flow, p, p.label, { x: labelX, y: labelY }) : undefined,
    startLabel: p.startLabel
      ? edgeText(flow, p, p.startLabel, getEdgeEndLabelPosition(p, { end: 'source' }))
      : undefined,
    endLabel: p.endLabel
      ? edgeText(flow, p, p.endLabel, getEdgeEndLabelPosition(p, { end: 'target' }))
      : undefined,
  };
}

/** `stepPosition` of a step edge: an explicit option wins, else the parallel offset shifts it. */
const stepPosition = (p: EdgeProps, explicit: number | undefined): number | undefined =>
  explicit ?? (p.offset ? offsetStepPosition(positions(p), p.offset) : undefined);

/** `default`: a cubic bezier curve. */
export const bezierEdge = defineEdgeType({
  render: (p, flow) => {
    const curvature = (p.pathOptions as BezierPathOptions | undefined)?.curvature;
    // `p.offset` is the parallel-edge offset resolved by the layout (0 or undefined: none)
    const [path, labelX, labelY] = p.offset
      ? getOffsetBezierPath(positions(p), p.offset, curvature)
      : getBezierPath({ ...positions(p), curvature });
    return withLabels(p, flow, path, labelX, labelY);
  },
});

/** `simplebezier`: a bezier curve with control points on the handle axes. */
export const simpleBezierEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, labelX, labelY] = getSimpleBezierPath(positions(p));
    return withLabels(p, flow, path, labelX, labelY);
  },
});

/** `straight`: a straight line. */
export const straightEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, labelX, labelY] = p.offset
      ? getOffsetStraightPath(positions(p), p.offset)
      : getStraightPath(positions(p));
    return withLabels(p, flow, path, labelX, labelY);
  },
});

/** `step`: right angles, sharp corners. */
export const stepEdge = defineEdgeType({
  render: (p, flow) => {
    const options = p.pathOptions as StepPathOptions | undefined;
    const [path, labelX, labelY] = getSmoothStepPath({
      ...positions(p),
      borderRadius: 0,
      offset: options?.offset,
      stepPosition: stepPosition(
        p,
        (options as { stepPosition?: number } | undefined)?.stepPosition,
      ),
    });
    return withLabels(p, flow, path, labelX, labelY);
  },
});

/** `smoothstep`: right angles, rounded corners. */
export const smoothStepEdge = defineEdgeType({
  render: (p, flow) => {
    const options = p.pathOptions as SmoothStepPathOptions | undefined;
    const [path, labelX, labelY] = getSmoothStepPath({
      ...positions(p),
      borderRadius: options?.borderRadius,
      offset: options?.offset,
      stepPosition: stepPosition(p, options?.stepPosition),
    });
    return withLabels(p, flow, path, labelX, labelY);
  },
});

/** The edge types every flow has; user `edgeTypes` entries win over these. */
export const builtinEdgeTypes: EdgeTypes = {
  default: bezierEdge,
  simplebezier: simpleBezierEdge,
  straight: straightEdge,
  step: stepEdge,
  smoothstep: smoothStepEdge,
};
