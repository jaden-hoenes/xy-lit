import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { YjsFlowSource } from '@xy-lit/collab-yjs';
import type { Edge, Node } from '@xy-lit/flow';
import { seedGraph } from './seed';

/** Palette for user colours: saturated enough for white name tags and rings. */
export const USER_COLORS = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
];
const NAMES = [
  'Ada',
  'Grace',
  'Linus',
  'Margaret',
  'Alan',
  'Hedy',
  'Dennis',
  'Barbara',
  'Ken',
  'Radia',
  'Tim',
  'Katherine',
  'Guido',
  'Frances',
  'Donald',
  'Annie',
  'Vint',
  'Sophie',
];

export type CollabUser = { id: string; name: string; color: string };
export type ConnectionStatus = 'connecting' | 'online' | 'offline';

const rand = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** The local identity: kept per browser tab (so two tabs are two people), `?name=` overrides the name. */
export function localUser(search = location.search): CollabUser {
  let stored: CollabUser | undefined;
  try {
    stored = JSON.parse(sessionStorage.getItem('xy-collab-user') ?? 'null') as
      CollabUser | undefined;
  } catch {
    stored = undefined;
  }
  const user = stored ?? {
    id: Math.random().toString(36).slice(2, 10),
    name: rand(NAMES),
    color: rand(USER_COLORS),
  };
  const name = new URLSearchParams(search).get('name');
  if (name) user.name = name.slice(0, 24);
  try {
    sessionStorage.setItem('xy-collab-user', JSON.stringify(user));
  } catch {
    /* private mode: identity lasts for this page only */
  }
  return user;
}

