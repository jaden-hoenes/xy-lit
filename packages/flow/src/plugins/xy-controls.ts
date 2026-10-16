// Ported from xyflow (MIT) packages/react/src/additional-components/Controls/Controls.tsx, ControlButton.tsx, Icons/*@3d35b57
import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { shallow } from '@xy-lit/store';
import type { AriaLabelConfig, FitViewOptions, PanelPosition } from '@xy-lit/store';
import { StoreController } from '../controllers/store-controller.js';
import { booleanAttr } from '../elements/xy-flow/attributes.js';
import { FlowPluginElement, positionClasses } from './plugin-base.js';

const plusIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
</svg>`;
const minusIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 5">
  <path d="M0 0h32v4.2H0z" />
</svg>`;
const fitViewIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30">
  <path
    d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z"
  />
</svg>`;
const lockIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32">
  <path
    d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"
  />
</svg>`;
const unlockIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32">
  <path
    d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z"
  />
</svg>`;

type ControlsView = readonly [boolean, boolean, boolean, AriaLabelConfig];

/**
 * A panel with zoom in, zoom out, fit view and lock buttons (React `Controls`). Add your own
 * buttons as `<xy-control-button>` children.
 *
 * Locking toggles `nodesDraggable`, `nodesConnectable` and `elementsSelectable` together and
 * reflects the change back to the flow element's properties.
 *
 * @slot before - Buttons before the built-in ones.
 * @slot - Buttons after the built-in ones.
 * @slot after - Buttons after the default slot.
 * @csspart panel - The panel element.
 * @fires zoom-in - The zoom-in button was pressed.
 * @fires zoom-out - The zoom-out button was pressed.
 * @fires fit-view - The fit-view button was pressed.
 * @fires interactive-change - The lock button toggled; `detail.interactive` is the new state.
 * @tag xy-controls
 */
export class XyControlsElement extends FlowPluginElement {
  static override properties = {
    position: { reflect: true },
    orientation: { reflect: true },
    showZoom: { attribute: 'show-zoom', converter: booleanAttr(true) },
    showFitView: { attribute: 'show-fit-view', converter: booleanAttr(true) },
    showInteractive: { attribute: 'show-interactive', converter: booleanAttr(true) },
    fitViewOptions: { attribute: false },
  };

  /** Where the panel sits. Default `bottom-left`. */
  declare position: PanelPosition;
  /** `vertical` (default) or `horizontal`. */
  declare orientation: 'vertical' | 'horizontal';
  /** Show the zoom buttons. Default true. */
  declare showZoom: boolean;
  /** Show the fit-view button. Default true. */
  declare showFitView: boolean;
  /** Show the lock button. Default true. */
  declare showInteractive: boolean;
  /** Options of the fit-view button. */
  declare fitViewOptions: FitViewOptions | undefined;

  readonly #view = new StoreController<ControlsView>(
    this,
    (s) =>
      [
        s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
        s.transform[2] <= s.minZoom,
        s.transform[2] >= s.maxZoom,
        s.ariaLabelConfig,
      ] as const,
    shallow,
  );

  constructor() {
    super();
    this.position = 'bottom-left';
    this.orientation = 'vertical';
    this.showZoom = true;
    this.showFitView = true;
    this.showInteractive = true;
    this.fitViewOptions = undefined;
  }

  #emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  readonly #zoomIn = (): void => {
    void this.store?.instance.zoomIn();
    this.#emit('zoom-in');
  };

  readonly #zoomOut = (): void => {
    void this.store?.instance.zoomOut();
    this.#emit('zoom-out');
  };

  readonly #fitView = (): void => {
    void this.store?.instance.fitView(this.fitViewOptions);
    this.#emit('fit-view');
  };

  readonly #toggleInteractive = (): void => {
    const { store } = this;
    if (!store) return;
    const s = store.getState();
    const interactive = !(s.nodesDraggable || s.nodesConnectable || s.elementsSelectable);
    const next = {
      nodesDraggable: interactive,
      nodesConnectable: interactive,
      elementsSelectable: interactive,
    };
    // the flow element owns these options: keep its properties in step, and apply at once
    const flow = this.flowValue?.flow;
    if (flow) Object.assign(flow, next);
    store.setOptions(next);
    this.#emit('interactive-change', { interactive });
  };

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const [isInteractive, minZoomReached, maxZoomReached, labels] = this.#view.value;
    const horizontal = this.orientation === 'horizontal';
    return html`<div
      class="lit-flow__panel lit-flow__controls ${horizontal ? 'horizontal' : 'vertical'} ${positionClasses(this.position)}"
      part="panel"
      data-testid="rf__controls"
      role="group"
      aria-label=${this.ariaLabel ?? labels['controls.ariaLabel']}
    >
      <slot name="before"></slot>
      ${
        this.showZoom
          ? html`<button
                type="button"
                class="lit-flow__controls-button lit-flow__controls-zoomin"
                title=${labels['controls.zoomIn.ariaLabel']}
                aria-label=${labels['controls.zoomIn.ariaLabel']}
                ?disabled=${maxZoomReached}
                @click=${this.#zoomIn}
              >
                ${plusIcon}
              </button>
              <button
                type="button"
                class="lit-flow__controls-button lit-flow__controls-zoomout"
                title=${labels['controls.zoomOut.ariaLabel']}
                aria-label=${labels['controls.zoomOut.ariaLabel']}
                ?disabled=${minZoomReached}
                @click=${this.#zoomOut}
              >
                ${minusIcon}
              </button>`
          : nothing
      }
      ${
        this.showFitView
          ? html`<button
              type="button"
              class="lit-flow__controls-button lit-flow__controls-fitview"
              title=${labels['controls.fitView.ariaLabel']}
              aria-label=${labels['controls.fitView.ariaLabel']}
              @click=${this.#fitView}
            >
              ${fitViewIcon}
            </button>`
          : nothing
      }
      ${
        this.showInteractive
          ? html`<button
              type="button"
              class="lit-flow__controls-button lit-flow__controls-interactive"
              title=${labels['controls.interactive.ariaLabel']}
              aria-label=${labels['controls.interactive.ariaLabel']}
              @click=${this.#toggleInteractive}
            >
              ${isInteractive ? unlockIcon : lockIcon}
            </button>`
          : nothing
      }
      <slot></slot>
      <slot name="after"></slot>
    </div>`;
  }
}
