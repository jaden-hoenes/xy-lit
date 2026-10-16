import type { Awareness } from 'y-protocols/awareness';
import type { HandleType, Viewport, XYPosition } from '@xy-lit/store';

/** What one client publishes under the awareness field `xyflow` (spec/11 §Presence). */
export type PresenceState = {
  user: { id: string; name: string; color: string; avatar?: string };
  /** Pointer position in flow coordinates. */
  cursor?: XYPosition;
  selection?: { nodes: string[]; edges: string[] };
  drag?: { ids: string[]; positions: Record<string, XYPosition> };
  resize?: { id: string; width: number; height: number; position: XYPosition };
  connection?: {
    fromNode: string;
    fromHandle: string | null;
    fromType: HandleType;
    to: XYPosition;
  };
  viewport?: Viewport;
  tool?: string;
};

/** The awareness field all state lives under. */
export const PRESENCE_FIELD = 'xyflow';

type Slot = { timer: ReturnType<typeof setTimeout> | number | null; kind: 'timeout' | 'raf' };

const CURSOR_INTERVAL = 33;
const VIEWPORT_INTERVAL = 200;

/** Channels that are alive on this page; one shared `pagehide`/`visibilitychange` listener serves them all. */
const live = new Set<PresenceChannel>();
let lifecycleBound = false;

function onPageHide(): void {
  for (const channel of live) channel.clearTransient(true);
}
function onVisibility(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    for (const channel of live) channel.clearTransient(false);
  }
}
function bindLifecycle(): void {
  if (lifecycleBound || typeof document === 'undefined') return;
  lifecycleBound = true;
  addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);
}
function unbindLifecycle(): void {
  if (!lifecycleBound || live.size > 0) return;
  lifecycleBound = false;
  removeEventListener('pagehide', onPageHide);
  document.removeEventListener('visibilitychange', onVisibility);
}

/**
 * The local user's presence: cursor, selection, drag/resize/connection in progress, viewport.
 * Every setter merges into one state object published with
 * `awareness.setLocalStateField('xyflow', state)`; high-frequency fields are throttled.
 */
export class PresenceChannel {
  /** The local client id (`awareness.clientID`, equal to `doc.clientID`). */
  readonly clientId: number;
  readonly #awareness: Awareness;
  readonly #state: PresenceState;
  readonly #slots = new Map<keyof PresenceState, Slot>();
  readonly #pending = new Map<keyof PresenceState, unknown>();
  #destroyed = false;

  /**
   * @param awareness - The awareness instance of the provider.
   * @param user - Who the local user is.
   */
  constructor(awareness: Awareness, user: PresenceState['user']) {
    this.#awareness = awareness;
    this.clientId = awareness.clientID;
    this.#state = { user: { ...user } };
    awareness.setLocalStateField('user', { name: user.name, color: user.color });
    this.#publish();
    live.add(this);
    bindLifecycle();
  }

  // setters -------------------------------------------------------------------------------------

  /** The pointer in flow coordinates; throttled 33 ms (trailing). `null` clears at once. */
  setCursor(p: XYPosition | null): void {
    this.#set('cursor', p ? { x: p.x, y: p.y } : null, { interval: CURSOR_INTERVAL });
  }

  /** The selected node and edge ids; `null` (or empty) clears. */
  setSelection(s: PresenceState['selection'] | null): void {
    const empty = !s || (!s.nodes.length && !s.edges.length);
    this.#set('selection', empty ? null : { nodes: [...s.nodes], edges: [...s.edges] });
  }

  /** The nodes being dragged and their live positions; rAF throttled. `null` clears at once. */
  setDrag(d: PresenceState['drag'] | null): void {
    this.#set('drag', d, { raf: true });
  }

  /** The node being resized; rAF throttled. */
  setResize(r: PresenceState['resize'] | null): void {
    this.#set('resize', r, { raf: true });
  }

  /** The connection being drawn; rAF throttled. */
  setConnection(c: PresenceState['connection'] | null): void {
    this.#set('connection', c, { raf: true });
  }

