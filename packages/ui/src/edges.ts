import { html, nothing, svg } from 'lit';
import {
  baseEdge,
  defineEdgeType,
  edgeLabel,
  getBezierPath,
  getOffsetBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from '@xy-lit/flow';
import type { Edge, EdgeProps } from '@xy-lit/flow';
import { uiStyles } from './styles.js';

/** The path shapes the edges of this module can draw. */
export type EdgePathType = 'bezier' | 'smoothstep' | 'step' | 'straight';

/** `data` of a {@link buttonEdge}. */
export type ButtonEdgeData = {
  /** Path shape. Default `bezier`. */
  pathType?: EdgePathType;
  [key: string]: unknown;
};

/** `data` of a {@link dataEdge}. */
export type DataEdgeData = {
  /** The key whose value is shown as the label. */
  key: string;
  /** Path shape. Default `bezier`. */
  pathType?: EdgePathType;
  [key: string]: unknown;
};

/** `data` of an {@link animatedSvgEdge}. */
export type AnimatedSvgEdgeData = {
  /** Time of one trip: a CSS time (`'2s'`, `'800ms'`) or seconds. Default `'2s'`. */
  duration?: string | number;
  /** Radius of the travelling dot. Default 4. */
  radius?: number;
  /** Path shape. Default `bezier`. */
  pathType?: EdgePathType;
  [key: string]: unknown;
};

const positions = (p: EdgeProps) => ({
  sourceX: p.sourceX,
  sourceY: p.sourceY,
  sourcePosition: p.sourcePosition,
  targetX: p.targetX,
  targetY: p.targetY,
  targetPosition: p.targetPosition,
});

/** Path data and label point for one of the supported shapes. */
function pathOf(p: EdgeProps, type: EdgePathType | undefined): [string, number, number] {
  switch (type) {
    case 'straight': {
      const [d, x, y] = getStraightPath(positions(p));
      return [d, x, y];
    }
    case 'step': {
      const [d, x, y] = getSmoothStepPath({ ...positions(p), borderRadius: 0 });
      return [d, x, y];
    }
    case 'smoothstep': {
      const [d, x, y] = getSmoothStepPath(positions(p));
      return [d, x, y];
    }
    default: {
      const [d, x, y] = p.offset
        ? getOffsetBezierPath(positions(p), p.offset)
        : getBezierPath(positions(p));
      return [d, x, y];
    }
  }
}

const dataOf = <T extends Record<string, unknown>>(p: EdgeProps): T =>
  (p.data ?? {}) as unknown as T;

/**
 * A bezier edge with a small round "×" button at its label point that deletes the edge. The
 * button has the classes `nodrag nopan` and an accessible name ("Delete edge"). Set
 * `data.pathType` for another path shape.
 */
export const buttonEdge = defineEdgeType<Edge<ButtonEdgeData>>({
  styles: uiStyles,
  render: (p, flow) => {
    const [path, x, y] = pathOf(p, dataOf<ButtonEdgeData>(p).pathType);
    return {
      path: baseEdge({
        id: p.id,
        path,
        markerStart: p.markerStart,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      }),
      label: edgeLabel(
        flow,
        { edgeId: p.id, x, y, transparent: true },
        html`<button
          type="button"
          class="xy-ui-edge-button nodrag nopan"
          aria-label="Delete edge"
          @click=${(e: Event) => {
            e.stopPropagation();
            void flow.deleteElements({ edges: [{ id: p.id }] });
          }}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>`,
      ),
    };
  },
});

const format = (value: unknown): string =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

/**
 * A bezier edge that shows a value as its label. The value is `edge.data[edge.data.key]`; when the
 * edge has no such field, the same key of the **source node's** `data` is used (read when the edge
 * renders, so it does not update when only the source node's data changes). Nothing is shown when
 * neither has it. Set `data.pathType` for another path shape.
 */
export const dataEdge = defineEdgeType<Edge<DataEdgeData>>({
  styles: uiStyles,
  render: (p, flow) => {
    const data = dataOf<DataEdgeData>(p);
    const [path, x, y] = pathOf(p, data.pathType);
    const value = data[data.key] ?? flow.getNode(p.source)?.data?.[data.key];
    return {
      path: baseEdge({
        id: p.id,
        path,
        markerStart: p.markerStart,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      }),
      label:
        value === undefined || value === null
          ? nothing
          : edgeLabel(
              flow,
              { edgeId: p.id, x, y, selectEdgeOnClick: true, class: 'xy-ui-data-edge' },
              html`<span class="xy-ui-data-edge__key">${data.key}</span
                ><span class="xy-ui-data-edge__value">${format(value)}</span>`,
            ),
    };
  },
});

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * A bezier edge with a dot that travels from source to target
 * (`<animateMotion repeatCount="indefinite">`). `data.duration` sets the time of one trip
 * (default `'2s'`). With `prefers-reduced-motion` the dot rests in the middle of the edge.
 */
export const animatedSvgEdge = defineEdgeType<Edge<AnimatedSvgEdgeData>>({
  styles: uiStyles,
  render: (p) => {
    const data = dataOf<AnimatedSvgEdgeData>(p);
    const [path, labelX, labelY] = pathOf(p, data.pathType);
    const duration =
      typeof data.duration === 'number' ? `${data.duration}s` : (data.duration ?? '2s');
    const radius = data.radius ?? 4;
    return {
      path: svg`${baseEdge({
        id: p.id,
        path,
        markerStart: p.markerStart,
        markerEnd: p.markerEnd,
        style: p.style,
        interactionWidth: p.interactionWidth,
      })}${
        reducedMotion()
          ? svg`<circle class="xy-ui-edge-dot" r=${radius} cx=${labelX} cy=${labelY}></circle>`
          : svg`<circle class="xy-ui-edge-dot" r=${radius}><animateMotion dur=${duration} repeatCount="indefinite" path=${path}></animateMotion></circle>`
      }`,
    };
  },
});
