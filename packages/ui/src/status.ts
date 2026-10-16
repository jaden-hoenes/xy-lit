import { html } from 'lit';
import type { TemplateResult } from 'lit';

/** The state a {@link statusIndicator} shows. */
export type NodeStatus = 'loading' | 'success' | 'error' | 'initial';

/**
 * Wraps node content in a status border: a rotating ring while `loading`, a solid green ring on
 * `success`, a red one on `error`, nothing for `initial`. The ring is drawn outside the content's
 * box and never takes pointer events, so it does not change the node's size.
 *
 * The animation stops under `prefers-reduced-motion` (the ring stays, static). Needs the
 * {@link uiStyles} sheet in the flow (add it to your node type's `styles`).
 *
 * @param status - The status to show.
 * @param content - The wrapped content, usually a `<xy-base-node>`.
 * @example
 * render: ({ data, selected }) => statusIndicator(data.status, html`
 *   <xy-base-node ?selected=${selected}>${data.label}</xy-base-node>`)
 */
export function statusIndicator(status: NodeStatus, content: unknown): TemplateResult {
  return html`<div
    class="xy-ui-status"
    data-status=${status}
    aria-busy=${status === 'loading' ? 'true' : 'false'}
  >
    <span class="xy-ui-status__ring" aria-hidden="true"></span>
    <div class="xy-ui-status__body">${content}</div>
  </div>`;
}
