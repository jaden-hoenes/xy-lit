import type { RemoteUser } from '@xy-lit/store';
import type { PresenceChannel, PresenceState } from './awareness.js';
import type { RemoteLookup, RemoteNodeView } from './materialize.js';

/** How long `remote.addedBy` stays set after a remote insert. */
export const ADDED_BY_MS = 1500;

const toUser = (clientId: number, user: PresenceState['user']): RemoteUser => ({
  clientId,
  id: user.id,
  name: user.name,
  color: user.color,
});

/**
 * The per-node view of remote presence the materialiser needs: who selects, drags or resizes
 * which node, and who just added one. {@link update} recomputes it from the awareness states
 * and reports the node ids whose view changed.
 */
export class RemoteState implements RemoteLookup {
  #views = new Map<string, RemoteNodeView>();
  #sigs = new Map<string, string>();
  readonly #added = new Map<string, { user: RemoteUser; timer: ReturnType<typeof setTimeout> }>();
  #remotes = new Map<number, PresenceState>();

  constructor(private readonly presence: PresenceChannel) {}

  get(id: string): RemoteNodeView | undefined {
    return this.#views.get(id);
  }

  /** The users that currently drag or resize (for soft locks): node id to user. */
  lockedBy(id: string): RemoteUser | undefined {
    const view = this.#views.get(id);
    return view?.meta.draggingBy ?? view?.meta.resizingBy;
  }

  /** The remote presence as of the last {@link update}. */
  get remotes(): ReadonlyMap<number, PresenceState> {
    return this.#remotes;
  }

  /** The user for an awareness client id, if known. */
  userOf(clientId: number): RemoteUser | undefined {
    const state = this.#remotes.get(clientId);
    return state ? toUser(clientId, state.user) : undefined;
  }

  /** Mark a node as added by a remote user for {@link ADDED_BY_MS}; `onExpire` gets the node id. */
  markAdded(id: string, user: RemoteUser, onExpire: (id: string) => void): void {
    const previous = this.#added.get(id);
    if (previous) clearTimeout(previous.timer);
    const timer = setTimeout(() => {
      this.#added.delete(id);
      onExpire(id);
    }, ADDED_BY_MS);
    this.#added.set(id, { user, timer });
  }

  /** Recompute from the awareness states. @returns Ids whose view changed. */
  update(): Set<string> {
    this.#remotes = this.presence.remotes();
    const views = new Map<string, RemoteNodeView>();
    const view = (id: string): RemoteNodeView => {
      let v = views.get(id);
      if (!v) {
        v = { meta: {} };
        views.set(id, v);
      }
      return v;
    };
    const clients = [...this.#remotes.keys()].sort((a, b) => a - b);
    for (const clientId of clients) {
      const state = this.#remotes.get(clientId)!;
      const user = toUser(clientId, state.user);
      for (const id of state.selection?.nodes ?? []) {
        const m = view(id).meta;
        (m.selectedBy ??= []).push(user);
      }
      if (state.drag) {
        for (const id of state.drag.ids) {
          const v = view(id);
          v.meta.draggingBy ??= user;
          const p = state.drag.positions[id];
          if (p && v.meta.draggingBy === user) v.position = { x: p.x, y: p.y };
        }
      }
      if (state.resize) {
        const v = view(state.resize.id);
        if (!v.meta.resizingBy) {
          v.meta.resizingBy = user;
          v.size = { width: state.resize.width, height: state.resize.height };
          v.position = { x: state.resize.position.x, y: state.resize.position.y };
        }
      }
    }
    for (const [id, added] of this.#added) view(id).meta.addedBy = added.user;

    const dirty = new Set<string>();
    const sigs = new Map<string, string>();
    for (const [id, v] of views) {
      const sig = JSON.stringify(v);
      sigs.set(id, sig);
      if (this.#sigs.get(id) !== sig) dirty.add(id);
    }
    for (const id of this.#sigs.keys()) if (!sigs.has(id)) dirty.add(id);
    this.#views = views;
    this.#sigs = sigs;
    return dirty;
  }

  /** Cancel timers. */
  destroy(): void {
    for (const { timer } of this.#added.values()) clearTimeout(timer);
    this.#added.clear();
    this.#views.clear();
    this.#sigs.clear();
  }
}
