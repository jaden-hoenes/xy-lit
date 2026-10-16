import type { ReactiveController } from 'lit';
import type { MotionState } from '../../types.js';
import { MOTION_OFF } from '../../types.js';
import type { XyFlowElement } from '../xy-flow.js';

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
};

/** Whether the user asked for reduced motion (read at the moment of the check, so tests can stub it). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Computes the entrance-motion state (spec/10 §Motion) before every render of the flow:
 *
 * - the ids of the **initial population** (the first non-empty node set after mount or after a
 *   new `source` was attached) enter whenever motion is enabled;
 * - ids that appear later enter only with `motion="enter remote"` while the source reports
 *   `lastUpdateRemote`;
 * - motion is enabled when the mode is not `off`, reduced motion is not requested and the number
 *   of nodes is at most `motion-max-nodes`.
 *
 * The state object keeps its identity until something in it changes, so render contexts that
 * contain it stay stable.
 */
export class MotionController implements ReactiveController {
  #state: MotionState = MOTION_OFF;
  #known: Set<string> | null = new Set<string>();
  #populated = false;

  constructor(private readonly host: XyFlowElement) {
    host.addController(this);
  }

  /** The current state (always {@link MOTION_OFF} when motion is not enabled). */
  get state(): MotionState {
    return this.#state;
  }

  /** Forget everything: the next non-empty node set counts as an initial population again. */
  reset(): void {
    this.#known = new Set();
    this.#populated = false;
    this.#set(MOTION_OFF);
  }

  hostUpdate(): void {
    if (!this.host.hasStore) return;
    const { host } = this;
    const mode = host.motion;
    const { nodes, edges } = host.store.getState();
    if (mode === 'off') {
      // cheap path for the common case (this runs on every render, including drag frames):
      // remember that the initial population is over, without building id sets
      if (nodes.length > 0) this.#populated = true;
      this.#known = null;
      this.#set(MOTION_OFF);
      return;
    }
    const ids = new Set(nodes.map((n) => n.id));

    let entering: ReadonlySet<string> = this.#state.entering;
    let enteringEdges: ReadonlySet<string> = this.#state.enteringEdges;

    if (!this.#populated) {
      if (ids.size > 0) {
        this.#populated = true;
        entering = ids;
      }
    } else {
      const known = this.#known;
      const added = known ? [...ids].filter((id) => !known.has(id)) : [];
      if (added.length > 0 && mode === 'enter remote' && host.store.source.lastUpdateRemote) {
        entering = new Set(added);
      }
    }
    this.#known = ids;

    if (entering !== this.#state.entering) {
      enteringEdges = new Set(
        edges.filter((e) => entering.has(e.source) && entering.has(e.target)).map((e) => e.id),
      );
    }

    const enabled = !prefersReducedMotion() && ids.size <= host.motionMaxNodes;
    if (!enabled) {
      this.#set(MOTION_OFF);
      return;
    }
    if (
      this.#state.enabled &&
      this.#state.mode === mode &&
      sameSet(this.#state.entering, entering) &&
      sameSet(this.#state.enteringEdges, enteringEdges)
    ) {
      return;
    }
    this.#set({ mode, enabled: true, entering, enteringEdges });
  }

  #set(next: MotionState): void {
    this.#state = next;
  }
}

/**
 * Milliseconds of a CSS time value such as `260ms` or `0.3s`.
 *
 * @param value - The custom property value (may be empty).
 * @param fallback - Used when the value is empty or not a time.
 */
export function cssMs(value: string, fallback: number): number {
  const m = /^\s*(-?[\d.]+)\s*(ms|s)\s*$/.exec(value);
  if (!m) return fallback;
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
}
