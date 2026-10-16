import { LitElement } from 'lit';
import type { FlowInstance, Node, NodeProps, NodeResizerDefaults } from '@xy-lit/store';

/**
 * Base class for node types that need their own state or lifecycle. Register the subclass with
 * `customElements.define` and put the constructor (or the tag name) in `nodeTypes`.
 *
 * Renders into its own light DOM, so it joins the flow's single shadow tree: handles inside it are
 * found by the engine and its `static styles` are adopted into the flow root (write them for the
 * light DOM: `sum-node .total { ... }`, not `:host`).
 */
export abstract class FlowNodeElement<N extends Node = Node> extends LitElement {
  static override properties = {
    props: { attribute: false },
    flow: { attribute: false },
  };

  /** Resizer defaults; when set, `<xy-node>` renders a node resizer before the content. */
  static resizer?: NodeResizerDefaults;

  /** The node's props, set by `<xy-node>` on every update. */
  declare props: NodeProps<N>;
  /** The flow's imperative API. */
  declare flow: FlowInstance;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Id of the node. */
  get nodeId(): string {
    return this.props.id;
  }

  /** The node's `data`. */
  get data(): N['data'] {
    return this.props.data;
  }
}
