import type {
  EdgeBase,
  EdgePosition,
  EdgeMarker,
  MarkerProps,
  BezierPathOptions,
  SmoothStepPathOptions,
  StepPathOptions,
} from '../engine.js';
import type { InternalNode } from './nodes.js';

/** Upstream markers plus custom path markers (XY Lit addition). */
export type CustomEdgeMarker = {
  type: 'custom';
  /** SVG path data drawn in a 20x20 viewBox centred on 0,0, pointing towards +x. */
  path: string;
  /** Marker width in `markerUnits`. Default 12.5. */
  width?: number;
  /** Marker height in `markerUnits`. Default 12.5. */
  height?: number;
  /** Reference point x. Default 0. */
  refX?: number;
  /** Reference point y. Default 0. */
  refY?: number;
  /** Stroke colour; falls back to the flow's `defaultMarkerColor`. */
  color?: string | null;
  /** `'stroke'` = same as `color` (default), `'none'` = outline, anything else is a CSS colour. */
  fill?: 'stroke' | 'none' | (string & Record<never, never>);
  /** Stroke width. */
  strokeWidth?: number;
  /** SVG `markerUnits`. Default `'strokeWidth'`. */
  markerUnits?: string;
  /** SVG `orient`. Default `'auto-start-reverse'`. */
  orient?: string;
};

/** A marker definition: upstream arrow markers or a custom path marker. */
export type XYEdgeMarker = EdgeMarker | CustomEdgeMarker;
/** A marker reference: an id string, or a marker definition. */
export type XYEdgeMarkerType = string | XYEdgeMarker;

/** A resolved custom marker, as produced by `getMarkerDefs()`. */
export type CustomMarkerDef = CustomEdgeMarker & { id: string };
/** One `<marker>` definition to render in the flow's `<defs>`. */
export type MarkerDef = MarkerProps | CustomMarkerDef;

/**
 * An edge of the flow. Upstream `EdgeBase` plus the additions of XY Lit.
 *
 * Note: because of {@link CustomEdgeMarker} this type is not assignable to upstream's `EdgeBase`;
 * use the helpers exported from `@xy-lit/store` instead of the upstream graph utilities.
 */
export type Edge<
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeType extends string | undefined = string | undefined,
> = Omit<EdgeBase<EdgeData, EdgeType>, 'markerStart' | 'markerEnd'> & {
  /** Marker at the start of the edge. */
  markerStart?: XYEdgeMarkerType;
  /** Marker at the end of the edge. */
  markerEnd?: XYEdgeMarkerType;
  /** Centre label (plain text, rendered with `edgeText()`). */
  label?: string;
  /** Label near the source end (XY Lit addition). */
  startLabel?: string;
  /** Label near the target end (XY Lit addition). */
  endLabel?: string;
  /** Inline style for the HTML label wrapper (labels are HTML, as in Svelte Flow). */
  labelStyle?: string;
  /** Inline style string for the edge path. */
  style?: string;
  /** Extra classes for the edge. Space-separated string. */
  class?: string;
  /** Whether the edge can receive keyboard focus. Overrides the flow's `edgesFocusable`. */
  focusable?: boolean;
  /** Per-edge reconnect override. */
  reconnectable?: boolean | 'source' | 'target';
  /** Perpendicular offset in px for parallel edges; set by `parallel-edges="spread"` if absent. */
  offset?: number;
  /** ARIA role for the edge group. */
  ariaRole?: string;
  /** Same key rules as `Node.domAttributes`, applied to the edge `<g>`. */
  domAttributes?: Record<string, string>;
  /** Options for the built-in path functions. */
  pathOptions?: BezierPathOptions | SmoothStepPathOptions | StepPathOptions;
};

/** Defaults merged into every edge: all edge fields except identity, endpoints and selection. */
export type DefaultEdgeOptions = Omit<
  Edge,
  'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'selected'
>;

/** Map of edge id to edge, owned by the store (mutated in place). */
export type EdgeLookup<E extends Edge = Edge> = Map<string, E>;

/** What the edge layout pass produces for each visible edge. Identity-stable (see 03-store.md). */
export type EdgeLayouted<E extends Edge = Edge> = E &
  EdgePosition & {
    sourceNode: InternalNode;
    targetNode: InternalNode;
    /** The user edge this was laid out from (for identity comparison). */
    edge: E;
    /** Resolved z-index. */
    zIndex: number;
    /** Resolved offset (explicit `edge.offset`, or assigned by parallel spreading, else 0). */
    resolvedOffset: number;
  };

/** Props passed to edge renderers. */
export type EdgeProps<E extends Edge = Edge> = Omit<
  E,
  'sourceHandle' | 'targetHandle' | 'markerStart' | 'markerEnd'
> &
  EdgePosition & {
    type: string;
    selected: boolean;
    animated: boolean;
    selectable: boolean;
    deletable: boolean;
    sourceHandleId: string | null;
    targetHandleId: string | null;
    /** Ready-to-use `url('#...')` strings, or undefined. */
    markerStart?: string;
    markerEnd?: string;
    /** `resolvedOffset` from the layout pass. */
    offset: number;
    /** Width of the invisible interaction path. Default 20. */
    interactionWidth: number;
  };
