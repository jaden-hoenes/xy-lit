import { LitElement, css, html, nothing, svg } from 'lit';
import type { TemplateResult } from 'lit';
import { PerfectCursor } from 'perfect-cursors';
import { Position, getBezierPath } from '@xy-lit/store';
import type { FlowStore, XYPosition } from '@xy-lit/store';
import { getHandlePosition } from '@xy-lit/store/internal';
import type { XyFlowElement } from '@xy-lit/flow';
import type { PresenceChannel, PresenceState } from '../awareness.js';
import { PresenceController } from '../controllers/presence-controller.js';

const OPPOSITE: Record<string, Position> = {
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top,
};

/** Black or white, whichever reads better on `color` (hex colours; white otherwise). */
export function readableOn(color: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return '#fff';
  let hex = m[1]!;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#111' : '#fff';
}

/**
 * Remote cursors and in-progress remote connections of a flow with a `YjsFlowSource` that has
 * presence. Put it inside `<xy-flow>`; it sets `slot="viewport-front"` itself, so it lives in flow
 * coordinates, and draws every cursor scaled by `1 / zoom` so arrows keep their size.
 *
 * It also reports the local pointer: `pointermove`/`pointerleave` on the flow host call
 * `presence.setCursor(...)` in flow coordinates.
 *
 * @csspart cursor - One remote cursor.
 * @csspart name - The name tag of a cursor.
 * @tag xy-remote-cursors
 */
export class XyRemoteCursorsElement extends LitElement {
  static override properties = {
    hideNames: { attribute: 'hide-names', type: Boolean },
    version: { state: true },
  };

  /** Hide the name tags. */
  declare hideNames: boolean;
  /** @internal Re-render trigger. */
  declare version: number;

  static override styles = css`
    :host {
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      overflow: visible;
      pointer-events: none;
      display: block;
    }
    .cursor {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .cursor.placed {
      opacity: 1;
    }
    .arrow {
      display: block;
      width: 18px;
      height: 22px;
      filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35));
      overflow: visible;
    }
    .arrow path {
      fill: var(--c);
      stroke: #fff;
      stroke-width: 1.25;
      stroke-linejoin: round;
    }
    .name {
      position: absolute;
      left: 12px;
      top: 18px;
      max-width: 160px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--c);
      color: var(--on);
      font:
        500 11px/16px system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.55);
    }
    svg.connections {
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 1px;
      overflow: visible;
    }
    .connection {
      fill: none;
      stroke: var(--c);
      stroke-width: 2;
      stroke-dasharray: 6 5;
      stroke-linecap: round;
      animation: dash 0.8s linear infinite;
    }
    .connection-end {
      fill: var(--c);
      stroke: #fff;
      stroke-width: 1.5;
    }
    @keyframes dash {
      to {
        stroke-dashoffset: -11;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .connection {
        animation: none;
      }
    }
  `;

