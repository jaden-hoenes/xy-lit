import { Position } from '@xy-lit/flow';
import type { Rect } from '@xy-lit/flow';

/** A connection point of a shape, in the shape's own coordinates (origin top-left). */
export type ShapeHandle = {
  /** Handle id used in `sourceHandle` / `targetHandle` of edges. */
  id: string;
  /** Side the connection leaves or enters from (drives the edge's curve direction). */
  position: Position | `${Position}`;
  /** Centre of the handle. */
  x: number;
  y: number;
  /** Render only a `source` or a `target` handle. Default: both, stacked. */
  type?: 'source' | 'target';
};

/** How a shape is drawn and where its handles and text go. Sizes are the node's width and height. */
export type ShapeDefinition = {
  /** SVG path data (`d`) of the outline, drawn in a `0 0 w h` box. */
  path(w: number, h: number): string;
  /** Connection points. */
  handles(w: number, h: number): ShapeHandle[];
  /** The area the label may use. */
  textBox(w: number, h: number): Rect;
};

/** A name-to-definition map of shapes. */
export class ShapeRegistry {
  readonly #shapes = new Map<string, ShapeDefinition>();

  /** @param initial - Definitions to start with (for example `defaultShapes.entries()`). */
  constructor(initial?: Iterable<[string, ShapeDefinition]>) {
    if (initial) for (const [name, def] of initial) this.#shapes.set(name, def);
  }

  /**
   * Add or replace a shape.
   *
   * @param name - The shape name, used as `data.shape`.
   * @param def - The definition.
   * @returns The registry, for chaining.
   */
  register(name: string, def: ShapeDefinition): this {
    this.#shapes.set(name, def);
    return this;
  }

  /** The definition of a shape, if registered. */
  get(name: string): ShapeDefinition | undefined {
    return this.#shapes.get(name);
  }

  /** Whether a shape is registered. */
  has(name: string): boolean {
    return this.#shapes.has(name);
  }

