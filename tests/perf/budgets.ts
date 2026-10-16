/**
 * Frame-time and render budgets (spec/13 §Performance).
 *
 * `spec` is the budget of the spec table. `limit` is what the test enforces. They are equal where
 * the dev host meets the spec; where it does not, `limit` is a regression guard calibrated on the
 * reference host (see apps/docs/guide/performance.md): headless Chromium composites in software, and
 * every xyflow node costs the browser's main thread about 3 microseconds per frame in the
 * "Layerize" step when all of them are on screen, so 5000 and 10000 visible nodes cannot hold
 * 60 fps there. The "windowed" variant (viewport culling at working zoom) holds the spec numbers
 * for every count.
 */
export const COUNTS = [1000, 5000, 10000] as const;
export type Count = (typeof COUNTS)[number];

/** rAF deltas are multiples of 16.67 ms with sub-millisecond jitter. */
export const FRAME_EPSILON_MS = 0.5;

export interface Budget {
  /** Budget of the spec table. */
  spec: number;
  /** What the test enforces. */
  limit: number;
}

const same = (n: number): Budget => ({ spec: n, limit: n });

/** Whole graph on screen (`fit-view`): the table of spec/13. */
export const fit = {
  /** p95 frame time while `setViewport` animates a pan for 2 s. */
  pan: {
    1000: same(16.7),
    5000: { spec: 16.7, limit: 66.7 },
    10000: { spec: 33, limit: 133.4 },
  },
  /** p95 frame time while `setViewport` animates a zoom for 2 s (not in the spec table; same budget as pan). */
  zoom: {
    1000: same(16.7),
    5000: { spec: 16.7, limit: 66.7 },
    10000: { spec: 33, limit: 133.4 },
  },
  /** p95 frame time while one node is dragged with 60 mouse moves. */
  drag: {
    1000: same(16.7),
    5000: { spec: 25, limit: 66.7 },
    10000: { spec: 33, limit: 150 },
  },
  /** Milliseconds until `render-complete`. */
  render: {
    1000: same(1500),
    5000: same(5000),
    10000: same(10000),
  },
} satisfies Record<string, Record<Count, Budget>>;

/** `only-render-visible-elements` at zoom 1: the budget is 16.7 ms everywhere. */
export const windowed = {
  pan: { 1000: same(16.7), 5000: same(16.7), 10000: same(16.7) },
  zoom: { 1000: same(16.7), 5000: same(16.7), 10000: same(16.7) },
  drag: { 1000: same(16.7), 5000: same(16.7), 10000: same(16.7) },
} satisfies Record<string, Record<Count, Budget>>;
