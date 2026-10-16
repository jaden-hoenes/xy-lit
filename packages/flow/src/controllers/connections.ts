// Ported from xyflow (MIT) packages/react/src/hooks/useNodeConnections.ts, useHandleConnections.ts@3d35b57
import { ContextConsumer } from '@lit/context';
import type { ReactiveController } from 'lit';
import { devWarn } from '@xy-lit/store';
import type { Connection, HandleConnection, HandleType, NodeConnection } from '@xy-lit/store';
import {
  areConnectionMapsEqual,
  errorMessages,
  handleConnectionChange,
} from '@xy-lit/store/internal';
import { nodeIdContext } from '../context.js';
import type { ControllerHost, ControllerStoreOption } from './flow-controllers.js';
import { StoreController } from './store-controller.js';

/** Options of {@link NodeConnectionsController}. */
export type NodeConnectionsOptions = ControllerStoreOption & {
  /** Node id. Default: the enclosing node. */
  id?: string;
  /** Only connections at handles of this type. */
  handleType?: HandleType;
  /** Only connections at the handle with this id (needs `handleType`). */
  handleId?: string | null;
  /** Called with the connections that were added. */
  onConnect?: (connections: Connection[]) => void;
  /** Called with the connections that were removed. */
  onDisconnect?: (connections: Connection[]) => void;
};

/** Shared implementation: a lookup key and the change callbacks. */
class ConnectionsBase<C extends HandleConnection> implements ReactiveController {
  readonly #sc: StoreController<Map<string, C> | undefined>;
  #list: C[] = [];
  #listFor: Map<string, C> | undefined | null = null;

  constructor(
    host: ControllerHost,
    key: () => string | undefined,
    callbacks: {
      onConnect?: (connections: Connection[]) => void;
      onDisconnect?: (connections: Connection[]) => void;
    },
    store: ControllerStoreOption,
    refreshOn: (refresh: () => void) => void,
  ) {
    this.#sc = new StoreController<Map<string, C> | undefined>(
      host,
      (s) => {
        const k = key();
        return k === undefined
          ? undefined
          : (s.connectionLookup.get(k) as Map<string, C> | undefined);
      },
      areConnectionMapsEqual,
      {
        ...store,
        onChange: (next, previous) => {
          const now = (next as Map<string, C> | undefined) ?? new Map<string, C>();
          const before = (previous as Map<string, C> | undefined) ?? new Map<string, C>();
          handleConnectionChange(before, now, callbacks.onDisconnect);
          handleConnectionChange(now, before, callbacks.onConnect);
        },
      },
    );
    refreshOn(() => {
      this.#sc.refresh();
    });
  }

  /** The connections (a new array only when they changed). */
  get value(): C[] {
    const map = this.#sc.store ? this.#sc.value : undefined;
    if (this.#listFor !== map) {
      this.#listFor = map;
      this.#list = Array.from(map?.values() ?? []);
    }
    return this.#list;
  }

  hostConnected(): void {}
}

/**
 * The connections of a node, optionally of one handle type or handle (React
 * `useNodeConnections`). Use it in a node element or with an explicit `id`.
 */
export class NodeConnectionsController implements ReactiveController {
  readonly #base: ConnectionsBase<NodeConnection>;
  #contextId: string | undefined;

  constructor(host: ControllerHost, o: NodeConnectionsOptions = {}) {
    this.#base = new ConnectionsBase<NodeConnection>(
      host,
      () => {
        const id = o.id ?? this.#contextId;
        if (!id) return undefined;
        const { handleType: type, handleId } = o;
        return `${id}${type ? (handleId ? `-${type}-${handleId}` : `-${type}`) : ''}`;
      },
      o,
      o.store ? { store: o.store } : {},
      (refresh) => {
        new ContextConsumer(host, {
          context: nodeIdContext,
          subscribe: true,
          callback: (value) => {
            this.#contextId = value;
            refresh();
          },
        });
      },
    );
    host.addController({
      hostConnected: () => {
        if (!o.id && !this.#contextId) {
          queueMicrotask(() => {
            if (!o.id && !this.#contextId) devWarn('014', errorMessages.error014());
          });
        }
      },
    });
  }

  /** The node's connections. */
  get value(): NodeConnection[] {
    return this.#base.value;
  }
  hostConnected(): void {}
}

/** Options of {@link HandleConnectionsController}. */
export type HandleConnectionsOptions = ControllerStoreOption & {
  /** Handle type. */
  type: HandleType;
  /** Handle id. */
  id?: string | null;
  /** Node id. Default: the enclosing node. */
  nodeId?: string;
  /** Called with the connections that were added. */
  onConnect?: (connections: Connection[]) => void;
  /** Called with the connections that were removed. */
  onDisconnect?: (connections: Connection[]) => void;
};

/**
 * The connections of one handle (React `useHandleConnections`, deprecated upstream in favour of
 * {@link NodeConnectionsController}; kept for parity).
 */
export class HandleConnectionsController implements ReactiveController {
  readonly #base: ConnectionsBase<HandleConnection>;
  #contextId: string | undefined;

  constructor(host: ControllerHost, o: HandleConnectionsOptions) {
    this.#base = new ConnectionsBase<HandleConnection>(
      host,
      () => {
        const nodeId = o.nodeId ?? this.#contextId;
        return nodeId ? `${nodeId}-${o.type}${o.id ? `-${o.id}` : ''}` : undefined;
      },
      o,
      o.store ? { store: o.store } : {},
      (refresh) => {
        new ContextConsumer(host, {
          context: nodeIdContext,
          subscribe: true,
          callback: (value) => {
            this.#contextId = value;
            refresh();
          },
        });
      },
    );
  }

  /** The handle's connections. */
  get value(): HandleConnection[] {
    return this.#base.value;
  }
  hostConnected(): void {}
}
