// Ported from xyflow (MIT) packages/svelte/src/lib/container/EdgeRenderer/MarkerDefinition/Marker.svelte@3d35b57
import { nothing, svg } from 'lit';
import type { SVGTemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { MarkerType } from '@xy-lit/store';
import type { CustomMarkerDef, MarkerDef } from '@xy-lit/store';

function isCustom(def: MarkerDef): def is CustomMarkerDef {
  return (def as { type: string }).type === 'custom';
}

function shape(def: MarkerDef): SVGTemplateResult | typeof nothing {
  if (isCustom(def)) {
    const color = def.color ?? 'none';
    const fill = def.fill === undefined || def.fill === 'stroke' ? color : def.fill;
    return svg`<path d=${def.path} style="stroke:${color};fill:${fill}" stroke-width=${def.strokeWidth ?? nothing}></path>`;
  }
  const color = def.color ?? 'none';
  if (def.type === MarkerType.Arrow) {
    return svg`<polyline class="arrow" style="stroke:${color}" fill="none" stroke-linecap="round"
      stroke-linejoin="round" stroke-width=${def.strokeWidth ?? nothing} points="-5,-4 0,0 -5,4"></polyline>`;
  }
  if (def.type === MarkerType.ArrowClosed) {
    return svg`<polyline class="arrowclosed" style="stroke:${color};fill:${color}" stroke-linecap="round"
      stroke-linejoin="round" stroke-width=${def.strokeWidth ?? nothing} points="-5,-4 0,0 -5,4 -5,-4"></polyline>`;
  }
  return nothing;
}

/**
 * The `<marker>` elements for a flow's `<defs>` (render inside `<svg class="lit-flow__marker">`),
 * keyed by marker id. The defs live in the flow's own tree, so `url('#id')` resolves locally and
 * two flows on one page can both use `1__type=arrow`.
 *
 * @param defs - From `store.getMarkerDefs()`.
 */
export function markerDefs(defs: readonly MarkerDef[]): unknown {
  return repeat(
    defs,
    (m) => m.id,
    (m) => svg`<marker class="lit-flow__arrowhead" id=${m.id}
      markerWidth=${`${m.width ?? 12.5}`} markerHeight=${`${m.height ?? 12.5}`}
      viewBox="-10 -10 20 20" markerUnits=${m.markerUnits ?? 'strokeWidth'}
      orient=${m.orient ?? 'auto-start-reverse'}
      refX=${isCustom(m) ? (m.refX ?? 0) : 0} refY=${isCustom(m) ? (m.refY ?? 0) : 0}>${shape(m)}</marker>`,
  );
}
