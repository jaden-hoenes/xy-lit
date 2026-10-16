// Ported from xyflow (MIT) packages/react/src/components/ViewportPortal/index.tsx@3d35b57
import { devWarn } from '@xy-lit/store';

/**
 * Renders its children inside the transformed viewport of the flow, in flow coordinates (React
 * `ViewportPortal`): they pan and zoom with the nodes. Must be a direct child of `<xy-flow>`.
 *
 * Sets its own `slot` attribute to `viewport-front` (default) or `viewport-back`, so `<xy-flow>`
 * projects it into the matching viewport layer. The viewport layers do not receive pointer
 * events: give interactive children `pointer-events: all`.
 *
 * @slot - The content to place in the viewport.
 * @tag xy-viewport-portal
 */
export class XyViewportPortalElement extends HTMLElement {
  static observedAttributes = ['target'];

  /** `front` (default, above the nodes) or `back` (behind edges and nodes). */
  get target(): 'front' | 'back' {
    return this.getAttribute('target') === 'back' ? 'back' : 'front';
  }
  set target(value: 'front' | 'back') {
    this.setAttribute('target', value);
  }

  /** Sets `slot` from `target`; warns (`XYL07`) unless the portal is a direct child of `<xy-flow>`. */
  connectedCallback(): void {
    this.style.display = 'contents';
    this.#applySlot();
    if (this.parentElement?.localName !== 'xy-flow') {
      devWarn('XYL07', '<xy-viewport-portal> only works as a direct child of <xy-flow>.');
    }
  }

  /** Re-applies the slot when `target` changes. */
  attributeChangedCallback(): void {
    if (this.isConnected) this.#applySlot();
  }

  #applySlot(): void {
    const slot = this.target === 'back' ? 'viewport-back' : 'viewport-front';
    if (this.getAttribute('slot') !== slot) this.setAttribute('slot', slot);
  }
}
