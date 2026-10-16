// Ported from xyflow (MIT) packages/react/src/hooks/{useReactFlow,useNodes,useEdges,useViewport,useStoreApi,useInternalNode,useNodesData,useConnection,useNodesInitialized}.ts@3d35b57
import { ContextConsumer } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { shallow } from '@xy-lit/store';
import type {
  ConnectionState,
  Edge,
  FlowInstance,
  FlowState,
  FlowStore,
  InternalNode,
  Node,
  Viewport,
} from '@xy-lit/store';
import { nodeHasDimensions, pointToRendererPoint, shallowNodeData } from '@xy-lit/store/internal';
import { nodeIdContext } from '../context.js';
import { StoreController } from './store-controller.js';

/** Host type of every controller: a reactive element. */
export type ControllerHost = ReactiveControllerHost & HTMLElement;

/** Last argument of every controller: use this store instead of the one from `flowContext`. */
export type ControllerStoreOption = { store?: FlowStore };

/**
 * The flow's imperative API (React `useReactFlow`). `value` is `undefined` until a flow or
 * provider answered; the identity never changes, so the host never re-renders because of it.
 */
export class FlowInstanceController implements ReactiveController {
  readonly #sc: StoreController<FlowInstance>;
  constructor(host: ControllerHost, options: ControllerStoreOption = {}) {
    this.#sc = new StoreController(host, (_s, store) => store.instance, Object.is, options);
  }
  /** The flow instance, once known. */
  get value(): FlowInstance | undefined {
    return this.#sc.store ? this.#sc.value : undefined;
  }
  hostConnected(): void {}
}

/** The flow store (React `useStoreApi`). */
export class StoreApiController implements ReactiveController {
  readonly #sc: StoreController<FlowStore>;
  constructor(host: ControllerHost, options: ControllerStoreOption = {}) {
    this.#sc = new StoreController(host, (_s, store) => store, Object.is, options);
  }
  /** The store, once known. */
  get value(): FlowStore | undefined {
    return this.#sc.store;
  }
  hostConnected(): void {}
}

/**
 * All nodes (React `useNodes`). The host re-renders whenever the nodes array changes, which
 * includes every drag frame: prefer a narrower controller where possible.
 */
export class NodesController<N extends Node = Node> implements ReactiveController {
  readonly #sc: StoreController<N[], N>;
  constructor(host: ControllerHost, options: ControllerStoreOption = {}) {
    this.#sc = new StoreController<N[], N>(host, (s) => s.nodes, Object.is, options as never);
  }
  /** The current nodes. */
  get value(): N[] {
    return this.#sc.store ? this.#sc.value : [];
  }
  hostConnected(): void {}
}

/** All edges (React `useEdges`). */
export class EdgesController<E extends Edge = Edge> implements ReactiveController {
  readonly #sc: StoreController<E[], Node, E>;
  constructor(host: ControllerHost, options: ControllerStoreOption = {}) {
    this.#sc = new StoreController<E[], Node, E>(host, (s) => s.edges, Object.is, options as never);
  }
  /** The current edges. */
  get value(): E[] {
    return this.#sc.store ? this.#sc.value : [];
  }
  hostConnected(): void {}
}

/** The viewport (React `useViewport`); the host updates on every pan or zoom frame. */
export class ViewportController implements ReactiveController {
  readonly #sc: StoreController<Viewport>;
  constructor(host: ControllerHost, options: ControllerStoreOption = {}) {
    this.#sc = new StoreController(
      host,
      (s) => ({ x: s.transform[0], y: s.transform[1], zoom: s.transform[2] }),
      shallow,
      options,
    );
  }
  /** The current viewport (`{ x: 0, y: 0, zoom: 1 }` before a flow is known). */
  get value(): Viewport {
    return this.#sc.store ? this.#sc.value : { x: 0, y: 0, zoom: 1 };
  }
  hostConnected(): void {}
}

/** Id of the enclosing node (React `useNodeId`), from `nodeIdContext`. */
export class NodeIdController implements ReactiveController {
  #id: string | undefined;
  constructor(host: ControllerHost) {
    new ContextConsumer(host, {
      context: nodeIdContext,
      subscribe: true,
      callback: (value) => {
        if (value !== this.#id) {
          this.#id = value;
          host.requestUpdate();
        }
      },
    });
  }
  /** The node id, or `undefined` outside a node. */
  get value(): string | undefined {
    return this.#id;
  }
  hostConnected(): void {}
}

