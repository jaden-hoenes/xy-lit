import { ConnectionMode } from '@xy-lit/store';
import type { FlowStore, HandleType } from '@xy-lit/store';

/** What a handle needs to know about the connection in progress to style itself. */
export type ConnectionHubState = {
  /** A drag connection is in progress. */
  inProgress: boolean;
  /** A click-connect start handle is set. */
  clickStart: boolean;
  /** Key of the handle the connection starts from (`nodeId-type-handleId`). */
  fromKey: string | null;
  /** Key of the handle under the pointer, if any. */
  toKey: string | null;
  /** Whether the handle under the pointer is a valid target. */
  isValid: boolean | null;
  /** Type of the start handle. */
  fromType: HandleType | null;
  /** Node id of the start handle. */
  fromNodeId: string | null;
  /** Handle id of the start handle. */
  fromHandleId: string | null;
  /** The flow's connection mode. */
  connectionMode: ConnectionMode;
};

/** A handle element registered at the hub. */
export interface HubHandle {
  /** Recompute connection related classes from the new hub state. */
  applyConnectionState(state: ConnectionHubState): void;
}

/**
 * Key under which a handle registers: `${nodeId}-${type}-${handleId ?? 'null'}`.
 *
 * @param nodeId - Node id.
 * @param type - Handle type.
 * @param handleId - Handle id or null.
 */
export function handleKey(nodeId: string, type: HandleType, handleId: string | null): string {
  return `${nodeId}-${type}-${handleId ?? 'null'}`;
}

const IDLE: ConnectionHubState = {
  inProgress: false,
  clickStart: false,
  fromKey: null,
  toKey: null,
  isValid: null,
  fromType: null,
  fromNodeId: null,
  fromHandleId: null,
  connectionMode: ConnectionMode.Strict,
};

/**
 * Tells handles about the connection in progress without every handle subscribing to the store.
 * Subscribes once to `state.connection` and `state.connectionClickStartHandle`; handles register
 * under their key. When the connection starts or ends (or the click start changes) every handle
 * is updated, while it is in progress only the handles whose key is the previous or the new
 * start/target handle.
 */
export class ConnectionHub {
  private store: FlowStore | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly handles = new Map<string, Set<HubHandle>>();
  private lastConnection: unknown;
  private lastClick: unknown;
  private lastMode: unknown;
  private current: ConnectionHubState = IDLE;

  /** The state handles are currently styled for. */
  get state(): ConnectionHubState {
    return this.current;
  }

  /**
   * Start watching a store.
   *
   * @param store - The flow's store.
   */
  attach(store: FlowStore): void {
    this.detach();
    this.store = store;
    this.lastConnection = undefined;
    this.lastClick = undefined;
    this.lastMode = undefined;
    this.update();
    this.unsubscribe = store.subscribe(() => {
      this.update();
    });
  }

  /** Stop watching the store. */
  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = null;
  }

  /**
   * Register a handle. It is told the current state immediately.
   *
   * @param key - See {@link handleKey}.
   * @param handle - The handle element.
   */
  register(key: string, handle: HubHandle): void {
    let set = this.handles.get(key);
    if (!set) {
      set = new Set();
      this.handles.set(key, set);
    }
    set.add(handle);
    handle.applyConnectionState(this.current);
  }

  /**
   * Remove a handle.
   *
   * @param key - The key it was registered with.
   * @param handle - The handle element.
   */
  unregister(key: string, handle: HubHandle): void {
    const set = this.handles.get(key);
    if (!set) return;
    set.delete(handle);
    if (set.size === 0) this.handles.delete(key);
  }

  private compute(): ConnectionHubState {
    const s = this.store?.getState();
    if (!s) return IDLE;
    const { connection, connectionClickStartHandle: click, connectionMode } = s;
    if (!connection.inProgress && !click) return { ...IDLE, connectionMode };
    const from = connection.fromHandle;
    const to = connection.toHandle;
    return {
      inProgress: connection.inProgress,
      clickStart: !!click,
      fromKey: from ? handleKey(from.nodeId, from.type, from.id ?? null) : null,
      toKey: to ? handleKey(to.nodeId, to.type, to.id ?? null) : null,
      isValid: connection.isValid,
      fromType: from?.type ?? null,
      fromNodeId: from?.nodeId ?? null,
      fromHandleId: from?.id ?? null,
      connectionMode,
    };
  }

  private update(): void {
    const s = this.store?.getState();
    if (!s) return;
    if (
      s.connection === this.lastConnection &&
      s.connectionClickStartHandle === this.lastClick &&
      s.connectionMode === this.lastMode
    ) {
      return;
    }
    this.lastConnection = s.connection;
    this.lastClick = s.connectionClickStartHandle;
    this.lastMode = s.connectionMode;

    const previous = this.current;
    const next = this.compute();
    this.current = next;

    const broad =
      previous.inProgress !== next.inProgress ||
      previous.clickStart !== next.clickStart ||
      previous.connectionMode !== next.connectionMode ||
      previous.fromNodeId !== next.fromNodeId ||
      previous.fromHandleId !== next.fromHandleId ||
      previous.fromType !== next.fromType;
    if (broad) {
      for (const set of this.handles.values()) {
        for (const handle of set) handle.applyConnectionState(next);
      }
      return;
    }

    const keys = new Set<string>();
    for (const key of [previous.fromKey, next.fromKey, previous.toKey, next.toKey]) {
      if (key !== null) keys.add(key);
    }
    for (const key of keys) {
      const set = this.handles.get(key);
      if (set) for (const handle of set) handle.applyConnectionState(next);
    }
  }
}
