import { createContext } from '@lit/context';
import type { FlowInstance, FlowStore } from '@xy-lit/store';
import type { XyFlowElement } from './elements/xy-flow.js';
import type { ConnectionHub } from './elements/xy-flow/connection-hub.js';
import type { MeasureController } from './elements/xy-flow/measure.js';

/** Implemented by `<xy-flow-provider>`: told when a flow starts or stops using the provider's store. */
export interface FlowProvider {
  /**
   * A flow wants to use the provider's store.
   *
   * @returns False when the provider already serves another flow (the flow then keeps its own store).
   */
  attachFlow(flow: XyFlowElement): boolean;
  /** The flow stopped using the provider's store. */
  detachFlow(flow: XyFlowElement): void;
}

/** What a flow (or `<xy-flow-provider>`) provides to every element beneath it. */
export type FlowContextValue = {
  /** The state container. */
  store: FlowStore;
  /** The stable imperative API. */
  instance: FlowInstance;
  /** The flow element; `null` under a provider that has no flow attached yet. */
  flow: XyFlowElement | null;
  /** Connection highlighting hub; `null` under a provider with no flow. */
  hub: ConnectionHub | null;
  /** Node measuring; `null` under a provider with no flow. */
  measure: MeasureController | null;
  /** Present when the value comes from `<xy-flow-provider>`. */
  provider?: FlowProvider;
};

/**
 * Context provided by `<xy-flow>` (and `<xy-flow-provider>`). `Symbol.for` keeps it working when
 * two copies of the package are loaded.
 */
export const flowContext = createContext<FlowContextValue>(Symbol.for('xy-lit/flow'));
/** Id of the enclosing node, provided by `<xy-node>`. */
export const nodeIdContext = createContext<string>(Symbol.for('xy-lit/node-id'));
/** Whether the enclosing node is connectable, provided by `<xy-node>`. */
export const nodeConnectableContext = createContext<boolean>(Symbol.for('xy-lit/node-connectable'));
/** Id of the enclosing edge, provided by `<xy-edge>`. */
export const edgeIdContext = createContext<string>(Symbol.for('xy-lit/edge-id'));

/**
 * A `context-request` event as `@lit/context` providers expect it (the package does not export
 * its event class). `<xy-flow>` dispatches one on every connect to find a `<xy-flow-provider>`,
 * because a `ContextConsumer` without subscription only answers the first connection.
 */
export class FlowContextRequestEvent extends Event {
  /** @internal */
  constructor(
    readonly context: typeof flowContext,
    readonly contextTarget: Element,
    readonly callback: (value: FlowContextValue) => void,
    readonly subscribe = false,
  ) {
    super('context-request', { bubbles: true, composed: true });
  }
}
