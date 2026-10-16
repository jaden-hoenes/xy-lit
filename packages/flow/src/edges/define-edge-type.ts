import type { CSSResultGroup, SVGTemplateResult, TemplateResult, nothing } from 'lit';
import type { Edge, EdgeProps, FlowInstance } from '@xy-lit/store';

/** What an edge renderer returns. */
export type EdgeRenderResult = {
  /** SVG content placed inside the edge's `<g>`. Usually `baseEdge(...)`. */
  path: SVGTemplateResult;
  /** HTML rendered in the edge-label layer (flow coordinates). */
  label?: TemplateResult | typeof nothing;
  /** Label near the source end. */
  startLabel?: TemplateResult | typeof nothing;
  /** Label near the target end. */
  endLabel?: TemplateResult | typeof nothing;
};

/** A function that renders one edge. */
export type EdgeRenderer<E extends Edge = Edge> = (
  props: EdgeProps<E>,
  flow: FlowInstance,
) => EdgeRenderResult;

/** An edge type (see {@link defineEdgeType}). */
export type EdgeTypeDefinition<E extends Edge = Edge> = {
  readonly kind: 'edge-renderer';
  /** Renders the edge. */
  readonly render: EdgeRenderer<E>;
  /** Adopted into the flow root once per flow, deduplicated by object identity. */
  readonly styles?: CSSResultGroup;
};

/**
 * Define an edge type.
 *
 * @param def.render - Returns the SVG path and optional HTML labels.
 * @param def.styles - CSS adopted into the flow root.
 * @example
 * const buttonEdge = defineEdgeType({
 *   render: (p, flow) => {
 *     const [path, x, y] = getBezierPath(p);
 *     return {
 *       path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd }),
 *       label: edgeLabel(flow, { edgeId: p.id, x, y }, html`<button>x</button>`),
 *     };
 *   },
 * });
 */
export function defineEdgeType<E extends Edge = Edge>(def: {
  render: EdgeRenderer<E>;
  styles?: CSSResultGroup;
}): EdgeTypeDefinition<E> {
  return Object.freeze({ kind: 'edge-renderer' as const, ...def });
}

/** Map of edge `type` to how it is rendered. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- edge data is invariant in the entry types
export type EdgeTypes = Record<string, EdgeTypeDefinition<any>>;
