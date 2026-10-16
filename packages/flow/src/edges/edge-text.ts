// Ported from xyflow (MIT) packages/svelte/src/lib/components/EdgeLabel/EdgeLabel.svelte@3d35b57
import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { getStoreOf } from '@xy-lit/store/internal';
import type { FlowInstance, XYPosition } from '@xy-lit/store';

/** Options of {@link edgeLabel}. */
export type EdgeLabelOptions = {
  /** Id of the edge the label belongs to. */
  edgeId: string;
  /** Centre of the label, in flow coordinates. */
  x: number;
  y: number;
  /** z-index; defaults to the edge's laid-out z-index. */
  zIndex?: number;
  /** Extra classes. */
  class?: string;
  /** Extra inline style. */
  style?: string;
  /** Select the edge when the label is clicked. */
  selectEdgeOnClick?: boolean;
  /** Transparent background and no padding. */
  transparent?: boolean;
  /** Fixed width in px. */
  width?: number;
  /** Fixed height in px. */
  height?: number;
};

/**
 * The positioned wrapper every edge label goes through. The result is meant to be returned as
 * `label`, `startLabel` or `endLabel` of an edge renderer; the flow renders it in its HTML label
 * layer. `content` is rendered as a Lit child, so plain strings become text.
 *
 * @param flow - The instance the renderer received.
 * @param o - See {@link EdgeLabelOptions}.
 * @param content - Anything Lit can render.
 */
export function edgeLabel(
  flow: FlowInstance,
  o: EdgeLabelOptions,
  content: unknown,
): TemplateResult {
  const store = getStoreOf(flow);
  const zIndex = o.zIndex ?? store.getLayoutedEdges().get(o.edgeId)?.zIndex;
  const style =
    `transform:translate(-50%,-50%) translate(${o.x}px,${o.y}px);pointer-events:all;` +
    (zIndex != null ? `z-index:${zIndex};` : '') +
    (o.width ? `width:${o.width}px;` : '') +
    (o.height ? `height:${o.height}px;` : '') +
    (o.selectEdgeOnClick ? 'cursor:pointer;' : '') +
    (o.style ?? '');
  // prettier-ignore
  return html`<div class="lit-flow__edge-label ${o.transparent ? 'transparent' : ''} nopan ${o.class ?? ''}" data-edge-id=${o.edgeId} style=${style} tabindex="-1" @click=${o.selectEdgeOnClick ? () => store.handleEdgeSelection(o.edgeId) : nothing}>${content}</div>`;
}

/**
 * A text label for an edge: `edgeLabel()` with the edge's `labelStyle`, selecting the edge on
 * click. The text is always rendered as text, never as HTML.
 *
 * @param flow - The instance the renderer received.
 * @param props - The edge's props (`id`, `labelStyle`).
 * @param text - The label text.
 * @param position - Centre of the label, in flow coordinates.
 */
export function edgeText(
  flow: FlowInstance,
  props: { id: string; labelStyle?: string },
  text: string,
  position: XYPosition,
): TemplateResult {
  return edgeLabel(
    flow,
    { edgeId: props.id, ...position, style: props.labelStyle, selectEdgeOnClick: true },
    text,
  );
}
