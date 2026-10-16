import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { FlowPluginElement, StoreController, positionClasses } from '@xy-lit/flow';
import type { Node, PanelPosition } from '@xy-lit/flow';
import { panelStyles } from './panel-styles.js';
import { tok } from './tokens.js';

/** `detail` of the `node-search-select` event. */
export type NodeSearchSelectDetail = {
  /** The node that was chosen. */
  node: Node;
};

/** Turns a node into the text that is searched and shown. */
export type NodeLabelGetter = (node: Node) => string;

const defaultLabel: NodeLabelGetter = (node) => {
  const label = (node.data as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' ? label : '';
};

const searchIcon = html`<svg viewBox="0 0 16 16" aria-hidden="true" class="xy-ui-search__icon">
  <circle cx="7" cy="7" r="4.5" />
  <path d="M10.5 10.5L14 14" />
</svg>`;

/** Split `text` around the first case-insensitive match of `query` (rendered as text, never as HTML). */
function highlight(text: string, query: string): TemplateResult | string {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return html`${text.slice(0, at)}<mark>${text.slice(at, at + query.length)}</mark>${text.slice(
    at + query.length,
  )}`;
}

let searchId = 0;

/**
 * A search box for the nodes of a flow. Typing filters the nodes by `data.label` (or by the
 * `getLabel` property); choosing a result (click, or arrow keys and Enter) selects the node and
 * centres the viewport on it. Escape clears the box.
 *
 * Implements the ARIA combobox pattern (`role="combobox"` input, `listbox` of `option`s,
 * `aria-activedescendant`).
 *
 * @csspart panel - The panel element.
 * @csspart input - The search input.
 * @csspart results - The results list.
 * @fires node-search-select - A result was chosen; `detail.node` is the node.
 * @tag xy-node-search
 */
export class XyNodeSearchElement extends FlowPluginElement {
  static override pluginStyles = css`
    ${panelStyles}
    .xy-ui-search {
      width: 260px;
      overflow: hidden;
    }
    .xy-ui-search__field {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      height: 36px;
    }
    .xy-ui-search__icon {
      flex: none;
      width: 14px;
      height: 14px;
      fill: none;
      stroke: ${tok('muted')};
      stroke-width: 1.6;
      stroke-linecap: round;
    }
    .xy-ui-input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      outline: none;
    }
    .xy-ui-input::placeholder {
      color: ${tok('muted')};
    }
    .xy-ui-search__field:focus-within {
      box-shadow: inset 0 0 0 2px ${tok('accent')};
      border-radius: ${tok('radius')};
    }
    .xy-ui-search__results {
      max-height: 232px;
      margin: 0;
      padding: 4px;
      overflow-y: auto;
      border-top: 1px solid ${tok('border')};
      list-style: none;
    }
    .xy-ui-search__option {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 8px;
      border-radius: calc(${tok('radius')} - 4px);
      cursor: pointer;
    }
    .xy-ui-search__option[aria-selected='true'],
    .xy-ui-search__option:hover {
      background: color-mix(in srgb, ${tok('accent')} 14%, transparent);
    }
    .xy-ui-search__option mark {
      background: color-mix(in srgb, ${tok('accent')} 30%, transparent);
      color: inherit;
      border-radius: 2px;
    }
    .xy-ui-search__meta {
      flex: none;
      font-size: 11px;
    }
    .xy-ui-search__empty {
      padding: 10px 12px;
      border-top: 1px solid ${tok('border')};
      color: ${tok('muted')};
    }
  `;

  static override properties = {
    position: { reflect: true },
    placeholder: {},
    maxResults: { attribute: 'max-results', type: Number },
    zoom: { type: Number },
    getLabel: { attribute: false },
    query: { state: true },
    active: { state: true },
    open: { state: true },
  };

  /** Where the panel sits. Default `top-left`. */
  declare position: PanelPosition;
  /** Placeholder of the input. Default "Search nodes". */
  declare placeholder: string;
  /** Most results shown. Default 8. */
  declare maxResults: number;
  /** Zoom to apply when centring on a result. Default: keep the current zoom. */
  declare zoom: number | undefined;
  /** Text of a node for searching and display. Default `node.data.label`. */
  declare getLabel: NodeLabelGetter;
  /** @internal The text typed into the search input. */
  declare query: string;
  /** @internal Index of the highlighted result. */
  declare active: number;
  /** @internal Whether the results list is open. */
  declare open: boolean;

  readonly #id = `xy-ui-search-${searchId++}`;
  readonly #nodes = new StoreController<Node[]>(this, (s) => s.nodes);

  constructor() {
    super();
    this.position = 'top-left';
    this.placeholder = 'Search nodes';
    this.maxResults = 8;
    this.zoom = undefined;
    this.getLabel = defaultLabel;
    this.query = '';
    this.active = 0;
    this.open = false;
  }

  /** The nodes that match the current query (empty for an empty query). */
  get results(): Node[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return [];
    const label = this.getLabel ?? defaultLabel;
    const out: Node[] = [];
    for (const node of this.#nodes.value ?? []) {
      if (node.hidden) continue;
      if (label(node).toLowerCase().includes(q) || node.id.toLowerCase().includes(q)) {
        out.push(node);
        if (out.length >= this.maxResults) break;
      }
    }
    return out;
  }

  /** Select a node and centre the viewport on it (what choosing a result does). */
  choose(node: Node): void {
    const store = this.store;
    if (!store) return;
    store.addSelectedNodes([node.id]);
    const internal = store.instance.getInternalNode(node.id);
    if (internal) {
      const { x, y } = internal.internals.positionAbsolute;
      const w = internal.measured.width ?? internal.width ?? 0;
      const h = internal.measured.height ?? internal.height ?? 0;
      void store.instance.setCenter(x + w / 2, y + h / 2, {
        zoom: this.zoom ?? store.instance.getZoom(),
        duration: 300,
      });
    }
    this.dispatchEvent(
      new CustomEvent<NodeSearchSelectDetail>('node-search-select', {
        detail: { node },
        bubbles: true,
        composed: true,
      }),
    );
    this.open = false;
  }

  #onKey(e: KeyboardEvent): void {
    const results = this.results;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.open = true;
        if (results.length) this.active = (this.active + 1) % results.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (results.length) this.active = (this.active - 1 + results.length) % results.length;
        break;
      case 'Enter': {
        const node = results[this.active];
        if (node) {
          e.preventDefault();
          this.choose(node);
        }
        break;
      }
      case 'Escape':
        this.query = '';
        this.open = false;
        break;
    }
  }

  protected override updated(): void {
    this.shadowRoot
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const results = this.results;
    const label = this.getLabel ?? defaultLabel;
    const showList = this.open && results.length > 0;
    const showEmpty = this.open && this.query.trim() !== '' && results.length === 0;
    const active = Math.min(this.active, Math.max(0, results.length - 1));
    return html`<div
      class="lit-flow__panel xy-ui-panel xy-ui-search ${positionClasses(this.position)}"
      part="panel"
    >
      <div class="xy-ui-search__field">
        ${searchIcon}
        <input
          class="xy-ui-input"
          part="input"
          type="text"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          placeholder=${this.placeholder}
          aria-label=${this.placeholder}
          aria-expanded=${showList ? 'true' : 'false'}
          aria-controls="${this.#id}-list"
          aria-autocomplete="list"
          aria-activedescendant=${showList ? `${this.#id}-${active}` : nothing}
          .value=${this.query}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value;
            this.active = 0;
            this.open = true;
          }}
          @focus=${() => (this.open = true)}
          @blur=${() => (this.open = false)}
          @keydown=${(e: KeyboardEvent) => this.#onKey(e)}
        />
      </div>
      <ul
        id="${this.#id}-list"
        class="xy-ui-search__results"
        part="results"
        role="listbox"
        aria-label="Nodes"
        ?hidden=${!showList}
      >
        ${repeat(
          results,
          (n) => n.id,
          (n, i) =>
            html`<li
              id="${this.#id}-${i}"
              class="xy-ui-search__option"
              role="option"
              aria-selected=${i === active ? 'true' : 'false'}
              @pointerdown=${(e: Event) => e.preventDefault()}
              @click=${() => this.choose(n)}
              @pointermove=${() => (this.active = i)}
            >
              <span>${highlight(label(n) || n.id, this.query.trim())}</span>
              <span class="xy-ui-search__meta xy-ui-muted xy-ui-mono">${n.type ?? 'default'}</span>
            </li>`,
        )}
      </ul>
      ${showEmpty ? html`<div class="xy-ui-search__empty" role="status">No nodes found</div>` : nothing}
    </div>`;
  }
}
