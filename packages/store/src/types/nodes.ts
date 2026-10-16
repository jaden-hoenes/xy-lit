import type { NodeBase, InternalNodeBase, NodePropsBase } from '../engine.js';

/**
 * A node of the flow. Upstream `NodeBase` plus the DOM-binding additions of XY Lit.
 *
 * `class` and `style` are strings (as in Svelte Flow) so they map straight to host attributes.
 */
export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string | undefined = string | undefined,
> = NodeBase<NodeData, NodeType> & {
  /** Extra classes for the `<xy-node>` host. Space-separated string. */
  class?: string;
  /** Inline style string for the `<xy-node>` host, e.g. `"background: red;"`. */
  style?: string;
  /** Whether the node can receive keyboard focus. Overrides the flow's `nodesFocusable`. */
  focusable?: boolean;
  /** Set by the change pipeline while a node resizer gesture is active. */
  resizing?: boolean;
  /** ARIA role for the node host. Default `"group"` when focusable. */
  ariaRole?: string;
  /**
   * Extra attributes for the `<xy-node>` host. Keys must match `/^(data|aria)-[a-z0-9-]+$/` or be
   * one of: `title`, `lang`, `dir`, `tabindex`. Anything else is dropped with dev warning `XYL01`.
   */
  domAttributes?: Record<string, string>;
  /**
   * Local-only presence info filled in by collaborative sources. Never persisted, never sent;
   * `toObject()` strips it. Used by `<xy-node>` for remote selection rings and highlights.
   */
  remote?: RemoteNodeMeta;
};

/** A remote collaborator, as shown in presence decorations. */
export type RemoteUser = {
  /** Awareness client id. */
  clientId: number;
  /** Stable user id. */
  id: string;
  /** Display name. */
  name: string;
  /** CSS colour. */
  color: string;
};

/** Presence information attached to a node by a collaborative source (local only). */
export type RemoteNodeMeta = {
  /** Remote users that currently have the node selected. */
  selectedBy?: RemoteUser[];
  /** Remote user that is currently dragging the node. */
  draggingBy?: RemoteUser;
  /** Remote user that is currently resizing the node. */
  resizingBy?: RemoteUser;
  /** Set for about 1.5 s after a remote insert. */
  addedBy?: RemoteUser;
};

/** The engine's internal representation of a node (adds `measured` and `internals`). */
export type InternalNode<N extends Node = Node> = InternalNodeBase<N>;

/** The built-in node types shipped with `@xy-lit/flow`. */
export type BuiltInNode =
  | Node<{ label: string }, 'input' | 'output' | 'default' | undefined>
  | Node<Record<string, never>, 'group'>;

/** Props passed to node renderers and `FlowNodeElement`. */
export type NodeProps<N extends Node = Node> = NodePropsBase<N> & {
  type: N['type'] extends string ? N['type'] : string;
};
