// Ported from xyflow (MIT) packages/svelte/src/lib/components/Handle/Handle.svelte, packages/react/src/components/Handle/index.tsx@3d35b57
import { ContextConsumer } from '@lit/context';
import { LitElement, nothing } from 'lit';
import { ConnectionMode, Position } from '@xy-lit/store';
import type { FinalConnectionState, HandleType, IsValidConnection } from '@xy-lit/store';
import {
  XYHandle,
  getHostForElement,
  isMouseEvent,
  areConnectionMapsEqual,
  handleConnectionChange,
} from '@xy-lit/store/internal';
import type { HandleConnection } from '@xy-lit/store';
import { flowContext, nodeConnectableContext, nodeIdContext } from '../context.js';
import type { FlowContextValue } from '../context.js';
import { booleanAttr } from './xy-flow/attributes.js';
import { handleKey } from './xy-flow/connection-hub.js';
import type { ConnectionHubState, HubHandle } from './xy-flow/connection-hub.js';

const POSITION_CLASSES = ['top', 'bottom', 'left', 'right'];

/**
 * A connection point of a node. Place it inside a node's content; it finds its node through
 * context. Renders into the light DOM (any children you put inside stay as they are).
 *
 * Writes the DOM contract the engine reads onto its host (`data-handleid`, `data-nodeid`,
 * `data-handlepos`, `data-id`, the `lit-flow__handle` classes) synchronously in `willUpdate`, so
 * the classes exist before the first measurement.
 *
 * @csspart handle - The handle element itself.
 * @fires handle-connect - Connections to this handle were added (`detail.connections`).
 * @fires handle-disconnect - Connections to this handle were removed (`detail.connections`).
 * @tag xy-handle
 */
export class XyHandleElement extends LitElement implements HubHandle {
  static override properties = {
    type: { reflect: false },
    position: { reflect: false },
    handleId: { attribute: 'handle-id' },
    isConnectable: {
      attribute: 'is-connectable',
      converter: {
        fromAttribute: (value: string | null): boolean | undefined =>
          value === null ? undefined : value !== 'false',
      },
    },
    isConnectableStart: { attribute: 'is-connectable-start', converter: booleanAttr(true) },
    isConnectableEnd: { attribute: 'is-connectable-end', converter: booleanAttr(true) },
    isValidConnection: { attribute: false },
  };

  /** `source` (default) or `target`. */
  declare type: HandleType;
  /** Side of the node the handle sits on. */
  declare position: Position;
  /** Id of the handle, needed when a node has several handles of one type. */
  declare handleId: string | null;
  /** Overrides whether the node is connectable for this handle. */
  declare isConnectable: boolean | undefined;
  /** Connections may start here. */
  declare isConnectableStart: boolean;
  /** Connections may end here. */
  declare isConnectableEnd: boolean;
  /** Handle specific validator; defaults to the flow's. */
  declare isValidConnection: IsValidConnection | undefined;

  /** The context consumers register themselves on the host; kept to make that explicit. */
  #nodeId: string | undefined;
  #nodeConnectable = true;
  #flow: FlowContextValue | undefined;
  #registeredKey: string | null = null;
  #registeredHub: FlowContextValue['hub'] = null;
  #hubState: ConnectionHubState | null = null;
  #lastPosition: Position | null = null;
  #suppressNextClick = false;
  #connectionCallbacks: (() => void) | null = null;
  #prevConnections: Map<string, HandleConnection> | null = null;
  #measured = '';
  #listenerTypes = new Set<string>();

