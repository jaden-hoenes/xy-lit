import { createId } from '@xy-lit/store';
import type { ChangeOrigin, FlowStore, InternalNode, XYPosition } from '@xy-lit/store';
import { storeOf } from '../common.js';
import type { FlowLike } from '../common.js';

/** Options of {@link animateNodePositions}. */
export interface AnimateOptions {
  /** Milliseconds. Default 300. `0` moves the nodes in one discrete update. */
  duration?: number;
  /** Easing of the progress (0..1). Default ease-in-out cubic. */
  easing?: (t: number) => number;
  /** `ChangeMeta.origin` of the updates. Default `'layout'`. */
  origin?: ChangeOrigin;
  /** `ChangeMeta.gestureId` shared by all frames. Default: a fresh id. */
  gestureId?: string;
  /** Skip the animation when the user prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
}

/** Ease-in-out cubic. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Running {
  ids: Set<string>;
  /** Finish early at the current positions (`end` phase), resolving the promise with false. */
  cancel(): void;
}

const running = new WeakMap<FlowStore, Set<Running>>();

/**
 * Move nodes to target positions over time, as one gesture: the first frame is sent with phase
 * `start`, the frames in between `live`, the last `end` (through `store.updateNodePositions`, so
 * all change middlewares, history and sources see an ordinary drag). A data source with a
 * transient overlay (Yjs) shows the in-between frames locally and commits once at `end`.
 *
 * Targets are `node.position` values (relative to the parent for children). Starting an
 * animation for a node that is already animating cancels the older one for the whole older set:
 * it ends at the positions it had reached.
 *
 * @param flow - The `<xy-flow>` or its instance.
 * @param targets - Node id to target position (a `Map` or a plain record).
 * @returns Resolves to true when the nodes reached their targets, false when cancelled.
 */
export function animateNodePositions(
  flow: FlowLike,
  targets: ReadonlyMap<string, XYPosition> | Record<string, XYPosition>,
  options: AnimateOptions = {},
): Promise<boolean> {
  const store = storeOf(flow);
  const entries: [string, XYPosition][] =
    targets instanceof Map
      ? Array.from((targets as ReadonlyMap<string, XYPosition>).entries())
      : Object.entries(targets as Record<string, XYPosition>);
  const easing = options.easing ?? easeInOutCubic;
  const origin = options.origin ?? 'layout';
  const gestureId = options.gestureId ?? createId();
  const reduce =
    (options.respectReducedMotion ?? true) &&
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduce ? 0 : (options.duration ?? 300);

  const from = new Map<string, { node: InternalNode; x: number; y: number }>();
  const to = new Map<string, XYPosition>();
  const { nodeLookup } = store.getState();
  for (const [id, target] of entries) {
    const node = nodeLookup.get(id);
    if (!node) continue;
    if (node.position.x === target.x && node.position.y === target.y) continue;
    from.set(id, { node, x: node.position.x, y: node.position.y });
    to.set(id, target);
  }

  // a newer animation for the same nodes replaces the older one
  const set = running.get(store) ?? new Set<Running>();
  running.set(store, set);
  for (const other of [...set]) {
    for (const id of to.keys()) {
      if (other.ids.has(id)) {
        other.cancel();
        break;
      }
    }
  }
  if (!to.size) return Promise.resolve(true);

  const frame = (progress: number): Map<string, InternalNode> => {
    const out = new Map<string, InternalNode>();
    const { nodeLookup: lookup } = store.getState();
    for (const [id, start] of from) {
      const node = lookup.get(id);
      if (!node) continue; // removed meanwhile
      const target = to.get(id)!;
      const position =
        progress >= 1
          ? { x: target.x, y: target.y }
          : {
              x: start.x + (target.x - start.x) * progress,
              y: start.y + (target.y - start.y) * progress,
            };
      out.set(id, { ...node, position });
    }
    return out;
  };

  if (duration <= 0) {
    store.updateNodePositions(frame(1), false, { origin, phase: 'discrete', gestureId });
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let last = 0;
    let raf = 0;
    let started = 0;
    const entry: Running = {
      ids: new Set(to.keys()),
      cancel: () => {
        cancelAnimationFrame(raf);
        set.delete(entry);
        store.updateNodePositions(frame(last), false, { origin, phase: 'end', gestureId });
        resolve(false);
      },
    };
    set.add(entry);
    store.updateNodePositions(frame(0), true, { origin, phase: 'start', gestureId });
    const tick = (now: number): void => {
      started ||= now;
      const t = Math.min(1, (now - started) / duration);
      last = easing(t);
      if (t >= 1) {
        set.delete(entry);
        store.updateNodePositions(frame(1), false, { origin, phase: 'end', gestureId });
        resolve(true);
        return;
      }
      store.updateNodePositions(frame(last), true, { origin, phase: 'live', gestureId });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
