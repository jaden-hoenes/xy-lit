import type { CSSResultGroup, TemplateResult, nothing } from 'lit';
import type { FlowInstance, Node, NodeProps, NodeResizerDefaults } from '@xy-lit/store';
import type { FlowNodeElement } from './flow-node-element.js';

/** A function that renders the content of a node of one type. */
export type NodeRenderer<N extends Node = Node> = (
  props: NodeProps<N>,
  flow: FlowInstance,
) => TemplateResult | typeof nothing | string;

/** A node type that is rendered by a function (see {@link defineNodeType}). */
export type NodeTypeDefinition<N extends Node = Node> = {
  readonly kind: 'renderer';
  /** Renders the node content. Runs when the node's props change. */
  readonly render: NodeRenderer<N>;
  /** Adopted into the flow root once per flow, deduplicated by object identity. */
  readonly styles?: CSSResultGroup;
  /** Resizer defaults: `<xy-node>` renders `<xy-node-resizer>` before the content. */
  readonly resizer?: NodeResizerDefaults;
  /**
   * Set when `render` reads `positionAbsoluteX` / `positionAbsoluteY` / `zIndex`: the node is then
   * re-rendered when it moves. By default a pure move only updates the host's transform.
   */
  readonly usesPosition?: boolean;
};

/**
 * Define a node type rendered by a function.
 *
 * @param def.render - Returns the node's content as a Lit template (or text).
 * @param def.styles - CSS for the content, written for the light DOM (`.my-node .title { ... }`).
 * @param def.resizer - Opt into a node resizer with these defaults.
 * @param def.usesPosition - The renderer depends on the node's position.
 * @example
 * const labeled = defineNodeType<Node<{ label: string }>>({
 *   render: ({ data }) => html`<b>${data.label}</b><xy-handle type="source"></xy-handle>`,
 * });
 * flow.nodeTypes = { labeled };
 */
export function defineNodeType<N extends Node = Node>(def: {
  render: NodeRenderer<N>;
  styles?: CSSResultGroup;
  resizer?: NodeResizerDefaults;
  usesPosition?: boolean;
}): NodeTypeDefinition<N> {
  return Object.freeze({ kind: 'renderer' as const, ...def });
}

/**
 * What `nodeTypes` accepts per type: a renderer definition, a {@link FlowNodeElement} subclass, or
 * the tag name of a registered element that extends it.
 */
export type NodeTypeEntry =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- node data is invariant in the entry types
  | NodeTypeDefinition<any>
  | (new () => FlowNodeElement<never> | (HTMLElement & { props: unknown; flow: unknown }))
  | string;
/** Map of node `type` to how it is rendered. */
export type NodeTypes = Record<string, NodeTypeEntry>;
