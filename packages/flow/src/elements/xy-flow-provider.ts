// Ported from xyflow (MIT) packages/react/src/components/ReactFlowProvider/index.tsx, packages/svelte/src/lib/components/SvelteFlowProvider/SvelteFlowProvider.svelte@3d35b57
import { ContextProvider } from '@lit/context';
import { LitElement, nothing } from 'lit';
import { FlowStore, devWarn } from '@xy-lit/store';
import type { FlowInstance } from '@xy-lit/store';
import { flowContext } from '../context.js';
import type { FlowContextValue, FlowProvider } from '../context.js';
import type { XyFlowElement } from './xy-flow.js';

/**
 * Owns a flow's store outside the `<xy-flow>` element, so components that sit next to the flow
 * (toolbars, side panels, sidebars) can read and change the flow's state with `StoreController`
 * or `flow.instance`. A `<xy-flow>` below the provider uses the provider's store instead of
 * creating its own.
 *
 * Renders nothing and takes no space (`display: contents`). One provider serves one flow at a
 * time; a second flow keeps its own store and reports development warning `XYL03`.
 *
 * @example
 * ```html
 * <xy-flow-provider>
 *   <my-sidebar></my-sidebar>   <!-- reads the store through flowContext -->
 *   <xy-flow></xy-flow>
 * </xy-flow-provider>
 * ```
 * @tag xy-flow-provider
 */
export class XyFlowProviderElement extends LitElement implements FlowProvider {
  readonly #store = new FlowStore();
  #flow: XyFlowElement | null = null;
  readonly #context: ContextProvider<typeof flowContext, XyFlowProviderElement>;

  constructor() {
    super();
    this.#context = new ContextProvider(this, {
      context: flowContext,
      initialValue: this.#value(null),
    });
  }

  #value(flow: XyFlowElement | null): FlowContextValue {
    return {
      store: this.#store,
      instance: this.#store.instance,
      flow,
      hub: flow?.hub ?? null,
      measure: flow?.measure ?? null,
      provider: this,
    };
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // not in the constructor: a constructor may not add attributes
    if (!this.style.display) this.style.display = 'contents';
  }

  /** The store shared with the flow below this element. */
  get store(): FlowStore {
    return this.#store;
  }

  /** The imperative API of the flow's store; usable before the flow exists. */
  get instance(): FlowInstance {
    return this.#store.instance;
  }

  /** The flow currently using this provider's store, if any. */
  get flow(): XyFlowElement | null {
    return this.#flow;
  }

  attachFlow(flow: XyFlowElement): boolean {
    if (this.#flow && this.#flow !== flow) {
      devWarn(
        'XYL03',
        '<xy-flow-provider> supports one <xy-flow> at a time; the second flow keeps its own store.',
      );
      return false;
    }
    this.#flow = flow;
    this.#context.setValue(this.#value(flow));
    return true;
  }

  detachFlow(flow: XyFlowElement): void {
    if (this.#flow !== flow) return;
    this.#flow = null;
    this.#context.setValue(this.#value(null));
  }

  protected override render(): typeof nothing {
    return nothing;
  }
}