  /** The viewport; throttled 200 ms. */
  setViewport(v: Viewport | null): void {
    this.#set('viewport', v ? { x: v.x, y: v.y, zoom: v.zoom } : null, {
      interval: VIEWPORT_INTERVAL,
    });
  }

  /** The active tool (free text, e.g. `'pointer'`). */
  setTool(t: string | null): void {
    this.#set('tool', t);
  }

  // readers -------------------------------------------------------------------------------------

  /** Every other client's presence (states without `user` are skipped). */
  remotes(): Map<number, PresenceState> {
    const out = new Map<number, PresenceState>();
    for (const [clientId, state] of this.#awareness.getStates()) {
      if (clientId === this.clientId) continue;
      const presence = (state as Record<string, unknown>)[PRESENCE_FIELD] as
        PresenceState | null | undefined;
      if (presence?.user) out.set(clientId, presence);
    }
    return out;
  }

  /** Called when any remote presence changed (awareness `change`, ignoring our own updates). */
  subscribe(listener: () => void): () => void {
    const handler = (changes: { added: number[]; updated: number[]; removed: number[] }): void => {
      const others = (ids: number[]) => ids.some((id) => id !== this.clientId);
      if (others(changes.added) || others(changes.updated) || others(changes.removed)) listener();
    };
    this.#awareness.on('change', handler);
    return () => this.#awareness.off('change', handler);
  }

  /** The state this channel currently publishes (a copy). */
  get state(): PresenceState {
    return { ...this.#state };
  }

  /** Clear the local fields and stop listening. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const key of [...this.#slots.keys()]) this.#cancel(key);
    live.delete(this);
    unbindLifecycle();
    if (this.#awareness.getLocalState() !== null) {
      this.#awareness.setLocalStateField(PRESENCE_FIELD, null);
      this.#awareness.setLocalStateField('user', null);
    }
  }

  /** @internal Drop the fields that go stale when the page is hidden (`all`: on `pagehide`). */
  clearTransient(all: boolean): void {
    const keys: (keyof PresenceState)[] = all
      ? ['cursor', 'drag', 'resize', 'connection']
      : ['cursor'];
    let changed = false;
    for (const key of keys) {
      this.#cancel(key);
      if (key in this.#state) {
        delete this.#state[key];
        changed = true;
      }
    }
    if (changed) this.#publish();
  }

  // internals -----------------------------------------------------------------------------------

  #set(
    key: keyof PresenceState,
    value: unknown,
    throttle?: { interval?: number; raf?: boolean },
  ): void {
    if (this.#destroyed) return;
    if (value === null || !throttle) {
      this.#cancel(key);
      this.#apply(key, value);
      return;
    }
    this.#pending.set(key, value);
    if (this.#slots.has(key)) return;
    const fire = (): void => {
      this.#slots.delete(key);
      if (!this.#pending.has(key)) return;
      const next = this.#pending.get(key);
      this.#pending.delete(key);
      this.#apply(key, next);
    };
    if (throttle.raf && typeof requestAnimationFrame === 'function') {
      this.#slots.set(key, { kind: 'raf', timer: requestAnimationFrame(fire) });
    } else {
      this.#slots.set(key, {
        kind: 'timeout',
        timer: setTimeout(fire, throttle.raf ? 16 : (throttle.interval ?? 16)),
      });
    }
  }

  #cancel(key: keyof PresenceState): void {
    this.#pending.delete(key);
    const slot = this.#slots.get(key);
    if (!slot) return;
    this.#slots.delete(key);
    if (slot.kind === 'raf') cancelAnimationFrame(slot.timer as number);
    else clearTimeout(slot.timer as ReturnType<typeof setTimeout>);
  }

  #apply(key: keyof PresenceState, value: unknown): void {
    const state = this.#state as Record<string, unknown>;
    if (value === null || value === undefined) {
      if (!(key in state)) return;
      delete state[key];
    } else {
      state[key] = value;
    }
    this.#publish();
  }

  #publish(): void {
    if (this.#awareness.getLocalState() === null) return;
    this.#awareness.setLocalStateField(PRESENCE_FIELD, { ...this.#state });
  }
}
