import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { FlowPluginElement } from './plugin-base.js';

/**
 * A button styled like the built-in controls. Place it inside `<xy-controls>` (it needs no flow of
 * its own, but renders nothing outside one, like every plugin).
 *
 * `aria-label` and `title` set on the element are forwarded to the inner `<button>`, which is
 * what assistive technology and the tooltip see. Icon-only buttons need an `aria-label`.
 *
 * Slotted SVG icons get the same sizing as the built-in icons.
 *
 * @slot - The button content (an icon or text).
 * @csspart button - The `<button>` element.
 * @tag xy-control-button
 */
export class XyControlButtonElement extends FlowPluginElement {
  static override pluginStyles = css`
    ::slotted(svg) {
      width: 100%;
      max-width: 12px;
      max-height: 12px;
      fill: currentColor;
    }
    .lit-flow__controls-button:disabled ::slotted(svg) {
      fill-opacity: 0.4;
    }
  `;

  static override properties = {
    disabled: { type: Boolean, reflect: true },
    ariaLabel: { attribute: 'aria-label' },
    title: {},
  };

  /** Disables the button. */
  declare disabled: boolean;
  /** The accessible name of the button, forwarded to the inner `<button>` (`aria-label`). */
  declare ariaLabel: string | null;
  /** The tooltip of the button, forwarded to the inner `<button>` (`title`). */
  declare title: string;

  constructor() {
    super();
    this.disabled = false;
    this.ariaLabel = null;
    this.title = '';
  }

  protected override render(): TemplateResult | string {
    if (!this.store) return '';
    return html`<button
      type="button"
      class="lit-flow__controls-button"
      part="button"
      ?disabled=${this.disabled}
      aria-label=${ifDefined(this.ariaLabel ?? undefined)}
      title=${ifDefined(this.title || undefined)}
    >
      <slot></slot>
    </button>`;
  }
}
