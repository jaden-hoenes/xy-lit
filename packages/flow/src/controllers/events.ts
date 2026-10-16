// Ported from xyflow (MIT) packages/react/src/hooks/useOnSelectionChange.ts, useOnViewportChange.ts@3d35b57
import { ContextConsumer } from '@lit/context';
import type { ReactiveController } from 'lit';
import type { Edge, FlowEventMap, FlowStore, Node, Viewport } from '@xy-lit/store';
import { flowContext } from '../context.js';
import type { FlowContextValue } from '../context.js';
import type { ControllerHost, ControllerStoreOption } from './flow-controllers.js';
import { StoreController } from './store-controller.js';

/**
 * Calls `callback` whenever the selection changes (React `useOnSelectionChange`). Registers in
 * the store's `selectionChangeHandlers` while the host is connected.
 */
export class OnSelectionChangeController<
  N extends Node = Node,
  E extends Edge = Edge,
> implements ReactiveController {
  constructor(
    host: ControllerHost,
    callback: (selection: { nodes: N[]; edges: E[] }) => void,
    options: ControllerStoreOption = {},
  ) {
    const key = Symbol('xy-lit.onSelectionChange');
    new StoreController<null, N, E>(host, () => null, Object.is, {
      ...(options as { store?: FlowStore<N, E> }),
      onAttach: (store) => {
        store.selectionChangeHandlers.set(key, callback);
        return () => {
          store.selectionChangeHandlers.delete(key);
        };
      },
    });
  }
  hostConnected(): void {}
}

/** Callbacks of {@link OnViewportChangeController}. */
export type ViewportChangeCallbacks = {
  /** A pan or zoom started. */
  onStart?: (viewport: Viewport) => void;
  /** The viewport changed. */
  onChange?: (viewport: Viewport) => void;
  /** A pan or zoom ended. */
  onEnd?: (viewport: Viewport) => void;
};

/**
 * Viewport change callbacks (React `useOnViewportChange`). Listens to the `move-start`, `move`
 * and `move-end` events of the flow element found through context, so it needs a flow (an
 * explicit `store` is not enough).
 */
export class OnViewportChangeController implements ReactiveController {
  #flow: FlowContextValue['flow'] | undefined;
  #connected = false;
  readonly #handlers: [keyof FlowEventMap, EventListener][];

  constructor(host: ControllerHost, callbacks: ViewportChangeCallbacks) {
    const forward =
      (get: () => ((viewport: Viewport) => void) | undefined): EventListener =>
      (event) => {
        get()?.((event as CustomEvent<{ viewport: Viewport }>).detail.viewport);
      };
    this.#handlers = [
      ['move-start', forward(() => callbacks.onStart)],
      ['move', forward(() => callbacks.onChange)],
      ['move-end', forward(() => callbacks.onEnd)],
    ];
    new ContextConsumer(host, {
      context: flowContext,
      subscribe: true,
      callback: (value) => {
        this.#unlisten();
        this.#flow = (value as FlowContextValue | undefined)?.flow;
        if (this.#connected) this.#listen();
      },
    });
    host.addController({
      hostConnected: () => {
        this.#connected = true;
        this.#listen();
      },
      hostDisconnected: () => {
        this.#connected = false;
        this.#unlisten();
      },
    });
  }

  #listen(): void {
    for (const [type, fn] of this.#handlers) this.#flow?.addEventListener(type, fn);
  }

  #unlisten(): void {
    for (const [type, fn] of this.#handlers) this.#flow?.removeEventListener(type, fn);
  }

  hostConnected(): void {}
}
