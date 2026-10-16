import { getStoreOf } from '@xy-lit/store';
import type { Edge, FlowInstance, FlowStore, Node } from '@xy-lit/store';
import type { XyFlowElement } from '@xy-lit/flow';

/**
 * What the pro helpers accept as "the flow": the `<xy-flow>` element, or its instance (the
 * object node renderers receive).
 */
export type FlowLike = XyFlowElement | FlowInstance;

/** A function that undoes an `install*` call. */
export type Disposer = () => void;

/** The store behind a {@link FlowLike}. */
export function storeOf<N extends Node = Node, E extends Edge = Edge>(
  flow: FlowLike,
): FlowStore<N, E> {
  if ('hasStore' in flow) return flow.store as unknown as FlowStore<N, E>;
  return getStoreOf(flow) as unknown as FlowStore<N, E>;
}

/** The instance of a {@link FlowLike}. */
export function instanceOf<N extends Node = Node, E extends Edge = Edge>(
  flow: FlowLike,
): FlowInstance<N, E> {
  return storeOf<N, E>(flow).instance;
}

/**
 * Run `attach` with the flow's store as soon as it exists. An `<xy-flow>` creates its store
 * when it first connects, so installing on a flow that is not in the document yet is fine: the
 * attach is deferred to its first update. Instances always have a store.
 *
 * @returns A disposer that also cancels a pending attach.
 */
export function withStore(
  flow: FlowLike,
  attach: (store: FlowStore, host: XyFlowElement | null) => Disposer | void,
): Disposer {
  let disposed = false;
  let cleanup: Disposer | void;
  const run = (): void => {
    if (disposed) return;
    cleanup = attach(storeOf(flow), 'hasStore' in flow ? flow : null);
  };
  if ('hasStore' in flow && !flow.hasStore) {
    void flow.updateComplete.then(() => {
      if (!disposed && flow.hasStore) run();
    });
  } else {
    run();
  }
  return () => {
    if (disposed) return;
    disposed = true;
    cleanup?.();
  };
}