  readonly #presence = new PresenceController(this, {
    flowChanged: (flow) => this.#bindFlow(flow),
    presenceChanged: () => this.#sync(),
    remotesChanged: () => this.#sync(),
    storeChanged: (store) => this.#syncZoom(store),
  });
  readonly #perfect = new Map<number, PerfectCursor>();
  readonly #points = new Map<number, [number, number]>();
  readonly #els = new Map<number, HTMLElement>();
  readonly #placed = new Set<number>();
  #flow: XyFlowElement | null = null;
  #scale = 1;
  #signature = '';
  #remotes: [number, PresenceState][] = [];
  #connectionsVersion = '';
  #unbindFlow: (() => void) | null = null;

  constructor() {
    super();
    this.hideNames = false;
    this.version = 0;
  }

  override connectedCallback(): void {
    if (!this.hasAttribute('slot')) this.setAttribute('slot', 'viewport-front');
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unbindFlow?.();
    this.#unbindFlow = null;
    this.#flow = null;
    this.#disposeAll();
  }

  // local pointer -------------------------------------------------------------------------------

  #bindFlow(flow: XyFlowElement | null): void {
    if (flow === this.#flow) return;
    this.#unbindFlow?.();
    this.#unbindFlow = null;
    this.#flow = flow;
    if (!flow) return;
    const move = (event: Event): void => {
      const presence = this.#presence.presence;
      const store = this.#presence.store;
      if (!presence || !store?.getState().domNode) return;
      const e = event as PointerEvent;
      presence.setCursor(store.instance.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    };
    const leave = (): void => this.#presence.presence?.setCursor(null);
    flow.addEventListener('pointermove', move);
    flow.addEventListener('pointerleave', leave);
    this.#unbindFlow = () => {
      flow.removeEventListener('pointermove', move);
      flow.removeEventListener('pointerleave', leave);
    };
  }

  // remote cursors ------------------------------------------------------------------------------

  #syncZoom(store: FlowStore): void {
    const scale = 1 / (store.getState().transform[2] || 1);
    if (Math.abs(scale - this.#scale) < 1e-6) return;
    this.#scale = scale;
    for (const id of this.#els.keys()) this.#place(id);
  }

  #sync(): void {
    const presence: PresenceChannel | undefined = this.#presence.presence;
    if (!presence) {
      this.#disposeAll();
      this.#remotes = [];
      this.#bump('');
      return;
    }
    this.#remotes = [...presence.remotes()].sort((a, b) => a[0] - b[0]);
    const withCursor = this.#remotes.filter(([, s]) => s.cursor);
    for (const [id, state] of withCursor) {
      let perfect = this.#perfect.get(id);
      if (!perfect) {
        perfect = new PerfectCursor((point) => {
          this.#points.set(id, [point[0]!, point[1]!]);
          this.#place(id);
        });
        this.#perfect.set(id, perfect);
      }
      perfect.addPoint([state.cursor!.x, state.cursor!.y]);
    }
    const live = new Set(withCursor.map(([id]) => id));
    for (const id of [...this.#perfect.keys()]) {
      if (live.has(id)) continue;
      this.#perfect.get(id)?.dispose();
      this.#perfect.delete(id);
      this.#points.delete(id);
      this.#els.delete(id);
      this.#placed.delete(id);
    }
    const connections = this.#remotes
      .filter(([, s]) => s.connection)
      .map(([id, s]) => `${id}:${JSON.stringify(s.connection)}`)
      .join('|');
    const signature =
      withCursor.map(([id, s]) => `${id}:${s.user.name}:${s.user.color}`).join('|') +
      '#' +
      connections;
    if (signature !== this.#signature || connections !== this.#connectionsVersion) {
      this.#connectionsVersion = connections;
      this.#bump(signature);
    }
  }

  #bump(signature: string): void {
    this.#signature = signature;
    this.version++;
  }

  #place(id: number): void {
    let el = this.#els.get(id);
    if (!el) {
      el = this.renderRoot.querySelector<HTMLElement>(`[data-client="${id}"]`) ?? undefined;
      if (!el) return;
      this.#els.set(id, el);
    }
    const point = this.#points.get(id);
    if (!point) return;
    el.style.transform = `translate(${point[0]}px, ${point[1]}px) scale(${this.#scale})`;
    if (!this.#placed.has(id)) {
      this.#placed.add(id);
      el.classList.add('placed');
    }
  }

  #disposeAll(): void {
    for (const perfect of this.#perfect.values()) perfect.dispose();
    this.#perfect.clear();
    this.#points.clear();
    this.#els.clear();
    this.#placed.clear();
  }

  protected override updated(): void {
    // elements were (re)created: place them at their last known point
    this.#els.clear();
    for (const id of this.#perfect.keys()) this.#place(id);
  }

  // rendering -----------------------------------------------------------------------------------

  #connectionPath(
    store: FlowStore,
    state: PresenceState,
  ): { d: string; end: XYPosition } | undefined {
    const c = state.connection;
    if (!c) return undefined;
    const node = store.getState().nodeLookup.get(c.fromNode);
    if (!node) return undefined;
    const bounds = node.internals.handleBounds?.[c.fromType];
    const handle = bounds?.find((h) => (c.fromHandle === null ? true : h.id === c.fromHandle));
    const from = getHandlePosition(node, handle ?? null, Position.Right);
    const fromPosition = handle?.position ?? Position.Right;
    const [d] = getBezierPath({
      sourceX: from.x,
      sourceY: from.y,
      sourcePosition: fromPosition,
      targetX: c.to.x,
      targetY: c.to.y,
      targetPosition: OPPOSITE[fromPosition] ?? Position.Left,
    });
    return { d, end: c.to };
  }

  protected override render(): TemplateResult {
    const store = this.#presence.store;
    void this.version;
    const connections: TemplateResult[] = [];
    if (store) {
      for (const [id, state] of this.#remotes) {
        const path = this.#connectionPath(store, state);
        if (!path) continue;
        connections.push(
          svg`<g style="--c:${state.user.color}" data-connection=${id}>
            <path class="connection" d=${path.d}></path>
            <circle class="connection-end" cx=${path.end.x} cy=${path.end.y} r="4.5"></circle>
          </g>`,
        );
      }
    }
    return html`
      ${connections.length ? html`<svg class="connections" aria-hidden="true">${connections}</svg>` : nothing}
      ${this.#remotes
        .filter(([, s]) => s.cursor)
        .map(
          ([id, s]) =>
            html`<div
              class="cursor"
              part="cursor"
              data-client=${id}
              style="--c:${s.user.color};--on:${readableOn(s.user.color)}"
            >
              <svg class="arrow" viewBox="0 0 18 22" aria-hidden="true">
                <path
                  d="M1.5 1.2 L1.5 16.4 L5.6 12.6 L8.5 19.4 L11.3 18.2 L8.4 11.5 L14 11.5 Z"
                ></path>
              </svg>
              ${this.hideNames ? nothing : html`<span class="name" part="name">${s.user.name}</span>`}
            </div>`,
        )}
    `;
  }
}
