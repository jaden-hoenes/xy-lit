import { LitElement, css, html, nothing, svg } from 'lit';
import RBush from 'rbush';
import type { InternalNode, NodeChange, NodePositionChange, Rect } from '@xy-lit/store';
import type { XyFlowElement } from '@xy-lit/flow';
import { withStore } from '../common.js';
import type { Disposer } from '../common.js';

/** The alignment guides to draw, in flow coordinates. */
export interface HelperGuides {
  /** A vertical line at `x` from `y1` to `y2`. */
  vertical?: { x: number; y1: number; y2: number };
  /** A horizontal line at `y` from `x1` to `x2`. */
  horizontal?: { y: number; x1: number; x2: number };
}

/** Options of {@link installHelperLines}. */
export interface HelperLinesOptions {
  /** Distance in screen pixels within which edges and centres align. Default 6. */
  threshold?: number;
  /** Also move the dragged node onto the guide. Default true. */
  snap?: boolean;
  /** Called whenever the guides change (`null` when the drag ends). */
  onChange?: (guides: HelperGuides | null) => void;
  /** Append a `<xy-helper-lines>` to the flow to draw the guides. Default true. */
  render?: boolean;
}

/** The handle `installHelperLines` returns: call it to uninstall. */
export type InstalledHelperLines = Disposer & {
  /** The guides of the drag in progress, or null. */
  readonly guides: HelperGuides | null;
};

/**
 * `<xy-helper-lines>`: draws up to two alignment guides in flow coordinates, in the
 * `viewport-front` slot. `installHelperLines` appends and drives it; it has no attributes you
 * need to set by hand.
 *
 * @tag xy-helper-lines
 * @cssprop --xy-helper-line-color - Colour of the guides. Default `#ff0071`.
 * @csspart line - Both guide lines.
 * @csspart vertical - The vertical guide.
 * @csspart horizontal - The horizontal guide.
 * @csspart svg - The overlay SVG.
 */
export class XyHelperLinesElement extends LitElement {
  static override properties = {
    guides: { attribute: false },
    zoom: { type: Number },
  };

  /** The guides to draw (`null` draws nothing). Property only. */
  declare guides: HelperGuides | null;
  /** Current viewport zoom, used to keep the line width at one screen pixel. */
  declare zoom: number;

  static override styles = css`
    :host {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      overflow: visible;
      pointer-events: none;
    }
    svg {
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 1px;
      overflow: visible;
    }
    line {
      stroke: var(--xy-helper-line-color, #ff0071);
    }
  `;

  constructor() {
    super();
    this.guides = null;
    this.zoom = 1;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('slot')) this.setAttribute('slot', 'viewport-front');
    this.setAttribute('aria-hidden', 'true');
  }

  protected override render(): unknown {
    const g = this.guides;
    if (!g) return nothing;
    const width = 1 / (this.zoom || 1);
    return html`<svg part="svg">
      ${
        g.vertical
          ? svg`<line part="line vertical" x1=${g.vertical.x} y1=${g.vertical.y1} x2=${g.vertical.x} y2=${g.vertical.y2} stroke-width=${width}></line>`
          : nothing
      }
      ${
        g.horizontal
          ? svg`<line part="line horizontal" x1=${g.horizontal.x1} y1=${g.horizontal.y} x2=${g.horizontal.x2} y2=${g.horizontal.y} stroke-width=${width}></line>`
          : nothing
      }
    </svg>`;
  }
}

/** Register `<xy-helper-lines>` (idempotent). `installHelperLines` does it for you. */
export function defineHelperLines(): void {
  if (!customElements.get('xy-helper-lines')) {
    customElements.define('xy-helper-lines', XyHelperLinesElement);
  }
}

type Entry = { minX: number; minY: number; maxX: number; maxY: number };
const FAR = 1e9;

interface Snap {
  dx: number;
  dy: number;
  guides: HelperGuides | null;
}

/** Closest alignment between the anchors of `moving` and of the rects in `others`. */
function align(
  moving: Rect,
  others: Entry[],
  range: number,
  axis: 'x' | 'y',
): { delta: number; at: number; other: Entry } | null {
  const lo = axis === 'x' ? moving.x : moving.y;
  const size = axis === 'x' ? moving.width : moving.height;
  const mine = { start: lo, mid: lo + size / 2, end: lo + size };
  let best: { delta: number; at: number; other: Entry } | null = null;
  for (const o of others) {
    const olo = axis === 'x' ? o.minX : o.minY;
    const ohi = axis === 'x' ? o.maxX : o.maxY;
    const theirs = { start: olo, mid: (olo + ohi) / 2, end: ohi };
    const pairs: [number, number][] = [
      [mine.start, theirs.start],
      [mine.start, theirs.end],
      [mine.end, theirs.start],
      [mine.end, theirs.end],
      [mine.mid, theirs.mid],
    ];
    for (const [m, t] of pairs) {
      const delta = t - m;
      if (Math.abs(delta) <= range && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, at: t, other: o };
      }
    }
  }
  return best;
}

/**
 * Alignment guides and snapping while one node is dragged. A node change middleware looks at
 * position changes of `start`, `live` and `end` phases (the engine's `end` carries the raw
 * pointer position, so it is snapped too) for a single dragged node, compares the dragged
 * rectangle with the other visible nodes (an `rbush` of their absolute rectangles, built once
 * per gesture), and when an edge or the centre lies within `threshold` screen pixels it moves
 * the change onto the guide (`snap`) and publishes the guides. Multi-node drags are left alone.
 *
 * Other middlewares compose with it: install it after `LocalHistory` or before, the history
 * does not depend on the order.
 */