  constructor() {
    super();
    this.type = 'source';
    this.position = Position.Top;
    this.handleId = null;
    this.isConnectable = undefined;
    this.isConnectableStart = true;
    this.isConnectableEnd = true;
    this.isValidConnection = undefined;

    // the consumers register themselves on the host
    new ContextConsumer(this, {
      context: nodeIdContext,
      subscribe: true,
      callback: (value) => {
        this.#nodeId = value;
        this.requestUpdate();
      },
    });
    new ContextConsumer(this, {
      context: nodeConnectableContext,
      subscribe: true,
      callback: (value) => {
        this.#nodeConnectable = value;
        this.requestUpdate();
      },
    });
    new ContextConsumer(this, {
      context: flowContext,
      subscribe: true,
      callback: (value) => {
        this.#flow = value;
        this.requestUpdate();
      },
    });

    // internal listeners bypass the override below (it only watches for handle-connect listeners)
    super.addEventListener('pointerdown', this.#onPointerDown);
    super.addEventListener('mousedown', this.#onMouseDownOrTouchStart);
    super.addEventListener('touchstart', this.#onMouseDownOrTouchStart, { passive: false });
    super.addEventListener('click', this.#onClick);
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Node id this handle belongs to (from context). */
  get nodeId(): string | undefined {
    return this.#nodeId;
  }

  /** Key under which this handle registers at the connection hub. */
  get key(): string | null {
    return this.#nodeId === undefined ? null : handleKey(this.#nodeId, this.type, this.handleId);
  }

  // --- lifecycle -----------------------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#requestMeasure();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unregister();
    this.#connectionCallbacks?.();
    this.#connectionCallbacks = null;
    this.#requestMeasure();
  }

  /**
   * Starts watching the flow's edges as soon as the first `handle-connect` / `handle-disconnect`
   * listener is added, so handles nobody listens to pay nothing.
   */
  override addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: XyHandleElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: unknown,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) return;
    super.addEventListener(type, listener as EventListenerOrEventListenerObject, options);
    if (type === 'handle-connect' || type === 'handle-disconnect') {
      this.#listenerTypes.add(type);
      if (this.isConnected && this.#flow) this.#watchConnections();
    }
  }

  protected override willUpdate(): void {
    const flow = this.#flow;
    const nodeId = this.#nodeId;
    if (nodeId === undefined) {
      this.#unregister();
      return;
    }
    const s = flow?.store.getState();
    const flowId = s?.flowId ?? '1';

    this.#setAttr('data-handleid', this.handleId);
    this.#setAttr('data-nodeid', nodeId);
    this.#setAttr('data-handlepos', this.position);
    this.#setAttr('data-id', `${flowId}-${nodeId}-${this.handleId ?? 'null'}-${this.type}`);
    this.#setAttr('role', 'button');
    this.#setAttr('aria-label', s?.ariaLabelConfig['handle.ariaLabel'] ?? 'Handle');
    this.#setAttr('tabindex', '-1');
    this.#setAttr('part', 'handle');

    const cl = this.classList;
    if (this.#lastPosition && this.#lastPosition !== this.position) {
      cl.remove(`lit-flow__handle-${this.#lastPosition}`, this.#lastPosition);
    }
    this.#lastPosition = this.position;
    cl.add('lit-flow__handle', `lit-flow__handle-${this.position}`);
    if (POSITION_CLASSES.includes(this.position)) cl.add(this.position);
    if (s) {
      cl.add(s.noDragClassName, s.noPanClassName);
    }
    cl.toggle('source', this.type === 'source');
    cl.toggle('target', this.type === 'target');
    cl.toggle('connectablestart', this.isConnectableStart);
    cl.toggle('connectableend', this.isConnectableEnd);
    cl.toggle('connectable', this.#connectable);

    // register at the hub; it answers with the current connection state
    const key = this.key;
    if (key !== this.#registeredKey || flow?.hub !== this.#registeredHub) {
      this.#unregister();
      if (key !== null && flow?.hub) {
        flow.hub.register(key, this);
        this.#registeredKey = key;
        this.#registeredHub = flow.hub;
      }
    } else if (this.#hubState) {
      this.applyConnectionState(this.#hubState);
    }
  }

  protected override updated(): void {
    // the handle's size or place may have changed: tell the node to measure again
    const signature = `${this.#nodeId}|${this.type}|${this.position}|${this.handleId}`;
    if (signature !== this.#measured) {
      this.#measured = signature;
      this.#requestMeasure();
    }
    if (this.#listenerTypes.size > 0) this.#watchConnections();
  }

  protected override render(): typeof nothing {
    return nothing;
  }

  get #connectable(): boolean {
    return this.isConnectable ?? this.#nodeConnectable;
  }

  #setAttr(name: string, value: string | null): void {
    if (value === null) {
      if (this.hasAttribute(name)) this.removeAttribute(name);
    } else if (this.getAttribute(name) !== value) {
      this.setAttribute(name, value);
    }
  }

  #requestMeasure(): void {
    const id = this.#nodeId;
    if (id !== undefined) this.#flow?.measure?.requestMeasure([id]);
  }

  #unregister(): void {
    if (this.#registeredKey !== null) {
      this.#registeredHub?.unregister(this.#registeredKey, this);
    }
    this.#registeredKey = null;
    this.#registeredHub = null;
  }

  // --- connection highlight ------------------------------------------------------------------------

  /**
   * Called by the connection hub: recompute `connectingfrom`, `connectingto`, `valid` and
   * `connectionindicator` for the connection in progress.
   *
   * @param state - What the hub knows.
   */
  applyConnectionState(state: ConnectionHubState): void {
    this.#hubState = state;
    const key = this.key;
    if (key === null) return;
    const connectingFrom = state.inProgress && state.fromKey === key;
    const connectingTo = state.inProgress && state.toKey === key;
    const isPossibleTarget =
      state.connectionMode === ConnectionMode.Strict
        ? state.fromType !== this.type
        : this.#nodeId !== state.fromNodeId || this.handleId !== state.fromHandleId;
    const valid = connectingTo && state.isValid === true;
    const connectionActive = state.inProgress || state.clickStart;
    const indicator =
      this.#connectable &&
      (!state.inProgress || isPossibleTarget) &&
      (connectionActive ? this.isConnectableEnd : this.isConnectableStart);
    const cl = this.classList;
    cl.toggle('connectingfrom', connectingFrom);
    cl.toggle('connectingto', connectingTo);
    cl.toggle('valid', valid);
    cl.toggle('connectionindicator', indicator);
  }

  // --- handle-connect / handle-disconnect --------------------------------------------------------

  #watchConnections(): void {
    const flow = this.#flow;
    if (this.#connectionCallbacks || !flow || this.#nodeId === undefined) return;
    const { store } = flow;
    const lookupKey = (): string =>
      `${this.#nodeId}-${this.type}${this.handleId ? `-${this.handleId}` : ''}`;
    this.#prevConnections = new Map(store.getState().connectionLookup.get(lookupKey()));
    this.#connectionCallbacks = store.subscribe(() => {
      const connections = store.getState().connectionLookup.get(lookupKey());
      const previous = this.#prevConnections;
      if (previous && !areConnectionMapsEqual(connections, previous)) {
        const next = connections ?? new Map<string, HandleConnection>();
        handleConnectionChange(previous, next, (removed) => {
          this.#emitConnections('handle-disconnect', removed);
        });
        handleConnectionChange(next, previous, (added) => {
          this.#emitConnections('handle-connect', added);
        });
      }
      this.#prevConnections = new Map(connections);
    });
  }

  #emitConnections(
    type: 'handle-connect' | 'handle-disconnect',
    connections: HandleConnection[],
  ): void {
    this.dispatchEvent(
      new CustomEvent(type, { detail: { connections }, bubbles: true, composed: true }),
    );
  }

