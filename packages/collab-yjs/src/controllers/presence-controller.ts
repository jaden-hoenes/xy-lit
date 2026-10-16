import { ContextConsumer } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { flowContext } from '@xy-lit/flow';
import type { FlowContextValue, XyFlowElement } from '@xy-lit/flow';
import type { FlowStore } from '@xy-lit/store';
import type { PresenceChannel } from '../awareness.js';

/** What a presence element wants to hear about. */
export type PresenceControllerCallbacks = {
  /** The flow (or its provider) the element sits under changed. */
  flowChanged?(flow: XyFlowElement | null, store: FlowStore | null): void;
  /** The flow's source has another presence channel (or none). */
  presenceChanged?(presence: PresenceChannel | undefined): void;
  /** Remote presence changed. */
  remotesChanged?(): void;
  /** The store notified (every microtask with changes). */
  storeChanged?(store: FlowStore): void;
};

/**
 * Connects a host element to the presence of the flow it sits under: finds the flow through
 * `flowContext`, follows the flow's source (`source.presence`) and subscribes to remote presence.
 */
export class PresenceController implements ReactiveController {
  /** The flow element the host sits under, `null` outside a flow. */
  flow: XyFlowElement | null = null;
  /** The flow's store, `null` outside a flow. */
  store: FlowStore | null = null;
  /** The presence channel of the flow's source, `undefined` when it has none. */
  presence: PresenceChannel | undefined;

  #connected = false;
  #unsubStore: (() => void) | null = null;
  #unsubPresence: (() => void) | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    private readonly callbacks: PresenceControllerCallbacks,
  ) {
    new ContextConsumer(host, {
      context: flowContext,
      subscribe: true,
      callback: (value: FlowContextValue) => this.#bind(value),
    });
    host.addController(this);
  }

  hostConnected(): void {
    this.#connected = true;
    if (this.store) this.#subscribe();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#unsubStore?.();
    this.#unsubStore = null;
    this.#setPresence(undefined);
  }

  #bind(value: FlowContextValue): void {
    const store = value.store;
    if (store === this.store && value.flow === this.flow) return;
    this.#unsubStore?.();
    this.#unsubStore = null;
    this.store = store;
    this.flow = value.flow;
    this.callbacks.flowChanged?.(this.flow, this.store);
    if (this.#connected) this.#subscribe();
  }

  #subscribe(): void {
    const store = this.store;
    if (!store) return;
    this.#unsubStore?.();
    const check = (): void => {
      this.#setPresence((store.source as { presence?: PresenceChannel }).presence);
      this.callbacks.storeChanged?.(store);
    };
    this.#unsubStore = store.subscribe(check);
    check();
  }

  #setPresence(presence: PresenceChannel | undefined): void {
    if (presence === this.presence) return;
    this.#unsubPresence?.();
    this.#unsubPresence = null;
    this.presence = presence;
    if (presence) this.#unsubPresence = presence.subscribe(() => this.callbacks.remotesChanged?.());
    this.callbacks.presenceChanged?.(presence);
  }
}
