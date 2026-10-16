// Ported from xyflow (MIT) packages/react/src/components/Panel/index.tsx@3d35b57
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { PanelPosition } from '@xy-lit/store';
import { FlowPluginElement, positionClasses } from './plugin-base.js';

/**
 * Positions content above the viewport (React `Panel`). Put it inside `<xy-flow>`.
 *
 * @slot - The panel content.
 * @csspart panel - The positioned panel element.
 * @tag xy-panel
 */
export class XyPanelElement extends FlowPluginElement {
  static override properties = {
    position: { reflect: true },
  };

  /** Where the panel sits: `top-left`, `top-center`, `top-right`, `bottom-…`, `center-left`, `center-right`. */
  declare position: PanelPosition;

  constructor() {
    super();
    this.position = 'top-right';
  }

  protected override render(): TemplateResult | string {
    if (!this.store) return '';
    return html`<div class="lit-flow__panel ${positionClasses(this.position)}" part="panel">
      <slot></slot>
    </div>`;
  }
}
