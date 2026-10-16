import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { tok } from './tokens.js';

/**
 * A card for node content: an optional header, the body and an optional footer, styled with the
 * flow's `--xy-node-*` tokens (so it follows `color-mode`).
 *
 * Handles, toolbars and appendices must be **slotted children** (light DOM): the engine finds
 * handles with `querySelectorAll`, which does not enter shadow roots. The template of this element
 * contains no `<xy-handle>`. The card itself is the element's box, so a handle at `position="left"`
 * sits on the card's border.
 *
 * The renderer of a node type sets the `selected` attribute from `props.selected`.
 *
 * Custom properties: `--xy-base-node-padding` (body, default `12px 14px`),
 * `--xy-base-node-min-width`, plus the `--xy-ui-*` tokens (`--xy-ui-radius`, `--xy-ui-accent`, ...).
 *
 * @slot header - Header content (rendered only when something is slotted).
 * @slot - The body.
 * @slot footer - Footer content (rendered only when something is slotted).
 * @csspart header - The header wrapper.
 * @csspart content - The body wrapper.
 * @csspart footer - The footer wrapper.
 * @tag xy-base-node
 */
export class XyBaseNodeElement extends LitElement {
  static override styles = css`
    :host {
      --xy-base-node-px: 14px;
      --xy-base-node-bw: 1px;
      display: block;
      box-sizing: border-box;
      min-width: var(--xy-base-node-min-width, 0);
      border: var(--xy-base-node-bw) solid ${tok('border')};
      border-radius: ${tok('radius')};
      background: ${tok('surface')};
      color: ${tok('text')};
      box-shadow: ${tok('shadow')};
      font-size: 13px;
      line-height: 1.45;
      text-align: left;
      transition:
        box-shadow 140ms ease,
        border-color 140ms ease;
    }
    :host(:hover) {
      border-color: ${tok('borderStrong')};
    }
    :host([selected]) {
      border-color: ${tok('accent')};
      box-shadow:
        0 0 0 3px color-mix(in srgb, ${tok('accent')} 28%, transparent),
        ${tok('shadow')};
    }
    :host([hidden]) {
      display: none;
    }
    .header,
    .footer {
      padding: 8px var(--xy-base-node-px);
      background: ${tok('subtle')};
      font-weight: 600;
    }
    .header {
      border-bottom: 1px solid ${tok('border')};
      border-radius: calc(${tok('radius')} - var(--xy-base-node-bw))
        calc(${tok('radius')} - var(--xy-base-node-bw)) 0 0;
    }
    .footer {
      border-top: 1px solid ${tok('border')};
      border-radius: 0 0 calc(${tok('radius')} - var(--xy-base-node-bw))
        calc(${tok('radius')} - var(--xy-base-node-bw));
      font-weight: 500;
      color: ${tok('muted')};
    }
    .content {
      padding: var(--xy-base-node-padding, 12px var(--xy-base-node-px));
    }
    [hidden] {
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        transition: none;
      }
    }
  `;

  static override properties = {
    selected: { type: Boolean, reflect: true },
    hasHeader: { state: true },
    hasFooter: { state: true },
  };

  /** Whether the node is selected (draws the accent ring). */
  declare selected: boolean;
  /** @internal Whether anything is slotted into `header`. */
  declare hasHeader: boolean;
  /** @internal Whether anything is slotted into `footer`. */
  declare hasFooter: boolean;

  constructor() {
    super();
    this.selected = false;
    this.hasHeader = false;
    this.hasFooter = false;
  }

  #slotted(event: Event): boolean {
    return (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  }

  protected override render(): TemplateResult {
    return html`<div class="header" part="header" ?hidden=${!this.hasHeader}>
        <slot name="header" @slotchange=${(e: Event) => (this.hasHeader = this.#slotted(e))}></slot>
      </div>
      <div class="content" part="content"><slot></slot></div>
      <div class="footer" part="footer" ?hidden=${!this.hasFooter}>
        <slot name="footer" @slotchange=${(e: Event) => (this.hasFooter = this.#slotted(e))}></slot>
      </div>`;
  }
}
