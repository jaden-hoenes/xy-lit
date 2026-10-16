import type { ChildPart } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import { Position, nodeToolbar } from '@xy-lit/flow';
import type { NodeToolbarOptions } from '@xy-lit/flow';

/** Options of {@link nodeTooltip}. */
export type NodeTooltipOptions = Omit<NodeToolbarOptions, 'isVisible' | 'class'> & {
  /** Extra classes of the tooltip. */
  class?: string;
  /** Also show while the node (or something inside it) has keyboard focus. Default true. */
  showOnFocus?: boolean;
};

const side = (position: NodeTooltipOptions['position']): string =>
  (position ?? Position.Top).toString();

class NodeTooltipDirective extends AsyncDirective {
  #owner: HTMLElement | null = null;
  #hovered = false;
  #focused = false;
  #args: [NodeTooltipOptions, unknown] | null = null;

  render(options: NodeTooltipOptions, content: unknown): unknown {
    const { class: extra, showOnFocus, ...toolbar } = options;
    void showOnFocus;
    const visible = this.#hovered || (this.#focused && options.showOnFocus !== false);
    return nodeToolbar(
      {
        ...toolbar,
        isVisible: visible,
        class: `xy-ui-tooltip xy-ui-tooltip--${side(options.position)} ${extra ?? ''}`,
        style: `pointer-events:none;${options.style ?? ''}`,
      },
      content,
    );
  }

  override update(part: ChildPart, [options, content]: [NodeTooltipOptions, unknown]): unknown {
    this.#args = [options, content];
    const owner = (part.parentNode as Element | null)?.closest?.<HTMLElement>('xy-node') ?? null;
    if (owner !== this.#owner) {
      this.#detach();
      this.#owner = owner;
      this.#attach();
    }
    return this.render(options, content);
  }

  #refresh = (): void => {
    if (this.#args && this.isConnected) this.setValue(this.render(...this.#args));
  };
  #enter = (): void => {
    this.#hovered = true;
    this.#refresh();
  };
  #leave = (): void => {
    this.#hovered = false;
    this.#refresh();
  };
  #focusIn = (): void => {
    this.#focused = true;
    this.#refresh();
  };
  #focusOut = (): void => {
    this.#focused = false;
    this.#refresh();
  };

  #attach(): void {
    const o = this.#owner;
    if (!o) return;
    o.addEventListener('pointerenter', this.#enter);
    o.addEventListener('pointerleave', this.#leave);
    o.addEventListener('focusin', this.#focusIn);
    o.addEventListener('focusout', this.#focusOut);
  }

  #detach(): void {
    const o = this.#owner;
    if (!o) return;
    o.removeEventListener('pointerenter', this.#enter);
    o.removeEventListener('pointerleave', this.#leave);
    o.removeEventListener('focusin', this.#focusIn);
    o.removeEventListener('focusout', this.#focusOut);
    this.#hovered = false;
    this.#focused = false;
  }

  protected override disconnected(): void {
    this.#detach();
  }

  protected override reconnected(): void {
    this.#attach();
  }
}

/**
 * A tooltip next to a node, shown while the pointer is over the node (or the node has keyboard
 * focus). It is a {@link nodeToolbar} that keeps its size when the flow is zoomed, ignores the
 * pointer, and carries the classes `xy-ui-tooltip xy-ui-tooltip--<side>`.
 *
 * Use it inside a node renderer, like `nodeToolbar`. Needs the {@link uiStyles} sheet.
 *
 * @param options - Position (`top` default), `align`, `offset` and `class` like `nodeToolbar`.
 * @param content - The tooltip content.
 * @example
 * render: ({ data }) => html`${nodeTooltip({ position: 'top' }, html`Runs nightly at 02:00`)}
 *   <xy-base-node>${data.label}</xy-base-node>`
 */
export const nodeTooltip: (options: NodeTooltipOptions, content: unknown) => unknown =
  directive(NodeTooltipDirective);
