// Ported from xyflow (MIT) packages/svelte/src/lib/components/ConnectionLine/ConnectionLine.svelte, packages/react/src/components/ConnectionLine/index.tsx@3d35b57
import { html, nothing, svg } from 'lit';
import type { SVGTemplateResult, TemplateResult } from 'lit';
import {
  ConnectionLineType,
  getBezierPath,
  getConnectionStatus,
  getSmoothStepPath,
  getStraightPath,
  pointToRendererPoint,
} from '@xy-lit/store/internal';
import type {
  ConnectionState,
  FlowInstance,
  Handle,
  InternalNode,
  Position,
  Transform,
  XYPosition,
} from '@xy-lit/store';
import { getSimpleBezierPath } from './edges/simple-bezier.js';

/** Props passed to a custom connection line renderer. */
export type ConnectionLineProps = {
  /** Start of the line (flow coordinates). */
  fromX: number;
  fromY: number;
  /** End of the line: the pointer, or the snapped handle (flow coordinates). */
  toX: number;
  toY: number;
  /** Side of the start handle. */
  fromPosition: Position;
  /** Side the line arrives on. */
  toPosition: Position;
  /** The node the line starts at. */
  fromNode: InternalNode;
  /** The handle the line starts at. */
  fromHandle: Handle;
  /** The node under the pointer, if any. */
  toNode: InternalNode | null;
  /** The handle under the pointer, if any. */
  toHandle: Handle | null;
  /** `'valid'` / `'invalid'` once a handle is hovered and the flow validates connections. */
  connectionStatus: 'valid' | 'invalid' | null;
  /** The configured `connection-line-type`. */
  connectionLineType: `${ConnectionLineType}`;
  /** The configured `connection-line-style` string. */
  style?: string;
  /** Pointer position, relative to the flow container in pixels (as in React Flow). */
  pointer: XYPosition;
};

/** A function that renders a custom connection line as SVG. */
export type ConnectionLineRenderer = (
  props: ConnectionLineProps,
  flow: FlowInstance,
) => SVGTemplateResult;

/** Options of {@link connectionLine}. */
export type ConnectionLineOptions = {
  /** The connection state from the store. */
  connection: ConnectionState<InternalNode>;
  /** The viewport transform (the line is drawn in flow coordinates). */
  transform: Transform;
  /** Wrapper width in pixels. */
  width: number;
  /** Wrapper height in pixels. */
  height: number;
  /** `nodesConnectable` of the flow: the line is only drawn when connecting is allowed. */
  nodesConnectable: boolean;
  /** Line shape. */
  type: `${ConnectionLineType}`;
  /** Custom renderer. */
  renderer?: ConnectionLineRenderer;
  /** Inline style of the `<svg>` container. */
  containerStyle?: string;
  /** Inline style of the default `<path>`. */
  style?: string;
  /** The flow's instance (passed to custom renderers). */
  instance: FlowInstance;
};

/**
 * The path data of a connection line.
 *
 * @param type - Line shape.
 * @param p - Positions of both ends.
 */
export function getConnectionPath(
  type: `${ConnectionLineType}`,
  p: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition: Position;
  },
): string {
  if (type === (ConnectionLineType.Bezier as string)) return getBezierPath(p)[0];
  if (type === (ConnectionLineType.SimpleBezier as string)) return getSimpleBezierPath(p)[0];
  if (type === (ConnectionLineType.Step as string)) {
    return getSmoothStepPath({ ...p, borderRadius: 0 })[0];
  }
  if (type === (ConnectionLineType.SmoothStep as string)) return getSmoothStepPath(p)[0];
  return getStraightPath(p)[0];
}

/**
 * Render the connection line (inside the viewport, in flow coordinates). Renders nothing unless a
 * connection is in progress.
 *
 * @param o - See {@link ConnectionLineOptions}.
 */
export function connectionLine(o: ConnectionLineOptions): TemplateResult | typeof nothing {
  const c = o.connection;
  if (!c.inProgress || !o.nodesConnectable || !o.width) return nothing;

  // `to` and `pointer` are container-relative screen coordinates; `from` is in flow coordinates
  const to = pointToRendererPoint(c.to, o.transform);
  const status = getConnectionStatus(c.isValid);

  const content = o.renderer
    ? o.renderer(
        {
          fromX: c.from.x,
          fromY: c.from.y,
          toX: to.x,
          toY: to.y,
          fromPosition: c.fromPosition,
          toPosition: c.toPosition,
          fromNode: c.fromNode,
          fromHandle: c.fromHandle,
          toNode: c.toNode,
          toHandle: c.toHandle,
          connectionStatus: status,
          connectionLineType: o.type,
          style: o.style,
          pointer: c.pointer,
        },
        o.instance,
      )
    : svg`<path d=${getConnectionPath(o.type, {
        sourceX: c.from.x,
        sourceY: c.from.y,
        sourcePosition: c.fromPosition,
        targetX: to.x,
        targetY: to.y,
        targetPosition: c.toPosition,
      })} fill="none" class="lit-flow__connection-path" style=${o.style ?? nothing}></path>`;

  return html`<svg
    class="lit-flow__connectionline lit-flow__container"
    width=${o.width}
    height=${o.height}
    style=${o.containerStyle ?? nothing}
  >
    <g class="lit-flow__connection ${status ?? ''}">${content}</g>
  </svg>`;
}