  // --- pointer: starting a connection -------------------------------------------------------------

  readonly #onPointerDown = (event: PointerEvent): void => {
    this.#suppressNextClick = false;
    if (event.pointerType !== 'touch' && event.button === 0 && this.isConnectableStart) {
      // keeps the following mouse events coming even when the pointer leaves the flow
      try {
        this.setPointerCapture(event.pointerId);
      } catch {
        // capture is an optimisation for pointers outside the flow; a refusal is harmless
      }
    }
  };

  readonly #onMouseDownOrTouchStart = (event: MouseEvent | TouchEvent): void => {
    const flow = this.#flow;
    const nodeId = this.#nodeId;
    if (!flow?.flow || nodeId === undefined || !this.isConnectableStart) return;
    if (isMouseEvent(event) && event.button !== 0) return;
    const { store } = flow;
    const s = store.getState();
    const host = flow.flow;
    XYHandle.onPointerDown(event, {
      handleId: this.handleId,
      nodeId,
      isTarget: this.type === 'target',
      connectionRadius: s.connectionRadius,
      domNode: s.domNode,
      nodeLookup: s.nodeLookup,
      connectionMode: s.connectionMode,
      lib: 'lit',
      autoPanOnConnect: s.autoPanOnConnect,
      autoPanSpeed: s.autoPanSpeed,
      flowId: s.flowId,
      isValidConnection: (c) =>
        (this.isValidConnection ?? store.getState().isValidConnection)?.(c) ?? true,
      updateConnection: (connection) => {
        store.updateConnection(connection);
      },
      cancelConnection: () => {
        store.cancelConnection();
      },
      panBy: (delta) => store.panBy(delta),
      onConnect: (connection) => {
        host.handleConnect(connection);
      },
      onConnectStart: (e, params) => {
        this.#suppressNextClick = true;
        host.emit('connect-start', { event: e, ...params });
      },
      onConnectEnd: (e, connectionState) => {
        host.emit('connect-end', {
          event: e,
          connectionState: connectionState,
        });
      },
      getTransform: () => store.getState().transform,
      getFromHandle: () => store.getState().connection.fromHandle,
      dragThreshold: s.connectionDragThreshold,
      handleDomNode: this,
    });
  };

  // --- click-connect --------------------------------------------------------------------------------

  readonly #onClick = (event: MouseEvent): void => {
    const flow = this.#flow;
    const nodeId = this.#nodeId;
    if (!flow?.flow || nodeId === undefined) return;
    if (this.#suppressNextClick) {
      // pointer capture makes the browser click the handle after a connection drag
      this.#suppressNextClick = false;
      return;
    }
    const { store } = flow;
    const host = flow.flow;
    const s = store.getState();
    if (!s.connectOnClick) return;
    const start = s.connectionClickStartHandle;
    if (!start && !this.isConnectableStart) return;

    if (!start) {
      host.emit('click-connect-start', {
        event,
        nodeId,
        handleId: this.handleId,
        handleType: this.type,
      });
      store.setState({
        connectionClickStartHandle: { nodeId, type: this.type, id: this.handleId },
      });
      return;
    }

    const { connection, isValid } = XYHandle.isValid(event, {
      handle: { nodeId, id: this.handleId, type: this.type },
      connectionMode: s.connectionMode,
      fromNodeId: start.nodeId,
      fromHandleId: start.id,
      fromType: start.type,
      isValidConnection: (c) => (this.isValidConnection ?? s.isValidConnection)?.(c) ?? true,
      flowId: s.flowId,
      doc: getHostForElement(event.target),
      lib: 'lit',
      nodeLookup: s.nodeLookup,
    });
    if (isValid && connection) host.handleConnect(connection);

    const { inProgress: _inProgress, ...connectionState } = s.connection;
    void _inProgress;
    const final = {
      ...connectionState,
      toPosition: connectionState.toHandle ? connectionState.toHandle.position : null,
    } as unknown as FinalConnectionState;
    host.emit('click-connect-end', { event, connectionState: final });
    store.setState({ connectionClickStartHandle: null });
  };
}
