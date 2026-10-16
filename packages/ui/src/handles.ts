import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import type { Position } from '@xy-lit/flow';
import type { HandleType } from '@xy-lit/flow';

/** Options of {@link labeledHandle}. */
export type LabeledHandleOptions = {
  /** `source` or `target`. */
  type: HandleType;
  /** Side of the node the handle sits on. */
  position: Position | `${Position}`;
  /** Handle id (needed when a node has several handles of one type). */
  id?: string;
  /** Label text (always rendered as text). */
  label: string;
  /** Extra classes of the row. */
  class?: string;
};

/**
 * A handle with a text label. The label and the handle share a row that spans the node's content
 * width, so the handle sits on the node's border at the label's height. Left handles put the label
 * after the dot, right handles before it (right-aligned), top and bottom handles centre it.
 *
 * Use it directly inside a `<xy-base-node>` (the row bleeds through the body padding). Needs the
 * {@link uiStyles} sheet.
 *
 * @param o - See {@link LabeledHandleOptions}.
 * @example
 * html`${labeledHandle({ type: 'target', position: 'left', id: 'in', label: 'Input' })}
 *      ${labeledHandle({ type: 'source', position: 'right', id: 'out', label: 'Output' })}`
 */
export function labeledHandle(o: LabeledHandleOptions): TemplateResult {
  return html`<div class="xy-ui-labeled-handle ${o.position} ${o.class ?? ''}">
    <xy-handle
      type=${o.type}
      position=${o.position}
      handle-id=${o.id ?? nothing}
      class="xy-ui-handle"
    ></xy-handle>
    <span class="xy-ui-labeled-handle__label">${o.label}</span>
  </div>`;
}

/** Options of {@link buttonHandle}. */
export type ButtonHandleOptions = {
  /** `source` or `target`. */
  type: HandleType;
  /** Side of the node the handle sits on. */
  position: Position | `${Position}`;
  /** Handle id. */
  id?: string;
  /** Show the button (typically while the handle has no connection). */
  showButton: boolean;
  /** Called when the button is clicked. */
  onClick: (event: MouseEvent) => void;
  /** Button content. Default a plus sign. */
  content?: unknown;
  /** Accessible name of the button. Default "Add". */
  label?: string;
};

/**
 * A handle with a button beside it, on the outer side of the node, joined to the handle by a short
 * stem. The button has the classes `nodrag nopan`; pointer presses on it never start a connection.
 *
 * The button is a sibling of the handle, not a child: an `<xy-handle>` is interactive (it starts
 * connections), and nesting a button inside it would be a nested interactive control for
 * assistive technology. The sibling `.xy-ui-button-handle__anchor` has the handle's box and
 * position classes and carries the stem and the button.
 *
 * @param o - See {@link ButtonHandleOptions}.
 * @example
 * buttonHandle({ type: 'source', position: 'right', showButton: !hasOutgoing,
 *   onClick: () => addNextNode(id) })
 */
export function buttonHandle(o: ButtonHandleOptions): TemplateResult {
  const stop = (e: Event): void => e.stopPropagation();
  return html`<xy-handle
      type=${o.type}
      position=${o.position}
      handle-id=${o.id ?? nothing}
      class="xy-ui-handle xy-ui-button-handle"
    ></xy-handle
    >${
      o.showButton
        ? html`<span
            class="xy-ui-button-handle__anchor lit-flow__handle-${o.position}"
            ><span class="xy-ui-button-handle__stem" aria-hidden="true"></span
            ><button
              type="button"
              class="xy-ui-button-handle__button nodrag nopan"
              aria-label=${o.label ?? 'Add'}
              @pointerdown=${stop}
              @mousedown=${stop}
              @touchstart=${stop}
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                o.onClick(e);
              }}
            >
              ${o.content ?? '+'}
            </button></span
          >`
        : nothing
    }`;
}