export function saveUserName(user: CollabUser): void {
  try {
    sessionStorage.setItem('xy-collab-user', JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

/** Node type to the `data` keys stored as collaborative text. */
export const RICH_TEXT = { note: ['body'] };

/**
 * y-indexeddb writes every document update into its database from a `doc.on('update')` listener.
 * When the page is torn down, Firefox closes the IndexedDB connection while the socket still delivers
 * updates, so that listener throws "InvalidStateError: ... closed database" (Yjs logs it as "Caught
 * error while handling a Yjs update"). Swap the listener for one that stops persisting as soon as the
 * database turns out to be closed: nothing is lost, a closed database cannot be written anyway.
 * Returns the function that detaches the listener (call it before `persistence.destroy()`).
 */
export function guardPersistence(doc: Y.Doc, persistence: IndexeddbPersistence): () => void {
  const internals = persistence as unknown as {
    _storeUpdate: (update: Uint8Array, origin: unknown) => void;
  };
  const store = internals._storeUpdate;
  let closed = false;
  const guarded = (update: Uint8Array, origin: unknown): void => {
    if (closed) return;
    try {
      store(update, origin);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error;
      closed = true;
      void persistence.destroy();
    }
  };
  doc.off('update', store);
  doc.on('update', guarded);
  return () => {
    closed = true;
    doc.off('update', guarded);
  };
}

export type Session = {
  room: string;
  user: CollabUser;
  readOnly: boolean;
  doc: Y.Doc;
  provider: HocuspocusProvider;
  /** False when the build has no collaboration server (static hosting): the session never tries to connect. */
  hasServer: boolean;
  persistence: IndexeddbPersistence;
  source: YjsFlowSource;
  /** Resolves once the local copy and the first server sync (or a 1.5 s timeout) are in and a new room is seeded. */
  ready: Promise<void>;
  /** Current connection status and a subscription to changes. */
  status(): ConnectionStatus;
  onStatus(listener: (status: ConnectionStatus) => void): () => void;
  /** Disconnect from / reconnect to the server (a manual switch; the browser going offline does the same by itself). Edits keep being saved in IndexedDB. */
  setOffline(offline: boolean): void;
  /** Whether the user switched the connection off (not the browser's network state). */
  isOffline(): boolean;
  destroy(): void;
};

/**
 * Hocuspocus (live sync) plus y-indexeddb (local copy) around one Yjs document, and the
 * `YjsFlowSource` that makes it the flow's data. The source waits for the local copy and the first
 * server sync (or 1.5 s) before it writes the schema or seeds an empty room.
 */
export function createSession(room: string, options: { readOnly?: boolean } = {}): Session {
  const user = localUser();
  const readOnly = options.readOnly ?? false;
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`xy-lit-collab:${room}`, doc);
  const unguard = guardPersistence(doc, persistence);
  const url = (import.meta.env.VITE_COLLAB_URL as string | undefined) ?? '';
  // A build without a server (the hosted GitHub Pages copy sets VITE_COLLAB_URL to an empty string)
  // never opens a socket: the demo runs on the local copy and says the server is not reachable.
  const hasServer = url !== '';
  // `autoConnect` is a socket option that the provider hands on to the WebSocket it creates, but
  // its type does not list it
  const socketOptions: { autoConnect: boolean } = { autoConnect: hasServer };
  const provider = new HocuspocusProvider({
    url,
    name: room,
    document: doc,
    token: `user:${user.id}${readOnly ? ':ro' : ''}`,
    ...socketOptions,
  });

  let status: ConnectionStatus = hasServer ? 'connecting' : 'offline';
  let manualOffline = false;
  let networkOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const offline = (): boolean => manualOffline || networkOffline || !hasServer;
  const listeners = new Set<(s: ConnectionStatus) => void>();
  const setStatus = (next: ConnectionStatus): void => {
    if (next === status) return;
    status = next;
    for (const l of [...listeners]) l(next);
  };
  provider.on('status', ({ status: s }: { status: string }) => {
    if (offline()) return setStatus('offline');
    setStatus(s === 'connected' ? 'online' : s === 'connecting' ? 'connecting' : 'offline');
  });

  /** Connect or disconnect to match `manualOffline` / `networkOffline`. */
  const refresh = (): void => {
    if (!hasServer) return setStatus('offline');
    if (offline()) {
      provider.disconnect();
      setStatus('offline');
    } else {
      setStatus('connecting');
      void provider.connect();
    }
  };
  // a browser that loses its network (airplane mode, DevTools offline) goes offline on its own;
  // established WebSockets would otherwise linger until a ping times out
  const onNetwork = (online: boolean) => () => {
    if (networkOffline === !online) return;
    networkOffline = !online;
    if (!manualOffline) refresh();
  };
  const goOffline = onNetwork(false);
  const goOnline = onNetwork(true);
  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  // closing the tab: stop the inputs and close the local copy ourselves, before the browser closes
  // IndexedDB under y-indexeddb (a forced teardown, e.g. a closed test context, is covered by the guard)
  const onPageHide = (): void => session.destroy();
  window.addEventListener('pagehide', onPageHide);

  const providerSynced = new Promise<void>((resolve) => {
    if (provider.synced) resolve();
    provider.on('synced', () => resolve());
  });
  const synced: Promise<void> = persistence.whenSynced
    .then(() => Promise.race([providerSynced, new Promise((r) => setTimeout(r, 1500))]))
    .then(() => {
      // a brand-new room gets the demo graph (ids are fixed, so a second client doing the same
      // at the same moment writes the same keys)
      const empty = doc.getMap('nodes').size === 0 && doc.getMap('edges').size === 0;
      if (empty && !readOnly) {
        const seed = seedGraph(user.name);
        YjsFlowSource.populate(
          doc,
          { nodes: seed.nodes as Node[], edges: seed.edges as Edge[] },
          { richText: RICH_TEXT },
        );
      }
    });

  const source = new YjsFlowSource(doc, {
    awareness: provider.awareness ?? undefined,
    user,
    richText: RICH_TEXT,
    synced,
    readOnly,
  });

  let destroyed = false;
  const session: Session = {
    room,
    user,
    readOnly,
    doc,
    provider,
    hasServer,
    persistence,
    source,
    ready: synced,
    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOffline(next) {
      manualOffline = next;
      refresh();
    },
    isOffline: () => manualOffline,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      source.destroy();
      provider.destroy();
      unguard();
      void persistence.destroy();
      doc.destroy();
    },
  };
  return session;
}
