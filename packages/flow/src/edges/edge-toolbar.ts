// Ported from xyflow (MIT) packages/react/src/additional-components/EdgeToolbar/EdgeToolbar.tsx@3d35b57
import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import type { FlowInstance } from '@xy-lit/store';
import { getStoreOf } from '@xy-lit/store/internal';
import { edgeLabel } from './edge-text.js';

/** Options of {@link edgeToolbar}. */
export type EdgeToolbarOptions = {
  /** Id of the edge the toolbar belongs to. */
  edgeId: string;
  /** Anchor x in flow coordinates (usually the edge's label x). */
  x: number;
  /** Anchor y in flow coordinates. */
  y: number;
  /** Horizontal alignment of the toolbar to the anchor. Default `center`. */
  alignX?: 'left' | 'center' | 'right';
  /** Vertical alignment of the toolbar to the anchor. Default `center`. */
  alignY?: 'top' | 'center' | 'bottom';
  /** Show or hide. Default: `selected`. */
  isVisible?: boolean;
  /** Fallback for `isVisible`: pass the edge's `selected` prop. */
  selected?: boolean;
  /** Extra classes of the toolbar element. */
  class?: string;
};

const PERCENT_X = { left: 0, center: 50, right: 100 } as const;
const PERCENT_Y = { top: 0, center: 50, bottom: 100 } as const;

/**
 * A toolbar beside an edge that keeps its size when the viewport zooms (React `EdgeToolbar`).
 * Return it as the `label` of a custom edge type. Visible while `isVisible` (default `selected`).
 *
 * The counter-scale uses the `--xy-zoom` custom property that `<xy-flow>` keeps on its viewport,
 * so the toolbar follows zoom changes without re-rendering the edge.
 *
 * @param flow - The instance the edge renderer received.
 * @param o - See {@link EdgeToolbarOptions}.
 * @param content - The toolbar content.
 * @example
 * render: (p, flow) => {
 *   const [path, x, y] = getBezierPath(p);
 *   return {
 *     path: baseEdge({ id: p.id, path }),
 *     label: edgeToolbar(flow, { edgeId: p.id, x, y, selected: p.selected }, html`<button>edit</button>`),
 *   };
 * }
 */
export function edgeToolbar(
  flow: FlowInstance,
  o: EdgeToolbarOptions,
  content: unknown,
): TemplateResult | typeof nothing {
  if (!(o.isVisible ?? o.selected)) return nothing;
  const alignX = PERCENT_X[o.alignX ?? 'center'];
  const alignY = PERCENT_Y[o.alignY ?? 'center'];
  const transform = `translate(${o.x}px, ${o.y}px) scale(calc(1 / var(--xy-zoom, 1))) translate(${-alignX}%, ${-alignY}%)`;
  const zIndex = (getStoreOf(flow).getLayoutedEdges().get(o.edgeId)?.zIndex ?? 0) + 1;
  // prettier-ignore
  return edgeLabel(
    flow,
    { edgeId: o.edgeId, x: 0, y: 0, transparent: true, zIndex },
    html`<div class="lit-flow__edge-toolbar ${o.class ?? ''}" data-id=${o.edgeId} style="position:absolute;transform:${transform};transform-origin:0 0">${content}</div>`,
  );
}