  /** Registered names, in registration order. */
  names(): string[] {
    return [...this.#shapes.keys()];
  }

  /** `[name, definition]` pairs. */
  entries(): IterableIterator<[string, ShapeDefinition]> {
    return this.#shapes.entries();
  }

  /** A copy that can be extended without touching this registry. */
  clone(): ShapeRegistry {
    return new ShapeRegistry(this.#shapes);
  }
}

const r = (n: number): number => Math.round(n * 100) / 100;
const pts = (points: [number, number][]): string =>
  `M${points.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z`;

/** The four mid-edge points of the bounding box. */
const boxHandles = (w: number, h: number): ShapeHandle[] => [
  { id: 'top', position: Position.Top, x: w / 2, y: 0 },
  { id: 'right', position: Position.Right, x: w, y: h / 2 },
  { id: 'bottom', position: Position.Bottom, x: w / 2, y: h },
  { id: 'left', position: Position.Left, x: 0, y: h / 2 },
];

const inset = (w: number, h: number, dx: number, dy = dx): Rect => ({
  x: dx,
  y: dy,
  width: Math.max(0, w - 2 * dx),
  height: Math.max(0, h - 2 * dy),
});

/** A shape registry with: rectangle, rounded-rectangle, circle, ellipse, diamond, hexagon, parallelogram, triangle, cylinder, document, plus, arrow-rectangle. */
export function createDefaultShapes(): ShapeRegistry {
  const registry = new ShapeRegistry();

  registry.register('rectangle', {
    path: (w, h) => `M0 0H${r(w)}V${r(h)}H0Z`,
    handles: boxHandles,
    textBox: (w, h) => inset(w, h, 8),
  });

  registry.register('rounded-rectangle', {
    path: (w, h) => {
      const k = Math.min(14, w / 2, h / 2);
      return (
        `M${r(k)} 0H${r(w - k)}A${r(k)} ${r(k)} 0 0 1 ${r(w)} ${r(k)}V${r(h - k)}` +
        `A${r(k)} ${r(k)} 0 0 1 ${r(w - k)} ${r(h)}H${r(k)}A${r(k)} ${r(k)} 0 0 1 0 ${r(h - k)}` +
        `V${r(k)}A${r(k)} ${r(k)} 0 0 1 ${r(k)} 0Z`
      );
    },
    handles: boxHandles,
    textBox: (w, h) => inset(w, h, 10, 6),
  });

  registry.register('ellipse', {
    path: (w, h) =>
      `M0 ${r(h / 2)}A${r(w / 2)} ${r(h / 2)} 0 1 1 ${r(w)} ${r(h / 2)}A${r(w / 2)} ${r(h / 2)} 0 1 1 0 ${r(h / 2)}Z`,
    handles: boxHandles,
    textBox: (w, h) => inset(w, h, (w * (1 - Math.SQRT1_2)) / 2, (h * (1 - Math.SQRT1_2)) / 2),
  });

  registry.register('circle', {
    path: (w, h) => {
      const radius = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return `M${r(cx - radius)} ${r(cy)}A${r(radius)} ${r(radius)} 0 1 1 ${r(cx + radius)} ${r(cy)}A${r(radius)} ${r(radius)} 0 1 1 ${r(cx - radius)} ${r(cy)}Z`;
    },
    handles: (w, h) => {
      const radius = Math.min(w, h) / 2;
      return [
        { id: 'top', position: Position.Top, x: w / 2, y: h / 2 - radius },
        { id: 'right', position: Position.Right, x: w / 2 + radius, y: h / 2 },
        { id: 'bottom', position: Position.Bottom, x: w / 2, y: h / 2 + radius },
        { id: 'left', position: Position.Left, x: w / 2 - radius, y: h / 2 },
      ];
    },
    textBox: (w, h) => {
      const side = Math.min(w, h) * Math.SQRT1_2;
      return { x: (w - side) / 2, y: (h - side) / 2, width: side, height: side };
    },
  });

  registry.register('diamond', {
    path: (w, h) =>
      pts([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ]),
    handles: boxHandles,
    textBox: (w, h) => inset(w, h, w / 4, h / 4),
  });

  const hexInset = (w: number, h: number): number => Math.min(w * 0.25, h * 0.5);
  registry.register('hexagon', {
    path: (w, h) => {
      const i = hexInset(w, h);
      return pts([
        [i, 0],
        [w - i, 0],
        [w, h / 2],
        [w - i, h],
        [i, h],
        [0, h / 2],
      ]);
    },
    handles: boxHandles,
    textBox: (w, h) => inset(w, h, hexInset(w, h) * 0.75 + 4, 6),
  });

  const skew = (w: number): number => w * 0.2;
  registry.register('parallelogram', {
    path: (w, h) =>
      pts([
        [skew(w), 0],
        [w, 0],
        [w - skew(w), h],
        [0, h],
      ]),
    handles: (w, h) => [
      { id: 'top', position: Position.Top, x: w / 2 + skew(w) / 2, y: 0 },
      { id: 'right', position: Position.Right, x: w - skew(w) / 2, y: h / 2 },
      { id: 'bottom', position: Position.Bottom, x: w / 2 - skew(w) / 2, y: h },
      { id: 'left', position: Position.Left, x: skew(w) / 2, y: h / 2 },
    ],
    textBox: (w, h) => inset(w, h, skew(w) + 4, 6),
  });

  registry.register('triangle', {
    path: (w, h) =>
      pts([
        [w / 2, 0],
        [w, h],
        [0, h],
      ]),
    handles: (w, h) => [
      { id: 'top', position: Position.Top, x: w / 2, y: 0 },
      { id: 'right', position: Position.Right, x: (w * 3) / 4, y: h / 2 },
      { id: 'bottom', position: Position.Bottom, x: w / 2, y: h },
      { id: 'left', position: Position.Left, x: w / 4, y: h / 2 },
    ],
    textBox: (w, h) => ({ x: w * 0.25, y: h * 0.42, width: w * 0.5, height: h * 0.5 }),
  });

  const cap = (w: number, h: number): number => Math.min(h * 0.18, w * 0.25, 22);
  registry.register('cylinder', {
    path: (w, h) => {
      const ry = cap(w, h);
      const rx = w / 2;
      return (
        `M0 ${r(ry)}A${r(rx)} ${r(ry)} 0 0 1 ${r(w)} ${r(ry)}V${r(h - ry)}` +
        `A${r(rx)} ${r(ry)} 0 0 1 0 ${r(h - ry)}ZM0 ${r(ry)}A${r(rx)} ${r(ry)} 0 0 0 ${r(w)} ${r(ry)}`
      );
    },
    handles: boxHandles,
    textBox: (w, h) => ({ x: 8, y: cap(w, h) * 2, width: w - 16, height: h - cap(w, h) * 3 }),
  });

  registry.register('document', {
    path: (w, h) =>
      `M0 0H${r(w)}V${r(h * 0.85)}Q${r(w * 0.75)} ${r(h * 0.7)} ${r(w / 2)} ${r(h * 0.85)}T0 ${r(h * 0.85)}Z`,
    handles: (w, h) => [
      { id: 'top', position: Position.Top, x: w / 2, y: 0 },
      { id: 'right', position: Position.Right, x: w, y: h * 0.42 },
      { id: 'bottom', position: Position.Bottom, x: w / 2, y: h * 0.85 },
      { id: 'left', position: Position.Left, x: 0, y: h * 0.42 },
    ],
    textBox: (w, h) => ({ x: 8, y: 6, width: w - 16, height: h * 0.68 }),
  });

  const arm = (w: number, h: number): number => Math.min(w, h) / 3;
  registry.register('plus', {
    path: (w, h) => {
      const t = arm(w, h);
      const x1 = (w - t) / 2;
      const x2 = x1 + t;
      const y1 = (h - t) / 2;
      const y2 = y1 + t;
      return pts([
        [x1, 0],
        [x2, 0],
        [x2, y1],
        [w, y1],
        [w, y2],
        [x2, y2],
        [x2, h],
        [x1, h],
        [x1, y2],
        [0, y2],
        [0, y1],
        [x1, y1],
      ]);
    },
    handles: boxHandles,
    textBox: (w, h) => {
      const t = arm(w, h);
      return { x: (w - t) / 2, y: (h - t) / 2, width: t, height: t };
    },
  });

  const head = (w: number, h: number): number => Math.min(w * 0.3, h * 0.5);
  registry.register('arrow-rectangle', {
    path: (w, h) => {
      const k = head(w, h);
      return pts([
        [0, 0],
        [w - k, 0],
        [w, h / 2],
        [w - k, h],
        [0, h],
      ]);
    },
    handles: (w, h) => [
      { id: 'top', position: Position.Top, x: (w - head(w, h)) / 2, y: 0 },
      { id: 'right', position: Position.Right, x: w, y: h / 2 },
      { id: 'bottom', position: Position.Bottom, x: (w - head(w, h)) / 2, y: h },
      { id: 'left', position: Position.Left, x: 0, y: h / 2 },
    ],
    textBox: (w, h) => ({ x: 8, y: 6, width: w - head(w, h) - 8, height: h - 12 }),
  });

  return registry;
}

/** The shared registry of built-in shapes. Clone it (`defaultShapes.clone()`) before adding your own. */
export const defaultShapes: ShapeRegistry = createDefaultShapes();
