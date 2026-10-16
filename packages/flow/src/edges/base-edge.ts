// Ported from xyflow (MIT) packages/svelte/src/lib/components/edges/BaseEdge.svelte@3d35b57
import { nothing, svg } from 'lit';
import type { SVGTemplateResult } from 'lit';

/** Options of {@link baseEdge}. */
export type BaseEdgeOptions = {
  /** `id` of the visible path element. */
  id?: string;
  /** SVG path data. */
  path: string;
  /** `url('#id')` of the start marker (from `props.markerStart`). */
  markerStart?: string;
  /** `url('#id')` of the end marker (from `props.markerEnd`). */
  markerEnd?: string;
  /** Inline style of the visible path. */
  style?: string;
  /** Extra classes of the visible path. */
  class?: string;
  /** Width of the invisible, clickable path. Default 20; 0 omits it. */
  interactionWidth?: number;
};

/**
 * The SVG of an edge: the visible path and a wider, invisible path that makes it easy to hit.
 *
 * @param o - See {@link BaseEdgeOptions}.
 */
export function baseEdge(o: BaseEdgeOptions): SVGTemplateResult {
  const interactionWidth = o.interactionWidth ?? 20;
  return svg`<path id=${o.id ?? nothing} d=${o.path} fill="none"
      class="lit-flow__edge-path ${o.class ?? ''}"
      marker-start=${o.markerStart ?? nothing} marker-end=${o.markerEnd ?? nothing}
      style=${o.style ?? nothing}></path>${
        interactionWidth > 0
          ? svg`<path d=${o.path} fill="none" stroke-opacity="0"
              stroke-width=${interactionWidth} class="lit-flow__edge-interaction"></path>`
          : nothing
      }`;
}
