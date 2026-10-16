import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { Position, defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { uiStyles } from './styles.js';

/** `data` of a {@link placeholderNode}. */
export type PlaceholderNodeData = {
  /** Text under the plus sign. Default "Add node". */
  label?: string;
  [key: string]: unknown;
};

/** `detail` of the `placeholder-click` event. */
export type PlaceholderClickDetail = {
  /** Id of the placeholder node. */
  id: string;
  /** The placeholder node's data. */
  data: PlaceholderNodeData;
};

/**
 * A dashed box with a plus sign: the slot where the next node goes. Clicking it dispatches a
 * bubbling, composed `placeholder-click` event (`detail: { id, data }`) that you can listen for on
 * the `<xy-flow>` element, typically to replace the placeholder with a real node. It has a target
 * handle (on the side given by `targetPosition`, default top) so it can be the end of an edge.
 */
export const placeholderNode = defineNodeType<Node<PlaceholderNodeData, 'placeholder'>>({
  styles: uiStyles,
  render: ({ id, data, selected, targetPosition = Position.Top }): TemplateResult =>
    html`<div class="xy-ui-placeholder ${selected ? 'selected' : ''}">
      <xy-handle type="target" position=${targetPosition} class="xy-ui-handle"></xy-handle>
      <button
        type="button"
        class="xy-ui-placeholder__button nodrag"
        aria-label=${data.label ?? 'Add node'}
        @click=${(e: MouseEvent) =>
          (e.currentTarget as HTMLElement).dispatchEvent(
            new CustomEvent<PlaceholderClickDetail>('placeholder-click', {
              detail: { id, data },
              bubbles: true,
              composed: true,
            }),
          )}
      >
        <span class="xy-ui-placeholder__plus" aria-hidden="true">+</span>
        <span class="xy-ui-placeholder__label">${data.label ?? 'Add node'}</span>
      </button>
    </div>`,
});
