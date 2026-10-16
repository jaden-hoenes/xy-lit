import { ContextConsumer } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Edge, FlowState, FlowStore, Node } from '@xy-lit/store';
import { flowContext } from '../context.js';

/** Options of {@link StoreController}. */
export type StoreControllerOptions<N extends Node = Node, E extends Edge = Edge> = {
  /**
   * Use this store instead of looking one up through `flowContext`. Pass `null` for a controller
   * that gets its store later through {@link StoreController.setStore} (used by `<xy-flow>`
   * itself, which creates its store on connect).
   */
  store?: FlowStore<N, E> | null;
  /**
   * Called when the selected value changed after the first computation (not for the first value
   * after attaching). Used by the connection controllers to report added/removed connections.
   */
  onChange?: (next: unknown, previous: unknown) => void;
  /**
   * Called when a store is attached; the returned function runs when it is detached. Used by
   * controllers that register something with the store (selection handlers).
   */
  onAttach?: (store: FlowStore<N, E>) => void | (() => void);
};

/**
 * Subscribes a host element to a slice of a flow's state. The selector runs on every store
 * notification (at most once per microtask); the host updates only when the selected value
 * changed according to `equals`.
 *
 * The store comes from the nearest `<xy-flow>` / `<xy-flow-provider>` through `flowContext`, or
 * from `options.store`. Until a store is attached, `value` is `undefined`.
 */
export class StoreController<
  T,
  N extends Node = Node,
  E extends Edge = Edge,
> implements ReactiveController {
  /** The current selected value (recomputed on every store notification). */
  value!: T;

  private currentStore: FlowStore<N, E> | undefined;
  private unsubscribe: (() => void) | null = null;
  private attachCleanup: (() => void) | null = null;
  private connected = false;
  private readonly options: StoreControllerOptions<N, E>;
  /** Registered on the host as a controller; kept for debugging. */
  private readonly consumer:
    ContextConsumer<typeof flowContext, ReactiveControllerHost & HTMLElement> | undefined;

  /**
   * @param host - The element to update.
   * @param selector - Picks the value out of the state (and store).
   * @param equals - Equality of two selected values. Default `Object.is`.
   * @param options - An explicit store (skips the context lookup).
   */
  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    private readonly selector: (state: FlowState<N, E>, store: FlowStore<N, E>) => T,
    private readonly equals: (a: T, b: T) => boolean = Object.is,
    options: StoreControllerOptions<N, E> = {},
  ) {
    this.options = options;
    if (options.store === undefined) {
      this.consumer = new ContextConsumer(host, {
        context: flowContext,
        subscribe: true,
        callback: (provided) => {
          // a provider without a store yet answers with `undefined`; the value arrives later
          this.setStore(provided?.store as unknown as FlowStore<N, E> | undefined);
        },
      });
    } else if (options.store !== null) {
      this.currentStore = options.store;
    }
    host.addController(this);
  }

  /** The store this controller reads, once known. */
  get store(): FlowStore<N, E> | undefined {
    return this.currentStore;
  }

  /**
   * Attach a store (or switch to another one). Recomputes `value` and, when the host is
   * connected, subscribes.
   *
   * @param store - The store to read.
   */
  setStore(store: FlowStore<N, E> | undefined): void {
    if (store === this.currentStore && this.unsubscribe) return;
    this.detach();
    this.currentStore = store;
    if (this.connected) {
      this.attach();
      this.host.requestUpdate();
    }
  }

  hostConnected(): void {
    this.connected = true;
    this.attach();
  }

  hostDisconnected(): void {
    this.connected = false;
    this.detach();
  }

  private attach(): void {
    const store = this.currentStore;
    if (!store || this.unsubscribe) return;
    this.value = this.selector(store.getState(), store);
    this.unsubscribe = store.subscribe(() => {
      const next = this.selector(store.getState(), store);
      if (!this.equals(this.value, next)) {
        const previous = this.value;
        this.value = next;
        this.options.onChange?.(next, previous);
        this.host.requestUpdate();
      }
    });
    const cleanup = this.options.onAttach?.(store);
    this.attachCleanup = typeof cleanup === 'function' ? cleanup : null;
  }

  /**
   * Recompute the value now (for selectors that read something besides the store, such as a node
   * id that arrives through context) and update the host when it changed.
   */
  refresh(): void {
    const store = this.currentStore;
    if (!store || !this.unsubscribe) return;
    const next = this.selector(store.getState(), store);
    if (!this.equals(this.value, next)) {
      const previous = this.value;
      this.value = next;
      this.options.onChange?.(next, previous);
      this.host.requestUpdate();
    }
  }

  private detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.attachCleanup?.();
    this.attachCleanup = null;
  }
}