export function installHelperLines(
  flow: XyFlowElement,
  options: HelperLinesOptions = {},
): InstalledHelperLines {
  const threshold = options.threshold ?? 6;
  const snap = options.snap ?? true;
  let guides: HelperGuides | null = null;
  let element: XyHelperLinesElement | null = null;
  let index: RBush<Entry> | null = null;
  let indexFor: string | null = null;

  const publish = (next: HelperGuides | null): void => {
    guides = next;
    if (element) {
      element.guides = next;
      element.zoom = flow.hasStore ? flow.store.getState().transform[2] : 1;
    }
    options.onChange?.(next);
  };

  const stop = withStore(flow, (store) => {
    if (options.render ?? true) {
      defineHelperLines();
      element = document.createElement('xy-helper-lines') as XyHelperLinesElement;
      flow.append(element);
    }

    const build = (draggedId: string): RBush<Entry> => {
      const { nodeLookup } = store.getState();
      // the dragged node, its descendants and its ancestors are no alignment targets
      const skip = new Set<string>([draggedId]);
      for (let p = nodeLookup.get(draggedId)?.parentId; p; p = nodeLookup.get(p)?.parentId) {
        skip.add(p);
      }
      const isDescendant = (n: InternalNode): boolean => {
        for (let p = n.parentId; p; p = nodeLookup.get(p)?.parentId)
          if (p === draggedId) return true;
        return false;
      };
      const tree = new RBush<Entry>();
      const items: Entry[] = [];
      for (const n of store.getVisibleNodes()) {
        if (skip.has(n.id) || isDescendant(n)) continue;
        const w = n.measured.width ?? n.width;
        const h = n.measured.height ?? n.height;
        if (!w || !h) continue;
        const { x, y } = n.internals.positionAbsolute;
        items.push({ minX: x, minY: y, maxX: x + w, maxY: y + h });
      }
      tree.load(items);
      return tree;
    };

    const compute = (change: NodePositionChange): Snap | null => {
      const { nodeLookup, transform } = store.getState();
      const node = nodeLookup.get(change.id);
      if (!node || !change.position) return null;
      const w = node.measured.width ?? node.width;
      const h = node.measured.height ?? node.height;
      if (!w || !h) return null;
      const abs = {
        x: node.internals.positionAbsolute.x + (change.position.x - node.position.x),
        y: node.internals.positionAbsolute.y + (change.position.y - node.position.y),
      };
      const rect: Rect = { x: abs.x, y: abs.y, width: w, height: h };
      if (index === null || indexFor !== change.id) {
        index = build(change.id);
        indexFor = change.id;
      }
      const range = threshold / transform[2];
      // candidates: anything whose extent touches the dragged rect's band (+range) on the other axis
      const vertical = index.search({
        minX: rect.x - range,
        maxX: rect.x + rect.width + range,
        minY: -FAR,
        maxY: FAR,
      });
      const horizontal = index.search({
        minX: -FAR,
        maxX: FAR,
        minY: rect.y - range,
        maxY: rect.y + rect.height + range,
      });
      const v = align(rect, vertical, range, 'x');
      const hz = align(rect, horizontal, range, 'y');
      if (!v && !hz) return { dx: 0, dy: 0, guides: null };
      const dx = v ? v.delta : 0;
      const dy = hz ? hz.delta : 0;
      const snapped = { x: rect.x + dx, y: rect.y + dy, w, h };
      const found: HelperGuides = {};
      if (v) {
        found.vertical = {
          x: v.at,
          y1: Math.min(snapped.y, v.other.minY),
          y2: Math.max(snapped.y + h, v.other.maxY),
        };
      }
      if (hz) {
        found.horizontal = {
          y: hz.at,
          x1: Math.min(snapped.x, hz.other.minX),
          x2: Math.max(snapped.x + w, hz.other.maxX),
        };
      }
      return { dx, dy, guides: found };
    };

    const off = store.addNodeChangeMiddleware((changes, meta) => {
      if (meta.phase === 'discrete' || meta.origin !== 'drag') return changes;
      const moves = changes.filter(
        (c): c is NodePositionChange => c.type === 'position' && !!c.position,
      );
      if (moves.length !== 1) {
        // multi-node drags are not aligned
        if (meta.phase === 'end') {
          index = null;
          indexFor = null;
          if (guides) publish(null);
        }
        return changes;
      }
      const move = moves[0]!;
      const result = compute(move);
      let out = changes;
      if (result) {
        if (snap && (result.dx || result.dy)) {
          const snapped: NodeChange = {
            ...move,
            position: { x: move.position!.x + result.dx, y: move.position!.y + result.dy },
          };
          out = changes.map((c) => (c === move ? snapped : c));
        }
        if (meta.phase !== 'end') publish(result.guides);
      }
      if (meta.phase === 'end') {
        index = null;
        indexFor = null;
        if (guides) publish(null);
      }
      return out;
    });

    return () => {
      off();
      element?.remove();
      element = null;
      index = null;
      guides = null;
    };
  });

  const installed = (() => {
    stop();
  }) as InstalledHelperLines;
  Object.defineProperty(installed, 'guides', { get: () => guides });
  return installed;
}
