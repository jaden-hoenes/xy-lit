/** Shared base for the `@xy-lit/ui` stories: one small flow per component, driven by the story args. */
import '@xy-lit/ui/define.js';
import { html, nothing } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node, NodeTypes, EdgeTypes, XyFlowElement } from '@xy-lit/flow';
import { uiStyles } from '@xy-lit/ui';
import { StoryElement, fitWhenRendered, once } from './flow.ts';

export { uiStyles };

const fit = { padding: 0.25 };

/**
 * A story with one flow. Subclasses give the nodes (and edges, node and edge types); node renderers
 * are closures over the story, so they read the current `this.args`. When a control changes, the
 * nodes are re-rendered by touching their data.
 */
export abstract class UiStory<A extends object> extends StoryElement {
  static override properties = { args: { attribute: false } };
  declare args: A;
  protected nodeTypes: NodeTypes = {};
  protected edgeTypes: EdgeTypes = {};
  protected flowAttrs: Record<string, string> = {};
  #last = '';

  protected abstract nodes(): Node[];
  protected edges(): Edge[] {
    return [];
  }
  /** Children of the `<xy-flow>` (plugins, panels). */
  protected plugins(): unknown {
    return nothing;
  }
  protected get flow(): XyFlowElement {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  protected override updated(): void {
    const key = JSON.stringify(this.args);
    if (this.#last && key !== this.#last && this.flow) {
      for (const n of this.flow.getNodes()) this.flow.updateNodeData(n.id, { rev: Math.random() });
    }
    this.#last = key;
  }

  override render() {
    return html`<xy-flow
      fit-view
      ${fitWhenRendered()}
      no-loading-overlay
      min-zoom="0.2"
      connection-mode="loose"
      style="--xy-edge-stroke: var(--sb-edge, #8b92a8)"
      .fitViewOptions=${fit}
      .nodeTypes=${this.nodeTypes}
      .edgeTypes=${this.edgeTypes}
      .nodes=${once(() => this.nodes())}
      .edges=${once(() => this.edges())}
    >
      <xy-background variant="dots" gap="22" size="1.4"></xy-background>
      <xy-controls position="bottom-left"></xy-controls>
      ${this.plugins()}
    </xy-flow>`;
  }
}

/** A small plain node used as the end of an edge or beside a component. */
export const smallType = defineNodeType({
  styles: uiStyles,
  render: ({ data, selected }) =>
    html`<xy-base-node
      class="xy-ui-node"
      ?selected=${selected}
      style="--xy-base-node-padding: 8px 14px; --xy-base-node-min-width: 96px"
    >
      ${String((data as { label?: unknown }).label ?? '')}
      <xy-handle type="target" position="left"></xy-handle>
      <xy-handle type="source" position="right"></xy-handle>
    </xy-base-node>`,
});
