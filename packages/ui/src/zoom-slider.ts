import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { FlowPluginElement, StoreController, positionClasses, shallow } from '@xy-lit/flow';
import type { PanelPosition } from '@xy-lit/flow';
import { panelStyles } from './panel-styles.js';
import { tok } from './tokens.js';

const minus = html`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" /></svg>`;
const plus = html`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6 2.5v7" /></svg>`;

type ZoomView = readonly [zoom: number, minZoom: number, maxZoom: number];

const percent = (zoom: number): string => `${Math.round(zoom * 100)}%`;

/**
 * A panel with zoom out, a range slider, zoom in and the zoom level (click it to reset to 100 %),
 * bound to the flow's viewport. The slider runs from the flow's `minZoom` to `maxZoom` in steps of
 * 0.01. Put it inside `<xy-flow>`.
 *
 * @csspart panel - The panel element.
 * @csspart slider - The range input.
 * @tag xy-zoom-slider
 */
export class XyZoomSliderElement extends FlowPluginElement {
  static override pluginStyles = css`
    ${panelStyles}
    .xy-ui-zoom {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
    }
    .xy-ui-zoom input[type='range'] {
      width: 120px;
      margin: 0 6px;
      accent-color: ${tok('accent')};
      cursor: pointer;
    }
    .xy-ui-zoom__value {
      min-width: 48px;
      font-variant-numeric: tabular-nums;
      color: ${tok('muted')};
    }
  `;

  static override properties = {
    position: { reflect: true },
  };

  /** Where the panel sits. Default `bottom-center`. */
  declare position: PanelPosition;

  readonly #view = new StoreController<ZoomView>(
    this,
    (s) => [s.transform[2], s.minZoom, s.maxZoom] as const,
    shallow,
  );

  constructor() {
    super();
    this.position = 'bottom-center';
  }

  #setZoom(zoom: number): void {
    void this.store?.instance.zoomTo(zoom, { duration: 0 });
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const [zoom, minZoom, maxZoom] = this.#view.value;
    return html`<div
      class="lit-flow__panel xy-ui-panel xy-ui-zoom ${positionClasses(this.position)}"
      part="panel"
      role="group"
      aria-label="Zoom"
    >
      <button
        type="button"
        class="xy-ui-btn"
        aria-label="Zoom out"
        ?disabled=${zoom <= minZoom}
        @click=${() => void this.store?.instance.zoomOut({ duration: 120 })}
      >
        ${minus}
      </button>
      <input
        type="range"
        part="slider"
        aria-label="Zoom level"
        aria-valuetext=${percent(zoom)}
        min=${minZoom}
        max=${maxZoom}
        step="0.01"
        .value=${String(Math.min(maxZoom, Math.max(minZoom, zoom)))}
        @input=${(e: Event) => this.#setZoom(Number((e.target as HTMLInputElement).value))}
      />
      <button
        type="button"
        class="xy-ui-btn"
        aria-label="Zoom in"
        ?disabled=${zoom >= maxZoom}
        @click=${() => void this.store?.instance.zoomIn({ duration: 120 })}
      >
        ${plus}
      </button>
      <button
        type="button"
        class="xy-ui-btn xy-ui-zoom__value"
        title="Reset zoom to 100%"
        @click=${() => this.#setZoom(1)}
      >
        ${percent(zoom)}
      </button>
    </div>`;
  }
}

const PRESETS = [0.5, 1, 1.5, 2] as const;

/**
 * A panel with a `<select>` of zoom levels (50 %, 100 %, 150 %, 200 %) and "Fit view". It shows
 * the current zoom (an extra option appears while the zoom matches none of the presets).
 *
 * @csspart panel - The panel element.
 * @csspart select - The `<select>`.
 * @tag xy-zoom-select
 */
export class XyZoomSelectElement extends FlowPluginElement {
  static override pluginStyles = css`
    ${panelStyles}
    .xy-ui-zoom-select {
      padding: 3px;
    }
    .xy-ui-select {
      appearance: none;
      height: 28px;
      min-width: 112px;
      padding: 0 28px 0 10px;
      border: 0;
      border-radius: calc(${tok('radius')} - 3px);
      background: ${tok('subtle')}
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E")
        no-repeat right 10px center;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .xy-ui-select option {
      background: ${tok('surface')};
      color: ${tok('text')};
    }
  `;

  static override properties = {
    position: { reflect: true },
  };

  /** Where the panel sits. Default `top-center`. */
  declare position: PanelPosition;

  readonly #view = new StoreController<number>(this, (s) => s.transform[2]);

  constructor() {
    super();
    this.position = 'top-center';
  }

  #onChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const instance = this.store?.instance;
    if (!instance) return;
    let done: Promise<unknown> = Promise.resolve();
    if (select.value === 'fit') done = instance.fitView({ duration: 200 });
    else if (select.value !== 'current')
      done = instance.zoomTo(Number(select.value), { duration: 200 });
    // show the live zoom again once the transition ended (also when nothing changed, e.g. "fit" twice)
    void done.then(() => this.requestUpdate());
  }

  protected override updated(): void {
    // `selected` attributes do not follow the live value once the user picked an option
    const select = this.shadowRoot?.querySelector('select');
    if (select) select.value = this.#current();
  }

  #current(): string {
    const zoom = this.#view.value;
    const preset = PRESETS.find((p) => Math.abs(p - zoom) < 0.005);
    return preset === undefined ? 'current' : String(preset);
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const zoom = this.#view.value;
    const onPreset = this.#current() !== 'current';
    return html`<div
      class="lit-flow__panel xy-ui-panel xy-ui-zoom-select ${positionClasses(this.position)}"
      part="panel"
    >
      <select
        class="xy-ui-select"
        part="select"
        aria-label="Zoom level"
        @change=${(e: Event) => this.#onChange(e)}
      >
        ${onPreset ? nothing : html`<option value="current">${percent(zoom)}</option>`}
        ${PRESETS.map((p) => html`<option value=${p}>${percent(p)}</option>`)}
        <option value="fit">Fit view</option>
      </select>
    </div>`;
  }
}
