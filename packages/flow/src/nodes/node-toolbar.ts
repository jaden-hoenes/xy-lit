// Ported from xyflow (MIT) packages/react/src/additional-components/NodeToolbar/NodeToolbar.tsx, packages/svelte/src/lib/plugins/NodeToolbar/NodeToolbar.svelte@3d35b57
import { nothing } from 'lit';
import type { ChildPart } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import { Position } from '@xy-lit/store';
import type { Align, FlowStore, InternalNode } from '@xy-lit/store';
import { getInternalNodesBounds, getNodeToolbarTransform } from '@xy-lit/store/internal';
import type { XyFlowElement } from '../elements/xy-flow.js';
import type { XyNodeElement } from '../elements/xy-node.js';

/** Options of {@link nodeToolbar}. */
export type NodeToolbarOptions = {
  /** Node id(s) the toolbar belongs to. Default: the enclosing node. */
  nodeId?: string | string[];
  /** Show or hide. Default: shown while the node is the only selected node. */
  isVisible?: boolean;
  /** Side of the node. Default `top`. */
  position?: Position | 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along that side. Default `center`. */
  align?: Align;
  /** Gap between node and toolbar in pixels. Default 10. */
  offset?: number;
  /** Extra classes of the toolbar element. */
  class?: string;
  /** Extra inline style of the toolbar element. */
  style?: string;
};

/** A toolbar registered with its flow by the {@link nodeToolbar} directive. */
export type ToolbarEntry = {
  /** Identity of the directive instance. */
  key: number;
  /** The nodes the toolbar is attached to. */
  nodeIds: string[];
  /** The options of the latest render. */
  options: NodeToolbarOptions;
  /** What to show inside the toolbar. */
  content: unknown;
};

/** A toolbar that should be rendered now, with its resolved geometry. */
export type ActiveToolbar = {
  key: number;
  class: string;
  style: string;
  dataId: string;
  content: unknown;
};

let nextKey = 0;

class NodeToolbarDirective extends AsyncDirective {
  readonly #key = nextKey++;
  #flow: XyFlowElement | null = null;
  #entry: ToolbarEntry | null = null;

  render(options: NodeToolbarOptions, content: unknown): typeof nothing {
    void options;
    void content;
    return nothing;
  }

  override update(part: ChildPart, [options, content]: [NodeToolbarOptions, unknown]) {
    // the owning node: the renderer's output (and element node types) live inside `<xy-node>`
    const owner = (part.parentNode as Element | null)?.closest?.<XyNodeElement>('xy-node') ?? null;
    const flow = owner?.ctx?.flow ?? null;
    const nodeIds = (
      Array.isArray(options.nodeId) ? options.nodeId : [options.nodeId ?? owner?.nodeId]
    ).filter((id): id is string => typeof id === 'string');
    if (this.#flow && this.#flow !== flow) this.#flow.removeToolbar(this.#key);
    this.#flow = flow;
    this.#entry = { key: this.#key, nodeIds, options, content };
    flow?.setToolbar(this.#entry);
    return nothing;
  }

  protected override disconnected(): void {
    this.#flow?.removeToolbar(this.#key);
  }

  protected override reconnected(): void {
    if (this.#flow && this.#entry) this.#flow.setToolbar(this.#entry);
  }
}

/**
 * Show a toolbar next to a node, outside the scaled viewport so it keeps its size (React
 * `NodeToolbar`). Use it inside a node renderer (or a `FlowNodeElement`'s `render`): the directive
 * registers the content with the flow, which renders every toolbar in its own layer.
 *
 * By default the toolbar is visible while its node is selected and no other node is.
 *
 * @param options - See {@link NodeToolbarOptions}.
 * @param content - The toolbar content (a Lit template or text).
 * @example
 * render: ({ data }) => html`
 *   ${nodeToolbar({ position: 'top' }, html`<button>delete</button>`)}
 *   <div>${data.label}</div>`
 */
export const nodeToolbar: (options: NodeToolbarOptions, content: unknown) => unknown =
  directive(NodeToolbarDirective);

/**
 * Resolve which registered toolbars are shown and where (React `NodeToolbar` body).
 *
 * @param store - The flow's store.
 * @param entries - All registered toolbars.
 */
export function activeToolbars(store: FlowStore, entries: Iterable<ToolbarEntry>): ActiveToolbar[] {
  const s = store.getState();
  const [x, y, zoom] = s.transform;
  let selectedCount = -1;
  const out: ActiveToolbar[] = [];
  for (const entry of entries) {
    const nodes = new Map<string, InternalNode>();
    for (const id of entry.nodeIds) {
      const node = s.nodeLookup.get(id);
      if (node) nodes.set(id, node);
    }
    if (nodes.size === 0) continue;
    const { options } = entry;
    let active = options.isVisible;
    if (typeof active !== 'boolean') {
      if (selectedCount < 0) selectedCount = s.nodes.filter((n) => n.selected).length;
      active = nodes.size === 1 && !!nodes.values().next().value?.selected && selectedCount === 1;
    }
    if (!active) continue;
    const rect = getInternalNodesBounds(nodes);
    const transform = getNodeToolbarTransform(
      rect,
      { x, y, zoom },
      (options.position as Position | undefined) ?? Position.Top,
      options.offset ?? 10,
      options.align ?? 'center',
    );
    const zIndex = Math.max(...[...nodes.values()].map((node) => (node.internals.z || 5) + 1));
    out.push({
      key: entry.key,
      class: options.class ?? '',
      style: `position:absolute;transform:${transform};z-index:${zIndex};${options.style ?? ''}`,
      dataId: [...nodes.keys()].join(' '),
      content: entry.content,
    });
  }
  return out;
}
