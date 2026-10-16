import { css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { FlowPluginElement, StoreController, positionClasses, shallow } from '@xy-lit/flow';
import type {
  ChangeMeta,
  EdgeChange,
  FlowEventMap,
  InternalNode,
  NodeChange,
  PanelPosition,
  Viewport,
} from '@xy-lit/flow';
import { panelStyles } from './panel-styles.js';
import { tok } from './tokens.js';

/** One line of the change logger. */
export type ChangeLogEntry = {
  /** Running number. */
  seq: number;
  /** Wall-clock time of the event. */
  time: Date;
  /** Which event. */
  kind: 'nodes' | 'edges';
  /** Gesture phase and origin of the change batch. */
  meta: Pick<ChangeMeta, 'phase' | 'origin'>;
  /** The changes, shortened to `type id`. */
  changes: string[];
};

/** How many entries the change logger keeps. */
export const CHANGE_LOG_LIMIT = 50;

const describe = (c: NodeChange | EdgeChange): string => {
  const id = 'id' in c ? c.id : 'item' in c ? (c.item as { id: string }).id : '';
  if (c.type === 'position' && c.position) {
    return `position ${id} (${Math.round(c.position.x)}, ${Math.round(c.position.y)})`;
  }
  if (c.type === 'dimensions' && c.dimensions) {
    return `dimensions ${id} ${Math.round(c.dimensions.width)}x${Math.round(c.dimensions.height)}`;
  }
  if (c.type === 'select') return `${c.selected ? 'select' : 'deselect'} ${id}`;
  return `${c.type} ${id}`;
};

const toggleRow = (
  label: string,
  on: boolean,
  toggle: () => void,
  extra?: TemplateResult | typeof nothing,
): TemplateResult =>
  html`<div class="xy-ui-dev__row">
      <button
        type="button"
        class="xy-ui-dev__toggle"
        role="switch"
        aria-checked=${on ? 'true' : 'false'}
        @click=${toggle}
      >
        <span class="xy-ui-dev__switch" aria-hidden="true"></span>
        <span>${label}</span>
      </button>
    </div>
    ${on ? extra : nothing}`;

/**
 * A debugging panel with three switches:
 *
 * - **Viewport logger** shows the live `x`, `y` and `zoom`.
 * - **Node inspector** puts an info box (id, type, position, size, data) below every visible node,
 *   in the viewport so it follows the node (through an `<xy-devtools-inspector>` child with
 *   `slot="viewport-front"` that this element adds to the flow and removes again).
 * - **Change logger** lists the last 50 `nodes-change` and `edges-change` events with phase,
 *   origin and the changes. Listening does not make the flow controlled.
 *
 * The switches start from the `viewport-logger`, `node-inspector` and `change-logger` attributes.
 *
 * @csspart panel - The panel element.
 * @tag xy-devtools
 */
export class XyDevtoolsElement extends FlowPluginElement {
  static override pluginStyles = css`
    ${panelStyles}
    .xy-ui-dev {
      width: 264px;
      padding: 6px;
    }
    .xy-ui-dev__title {
      padding: 4px 8px 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${tok('muted')};
    }
    .xy-ui-dev__toggle {
      appearance: none;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 6px 8px;
      border: 0;
      border-radius: calc(${tok('radius')} - 4px);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .xy-ui-dev__toggle:hover {
      background: ${tok('subtle')};
    }
    .xy-ui-dev__toggle:focus-visible {
      outline: 2px solid ${tok('accent')};
      outline-offset: 1px;
    }
    .xy-ui-dev__switch {
      position: relative;
      flex: none;
      width: 28px;
      height: 16px;
      border-radius: 8px;
      background: ${tok('borderStrong')};
      transition: background 140ms ease;
    }
    .xy-ui-dev__switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      transition: translate 140ms ease;
    }
    [aria-checked='true'] > .xy-ui-dev__switch {
      background: ${tok('accent')};
    }
    [aria-checked='true'] > .xy-ui-dev__switch::after {
      translate: 12px 0;
    }
    .xy-ui-dev__readout {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin: 2px 8px 6px;
      font-size: 11px;
    }
    .xy-ui-dev__readout span {
      padding: 4px 6px;
      border-radius: 6px;
      background: ${tok('subtle')};
    }
    .xy-ui-dev__readout b {
      color: ${tok('muted')};
      font-weight: 500;
    }
    .xy-ui-dev__log {
      max-height: 180px;
      margin: 2px 4px 4px;
      padding: 0;
      overflow-y: auto;
      list-style: none;
      font-size: 10.5px;
      line-height: 1.5;
    }
    .xy-ui-dev__log li {
      padding: 3px 4px;
      border-bottom: 1px solid ${tok('border')};
      word-break: break-word;
    }
    .xy-ui-dev__log li:last-child {
      border-bottom: 0;
    }
    .xy-ui-dev__tag {
      display: inline-block;
      margin-right: 6px;
      padding: 0 5px;
      border-radius: 4px;
      background: color-mix(in srgb, ${tok('accent')} 16%, transparent);
      font-weight: 600;
    }
    .xy-ui-dev__tag[data-kind='edges'] {
      background: color-mix(in srgb, ${tok('success')} 20%, transparent);
    }
    .xy-ui-dev__empty {
      margin: 2px 8px 8px;
      color: ${tok('muted')};
      font-size: 11px;
    }
    @media (prefers-reduced-motion: reduce) {
      .xy-ui-dev__switch,
      .xy-ui-dev__switch::after {
        transition: none;
      }
    }
  `;

  static override properties = {
    position: { reflect: true },
    viewportLogger: { attribute: 'viewport-logger', type: Boolean },
    nodeInspector: { attribute: 'node-inspector', type: Boolean },
    changeLogger: { attribute: 'change-logger', type: Boolean },
    entries: { state: true },
  };

  /** Where the panel sits. Default `bottom-right`. */
  declare position: PanelPosition;
  /** Show the viewport readout. */
  declare viewportLogger: boolean;
  /** Show the node inspector boxes. */
  declare nodeInspector: boolean;
  /** Record and list the change events. */
  declare changeLogger: boolean;
  /** The recorded changes, newest first. */
  declare entries: ChangeLogEntry[];

  readonly #viewport = new StoreController<readonly [number, number, number]>(
    this,
    (s) => s.transform,
    shallow,
  );
  #seq = 0;
  #listening: XyFlowLike | null = null;
  #inspector: HTMLElement | null = null;

  constructor() {
    super();
    this.position = 'bottom-right';
    this.viewportLogger = false;
    this.nodeInspector = false;
    this.changeLogger = false;
    this.entries = [];
  }

  /** The most recent viewport, as the logger shows it. */
  get viewport(): Viewport {
    const [x, y, zoom] = this.#viewport.value ?? [0, 0, 1];
    return { x, y, zoom };
  }

  /** Forget the recorded changes. */
  clearLog(): void {
    this.entries = [];
  }

  readonly #onNodes = (e: Event): void => {
    const { changes, meta } = (e as CustomEvent<FlowEventMap['nodes-change']>).detail;
    this.#record('nodes', changes, meta);
  };
  readonly #onEdges = (e: Event): void => {
    const { changes, meta } = (e as CustomEvent<FlowEventMap['edges-change']>).detail;
    this.#record('edges', changes, meta);
  };

  #record(kind: 'nodes' | 'edges', changes: (NodeChange | EdgeChange)[], meta: ChangeMeta): void {
    if (!this.changeLogger || changes.length === 0) return;
    const entry: ChangeLogEntry = {
      seq: this.#seq++,
      time: new Date(),
      kind,
      meta: { phase: meta.phase, origin: meta.origin },
      changes: changes.slice(0, 6).map(describe),
    };
    if (changes.length > 6) entry.changes.push(`+${changes.length - 6} more`);
    this.entries = [entry, ...this.entries].slice(0, CHANGE_LOG_LIMIT);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#sync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unlisten();
    this.#removeInspector();
  }

  protected override willUpdate(): void {
    this.#sync();
  }

  /** Keep the flow listeners and the inspector child in step with the switches and the flow. */
  #sync(): void {
    const flow = this.flowValue?.flow as XyFlowLike | null | undefined;
    if (flow && this.changeLogger && this.#listening !== flow) {
      this.#unlisten();
      flow.addEventListener('nodes-change', this.#onNodes);
      flow.addEventListener('edges-change', this.#onEdges);
      this.#listening = flow;
    } else if (!this.changeLogger || !flow) {
      this.#unlisten();
    }
    if (flow && this.nodeInspector && this.isConnected) {
      if (!this.#inspector?.isConnected) {
        const el = document.createElement('xy-devtools-inspector');
        el.setAttribute('slot', 'viewport-front');
        flow.append(el);
        this.#inspector = el;
      }
    } else {
      this.#removeInspector();
    }
  }

  #unlisten(): void {
    this.#listening?.removeEventListener('nodes-change', this.#onNodes);
    this.#listening?.removeEventListener('edges-change', this.#onEdges);
    this.#listening = null;
  }

  #removeInspector(): void {
    this.#inspector?.remove();
    this.#inspector = null;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.store) return nothing;
    const { x, y, zoom } = this.viewport;
    const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();
    return html`<div
      class="lit-flow__panel xy-ui-panel xy-ui-dev ${positionClasses(this.position)}"
      part="panel"
      role="group"
      aria-label="Devtools"
    >
      <div class="xy-ui-dev__title">Devtools</div>
      ${toggleRow(
        'Viewport logger',
        this.viewportLogger,
        () => (this.viewportLogger = !this.viewportLogger),
        html`<div class="xy-ui-dev__readout xy-ui-mono" data-testid="viewport-readout">
          <span><b>x</b> ${fmt(x)}</span><span><b>y</b> ${fmt(y)}</span
          ><span><b>zoom</b> ${fmt(zoom)}</span>
        </div>`,
      )}
      ${toggleRow('Node inspector', this.nodeInspector, () => (this.nodeInspector = !this.nodeInspector))}
      ${toggleRow(
        'Change logger',
        this.changeLogger,
        () => (this.changeLogger = !this.changeLogger),
        this.entries.length === 0
          ? html`<div class="xy-ui-dev__empty">Waiting for changes. Drag a node.</div>`
          : html`<ol class="xy-ui-dev__log xy-ui-mono" aria-label="Recent changes">
              ${repeat(
                this.entries,
                (entry) => entry.seq,
                (entry) =>
                  html`<li>
                    <span class="xy-ui-dev__tag" data-kind=${entry.kind}>${entry.kind}</span
                    ><span class="xy-ui-muted">${entry.meta.origin}/${entry.meta.phase}</span>
                    ${entry.changes.join(', ')}
                  </li>`,
              )}
            </ol>`,
      )}
    </div>`;
  }
}