/**
 * One internal node (React `useInternalNode`). The host updates when the node object is replaced
 * and when its absolute position or z-index changes (the engine mutates those in place).
 */
export class InternalNodeController<N extends Node = Node> implements ReactiveController {
  readonly #sc: StoreController<readonly unknown[], N>;
  constructor(
    host: ControllerHost,
    id: string | undefined | (() => string | undefined),
    options: ControllerStoreOption = {},
  ) {
    this.#sc = new StoreController<readonly unknown[], N>(
      host,
      (s) => {
        const node = s.nodeLookup.get((typeof id === 'function' ? id() : id) ?? '');
        return [
          node,
          node?.internals.positionAbsolute.x,
          node?.internals.positionAbsolute.y,
          node?.internals.z,
        ];
      },
      shallow,
      options as never,
    );
  }
  /** The node, or `undefined` while it does not exist. */
  get value(): InternalNode<N> | undefined {
    return this.#sc.store ? (this.#sc.value[0] as InternalNode<N> | undefined) : undefined;
  }
  hostConnected(): void {}
}

type NodeData = { id: string; type?: string; data: unknown };

/**
 * `id`, `type` and `data` of one node or several (React `useNodesData`). With an array of ids the
 * value is an array (missing nodes are skipped); with one id it is the data or `null`.
 */
export class NodesDataController<N extends Node = Node> implements ReactiveController {
  readonly #sc: StoreController<NodeData | NodeData[] | null, N>;
  constructor(
    host: ControllerHost,
    ids: string | string[] | (() => string | string[]),
    options: ControllerStoreOption = {},
  ) {
    this.#sc = new StoreController<NodeData | NodeData[] | null, N>(
      host,
      (s) => {
        const wanted = typeof ids === 'function' ? ids() : ids;
        const isArray = Array.isArray(wanted);
        const data: NodeData[] = [];
        for (const id of isArray ? wanted : [wanted]) {
          const node = s.nodeLookup.get(id);
          if (node) data.push({ id: node.id, type: node.type, data: node.data });
        }
        return isArray ? data : (data[0] ?? null);
      },
      shallowNodeData as never,
      options as never,
    );
  }
  /** The data, in the shape of the requested ids. */
  get value(): NodeData | NodeData[] | null {
    return this.#sc.store ? this.#sc.value : null;
  }
  hostConnected(): void {}
}

/**
 * The connection being drawn (React `useConnection`), with `to` in flow coordinates while a
 * connection is in progress. Pass a selector to pick one field.
 */
export class ConnectionController<T = ConnectionState<InternalNode>> implements ReactiveController {
  readonly #sc: StoreController<T>;
  constructor(
    host: ControllerHost,
    selector?: (connection: ConnectionState<InternalNode>) => T,
    options: ControllerStoreOption = {},
  ) {
    this.#sc = new StoreController<T>(
      host,
      (s: FlowState) => {
        const connection = (
          s.connection.inProgress
            ? { ...s.connection, to: pointToRendererPoint(s.connection.to, s.transform) }
            : { ...s.connection }
        ) as ConnectionState<InternalNode>;
        return selector ? selector(connection) : (connection as T);
      },
      shallow,
      options,
    );
  }
  /** The selected connection state. */
  get value(): T {
    return this.#sc.value;
  }
  hostConnected(): void {}
}

/**
 * Whether every node is measured (React `useNodesInitialized`). With `includeHiddenNodes`, hidden
 * nodes count too.
 */
export class NodesInitializedController implements ReactiveController {
  readonly #sc: StoreController<boolean>;
  constructor(
    host: ControllerHost,
    o: { includeHiddenNodes?: boolean } & ControllerStoreOption = {},
  ) {
    this.#sc = new StoreController<boolean>(
      host,
      (s) => {
        if (!o.includeHiddenNodes) return s.nodesInitialized;
        if (s.nodeLookup.size === 0) return false;
        for (const [, { internals }] of s.nodeLookup) {
          if (internals.handleBounds === undefined || !nodeHasDimensions(internals.userNode)) {
            return false;
          }
        }
        return true;
      },
      Object.is,
      o.store ? { store: o.store } : {},
    );
  }
  /** True once everything is measured. */
  get value(): boolean {
    return this.#sc.store ? this.#sc.value : false;
  }
  hostConnected(): void {}
}
