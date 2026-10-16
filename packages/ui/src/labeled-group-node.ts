import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { uiStyles } from './styles.js';

/** `data` of a {@link labeledGroupNode}. */
export type LabeledGroupData = {
  /** The tag text. */
  label?: string;
  /** Corner of the tag. Default `top-left`. */
  labelPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  [key: string]: unknown;
};

/**
 * A group node with a label tag. Give the node a `width` and `height` and put other nodes inside
 * with `parentId` (the group must come before its children in the nodes array). Resizable with
 * line handles (minimum 120x80).
 */
export const labeledGroupNode = defineNodeType<Node<LabeledGroupData, 'labeledGroup'>>({
  styles: uiStyles,
  resizer: { variant: 'lines', minWidth: 120, minHeight: 80 },
  render: ({ data, selected }): TemplateResult =>
    html`<div
      class="xy-ui-group ${selected ? 'selected' : ''}"
      data-label-position=${data.labelPosition ?? 'top-left'}
    >
      ${data.label ? html`<span class="xy-ui-group__label">${data.label}</span>` : ''}
    </div>`,
});