/** The slice of the flow element the devtools use. */
type XyFlowLike = HTMLElement;

/**
 * The info boxes of the devtools node inspector. Added to the flow by `<xy-devtools>` (with
 * `slot="viewport-front"`); you do not need to create it yourself, but you can use it on its own.
 *
 * @csspart box - One info box.
 * @tag xy-devtools-inspector
 */
export class XyDevtoolsInspectorElement extends FlowPluginElement {
  static override pluginStyles = css`
    .xy-ui-inspector__box {
      position: absolute;
      top: 0;
      left: 0;
      box-sizing: border-box;
      max-width: 260px;
      padding: 4px 7px;
      border: 1px solid ${tok('border')};
      border-radius: 6px;
      background: ${tok('surface')};
      color: ${tok('text')};
      box-shadow: ${tok('shadow')};
      font:
        10px/1.45 ${tok('mono')},
        monospace;
      white-space: nowrap;
      pointer-events: none;
      transform-origin: 0 0;
    }
    .xy-ui-inspector__box b {
      font-weight: 600;
    }
    .xy-ui-inspector__muted {
      color: ${tok('muted')};
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .xy-ui-inspector__box[data-selected] {
      border-color: ${tok('accent')};
    }
  `;

  readonly #nodes = new StoreController<readonly [unknown, number]>(
    this,
    (s) => [s.nodes, s.lookupVersion] as const,
    shallow,
  );

  protected override render(): TemplateResult | typeof nothing {
    const store = this.store;
    if (!store) return nothing;
    void this.#nodes.value;
    const nodes: InternalNode[] = store.getVisibleNodes();
    return html`${repeat(
      nodes,
      (n) => n.id,
      (n) => {
        const { x, y } = n.internals.positionAbsolute;
        const w = Math.round(n.measured.width ?? n.width ?? 0);
        const h = Math.round(n.measured.height ?? n.height ?? 0);
        const data = ((): string => {
          try {
            return JSON.stringify(n.data) ?? '';
          } catch {
            return '[unserialisable]';
          }
        })();
        return html`<div
          class="xy-ui-inspector__box"
          part="box"
          data-node-id=${n.id}
          ?data-selected=${n.selected}
          style="translate:${x}px ${y + h + 8}px;scale:calc(1 / var(--xy-zoom, 1))"
        >
          <div><b>${n.id}</b> · ${n.type ?? 'default'}${n.selected ? ' · selected' : ''}</div>
          <div>x ${Math.round(x * 10) / 10} y ${Math.round(y * 10) / 10} ${w}×${h}</div>
          <div class="xy-ui-inspector__muted">
            ${data.length > 44 ? `${data.slice(0, 43)}…` : data}
          </div>
        </div>`;
      },
    )}`;
  }
}
