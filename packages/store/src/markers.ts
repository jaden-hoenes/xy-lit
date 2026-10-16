import { createMarkerIds, getMarkerId } from './engine.js';
import type { EdgeBase, EdgeMarker } from './engine.js';
import type {
  CustomEdgeMarker,
  CustomMarkerDef,
  DefaultEdgeOptions,
  Edge,
  MarkerDef,
  XYEdgeMarkerType,
} from './types/edges.js';

function isCustomMarker(marker: XYEdgeMarkerType | undefined): marker is CustomEdgeMarker {
  return typeof marker === 'object' && marker.type === 'custom';
}

/** Stable JSON of a marker: keys sorted, `undefined` values dropped. */
function stableJson(marker: object): string {
  const entries = Object.entries(marker)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(Object.fromEntries(entries));
}

/** 32-bit FNV-1a hash of a string, base36. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Id of a custom marker: `${flowId}__custom-${hash}` where `hash` is the FNV-1a (32-bit, base36)
 * hash of the marker's JSON with sorted keys.
 *
 * @param marker - The custom marker.
 * @param flowId - Id of the flow (ids are unique per flow, not per page).
 */
export function getCustomMarkerId(marker: CustomEdgeMarker, flowId: string): string {
  return `${flowId}__custom-${fnv1a(stableJson(marker))}`;
}

/**
 * The id a marker reference resolves to: strings are used as-is, upstream marker objects get the
 * upstream id (`1__type=arrowclosed`), custom markers get {@link getCustomMarkerId}.
 *
 * @param marker - Marker reference of an edge.
 * @param flowId - Id of the flow.
 */
export function resolveMarkerId(marker: XYEdgeMarkerType, flowId: string): string {
  if (typeof marker === 'string') return marker;
  if (isCustomMarker(marker)) return getCustomMarkerId(marker, flowId);
  return getMarkerId(marker, flowId);
}

/**
 * The `url('#id')` reference for a marker, ready for `marker-start` / `marker-end`.
 *
 * @param marker - Marker reference of an edge, or undefined.
 * @param flowId - Id of the flow.
 * @returns The url, or undefined when there is no marker.
 */
export function getMarkerUrl(
  marker: XYEdgeMarkerType | undefined,
  flowId: string,
): string | undefined {
  if (!marker) return undefined;
  return `url('#${resolveMarkerId(marker, flowId)}')`;
}

/**
 * Collect the `<marker>` definitions needed by a set of edges. Upstream markers go through
 * `createMarkerIds` (so ids look like `1__type=arrowclosed`), custom markers get a hashed id and
 * one definition per distinct spec.
 *
 * @param edges - All edges.
 * @param options.flowId - Id of the flow.
 * @param options.defaultColor - Colour for markers without one.
 * @param options.defaultEdgeOptions - Supplies `markerStart` / `markerEnd` defaults.
 * @returns Upstream definitions sorted by id, then custom definitions sorted by id.
 */
export function createMarkerDefs<E extends Edge = Edge>(
  edges: readonly E[],
  options: {
    flowId: string;
    defaultColor: string | null;
    defaultEdgeOptions?: DefaultEdgeOptions;
  },
): MarkerDef[] {
  const { flowId, defaultColor, defaultEdgeOptions } = options;
  const upstream: EdgeBase[] = [];
  const custom = new Map<string, CustomMarkerDef>();

  const consider = (marker: XYEdgeMarkerType | undefined): EdgeMarker | undefined => {
    if (!marker || typeof marker === 'string') return undefined;
    if (isCustomMarker(marker)) {
      const id = getCustomMarkerId(marker, flowId);
      if (!custom.has(id)) {
        custom.set(id, { ...marker, color: marker.color || defaultColor, id });
      }
      return undefined;
    }
    return marker;
  };

  for (const edge of edges) {
    const markerStart = consider(edge.markerStart || defaultEdgeOptions?.markerStart);
    const markerEnd = consider(edge.markerEnd || defaultEdgeOptions?.markerEnd);
    if (markerStart || markerEnd) {
      upstream.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        markerStart,
        markerEnd,
      });
    }
  }

  const upstreamDefs = createMarkerIds(upstream, { id: flowId, defaultColor });
  const customDefs = [...custom.values()].sort((a, b) => a.id.localeCompare(b.id));
  return [...upstreamDefs, ...customDefs];
}
