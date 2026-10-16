import { html } from 'lit';
import type { TemplateResult } from 'lit';

/** Side of the node an appendix sits on. */
export type AppendixPosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * Content attached to the outside of a node on one side (a caption, a status line, a timestamp).
 * It is absolutely positioned against the node box, so it does not change the node's measured
 * size and moves with the node. Pointer events work on it as on the node itself.
 *
 * Put it inside the node's markup (as a direct child of the node content or slotted into a
 * `<xy-base-node>`). Needs the {@link uiStyles} sheet.
 *
 * @param position - The side of the node.
 * @param content - Anything Lit can render.
 * @example
 * html`<xy-base-node>...</xy-base-node>${nodeAppendix('bottom', html`Last run 3 min ago`)}`
 */
export function nodeAppendix(position: AppendixPosition, content: unknown): TemplateResult {
  return html`<div class="xy-ui-appendix xy-ui-appendix--${position}">${content}</div>`;
}
