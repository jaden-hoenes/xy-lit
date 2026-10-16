import { LitElement, css, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import type { XyFlowElement } from '@xy-lit/flow';
import type { PresenceChannel, PresenceState } from '../awareness.js';
import { PresenceController } from '../controllers/presence-controller.js';
import { readableOn } from './xy-remote-cursors.js';

/** Detail of the `follow-change` event. */
export type FollowChangeDetail = { clientId: number | null };

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]!][0] ?? '?';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]!][0] ?? '') : '';
  return (first + last).toUpperCase();
};

/** Safe `src` for an avatar image: only http(s), data:image and blob: URLs. */
const safeImage = (src: string | undefined): string | undefined =>
  src && /^(https?:|data:image\/|blob:)/i.test(src) ? src : undefined;

/**
 * Who is here: a row of avatars (picture or initials, ringed in the user's colour) for the
 * remote users of a flow whose source has presence.
 *
 * - Click an avatar: follow that user's viewport until you pan yourself (click again to stop).
 * - Double-click: centre on that user's cursor.
 *
 * It is an absolutely positioned overlay of the flow (`position` attribute picks the corner);
 * put it inside `<xy-flow>`. With `<xy-panel>` available it can sit inside one instead.
 *
 * @fires follow-change - Following started or stopped (`detail.clientId`, `null` when stopped).
 * @csspart avatar - One avatar button.
 * @tag xy-presence-avatars
 */
export class XyPresenceAvatarsElement extends LitElement {
  static override properties = {
    position: { reflect: true },
    max: { type: Number },
    includeSelf: { attribute: 'include-self', type: Boolean },
    version: { state: true },
    following: { state: true },
  };

  /** Corner: `top-right` (default), `top-left`, `bottom-right`, `bottom-left`. */
  declare position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Most avatars shown before "+N". Default 5. */
  declare max: number;
  /**
   * Also show the local user's avatar (marked "you"). The "N online" label counts everyone in the
   * room, including the local user, whether or not this is set.
   */
  declare includeSelf: boolean;
  /** @internal */
  declare version: number;
  /** Client id being followed. */
  declare following: number | null;

  static override styles = css`
    :host {
      position: absolute;
      z-index: 6;
      display: flex;
      pointer-events: none;
      margin: 12px;
    }
    :host([position='top-right']),
    :host(:not([position])) {
      top: 0;
      right: 0;
    }
    :host([position='top-left']) {
      top: 0;
      left: 0;
    }
    :host([position='bottom-right']) {
      bottom: 0;
      right: 0;
    }
    :host([position='bottom-left']) {
      bottom: 0;
      left: 0;
    }
    .row {
      display: flex;
      align-items: center;
      padding: 4px 6px 4px 10px;
      border-radius: 999px;
      background: var(
        --xy-avatars-bg,
        var(--xy-node-background-color, var(--xy-node-background-color-default, #fff))
      );
      backdrop-filter: blur(8px);
      box-shadow:
        0 1px 2px rgba(15, 23, 42, 0.08),
        0 4px 14px rgba(15, 23, 42, 0.1),
        0 0 0 1px rgba(15, 23, 42, 0.06);
      pointer-events: auto;
    }
    .row:empty {
      display: none;
    }
    .live {
      font:
        600 11px/1 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      color: var(--xy-avatars-fg, var(--xy-node-color, var(--xy-node-color-default, #475569)));
      margin-right: 8px;
      white-space: nowrap;
    }
    button {
      all: unset;
      box-sizing: border-box;
      position: relative;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      margin-left: -6px;
      border-radius: 50%;
      background: var(--c);
      color: var(--on);
      font:
        600 11px/1 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      cursor: pointer;
      box-shadow:
        0 0 0 2px
          var(
            --xy-avatars-gap,
            var(--xy-node-background-color, var(--xy-node-background-color-default, #fff))
          ),
        0 0 0 4px var(--c);
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
      overflow: visible;
    }
    button:first-of-type {
      margin-left: 0;
    }
    button:hover {
      transform: translateY(-2px);
      z-index: 1;
    }
    button:focus-visible {
      outline: 2px solid var(--xy-avatars-focus, #2563eb);
      outline-offset: 4px;
      z-index: 2;
    }
    button img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    button.following::after {
      content: '';
      position: absolute;
      inset: -7px;
      border-radius: 50%;
      border: 2px solid var(--c);
      animation: pulse 1.4s ease-out infinite;
    }
    button.self {
      opacity: 0.85;
    }
    .more {
      margin-left: 6px;
      font:
        600 11px/1 system-ui,
        sans-serif;
      color: var(--xy-avatars-fg, var(--xy-node-color, var(--xy-node-color-default, #475569)));
    }
    @keyframes pulse {
      from {
        transform: scale(0.85);
        opacity: 0.9;
      }
      to {
        transform: scale(1.25);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button.following::after {
        animation: none;
      }
    }
  `;

  readonly #presence = new PresenceController(this, {
    flowChanged: (flow) => this.#bindFlow(flow),
    presenceChanged: () => this.#sync(),
    remotesChanged: () => this.#sync(),
  });
  #flow: XyFlowElement | null = null;
  #unbindFlow: (() => void) | null = null;
  #remotes: [number, PresenceState][] = [];
  #signature = '';
  #beforeClick: number | null = null;

  constructor() {
    super();
    this.position = 'top-right';
    this.max = 5;
    this.includeSelf = false;
    this.version = 0;
    this.following = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unbindFlow?.();
    this.#unbindFlow = null;
    this.#flow = null;
  }

  /** Start (or, with `null`, stop) following a user. */
  follow(clientId: number | null): void {
    if (clientId === this.following) return;
    this.following = clientId;
    this.dispatchEvent(
      new CustomEvent<FollowChangeDetail>('follow-change', {
        detail: { clientId },
        bubbles: true,
        composed: true,
      }),
    );
    if (clientId !== null) this.#followStep(true);
  }

  #bindFlow(flow: XyFlowElement | null): void {
    if (flow === this.#flow) return;
    this.#unbindFlow?.();
    this.#unbindFlow = null;
    this.#flow = flow;
    if (!flow) return;
    // a pan by the local user (a real event, not our own programmatic move) ends following
    const onMoveStart = (event: Event): void => {
      const detail = (event as CustomEvent<{ event: unknown }>).detail;
      if (this.following !== null && detail.event) this.follow(null);
    };
    flow.addEventListener('move-start', onMoveStart);
    this.#unbindFlow = () => flow.removeEventListener('move-start', onMoveStart);
  }

  #sync(): void {
    const presence: PresenceChannel | undefined = this.#presence.presence;
    this.#remotes = presence ? [...presence.remotes()].sort((a, b) => a[0] - b[0]) : [];
    if (this.following !== null && !this.#remotes.some(([id]) => id === this.following)) {
      this.follow(null);
    }
    this.#followStep(false);
    const signature = this.#remotes
      .map(([id, s]) => `${id}:${s.user.name}:${s.user.color}:${s.user.avatar ?? ''}`)
      .join('|');
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.version++;
    }
  }

  /** Move to the followed user's viewport. */
  #followStep(force: boolean): void {
    if (this.following === null) return;
    const remote = this.#remotes.find(([id]) => id === this.following)?.[1];
    const viewport = remote?.viewport;
    const store = this.#presence.store;
    if (!viewport || !store) return;
    const [x, y, zoom] = store.getState().transform;
    if (!force && x === viewport.x && y === viewport.y && zoom === viewport.zoom) return;
    void store.instance.setViewport(viewport, { duration: 120 });
  }

  #onClick(event: MouseEvent, id: number): void {
    // a double click is two clicks and a dblclick: the second click undoes the first
    if (event.detail <= 1) {
      this.#beforeClick = this.following;
      this.follow(this.following === id ? null : id);
    } else {
      this.follow(this.#beforeClick);
    }
  }

  #onDoubleClick(id: number): void {
    const cursor = this.#remotes.find(([c]) => c === id)?.[1].cursor;
    const store = this.#presence.store;
    if (!cursor || !store) return;
    void store.instance.setCenter(cursor.x, cursor.y, {
      zoom: store.getState().transform[2],
      duration: 300,
    });
  }

  protected override render(): TemplateResult | typeof nothing {
    void this.version;
    const me = this.#presence.presence?.state.user;
    const list: [number | null, PresenceState['user']][] = this.#remotes.map(([id, s]) => [
      id,
      s.user,
    ]);
    if (this.includeSelf && me) list.push([null, me]);
    if (!list.length) return nothing;
    const shown = list.slice(0, Math.max(1, this.max));
    const hidden = list.length - shown.length;
    return html`<div class="row" role="group" aria-label="People in this room">
      <span class="live">${this.#remotes.length + (me ? 1 : 0)} online</span>
      ${shown.map(([id, user]) => {
        const image = safeImage(user.avatar);
        const label = id === null ? `${user.name} (you)` : user.name;
        return html`<button
          part="avatar"
          class="${id === this.following ? 'following' : ''} ${id === null ? 'self' : ''}"
          style="--c:${user.color};--on:${readableOn(user.color)}"
          title=${id === null ? label : `${label} — click to follow, double-click to find`}
          aria-label=${label}
          aria-pressed=${id === null ? nothing : String(id === this.following)}
          ?disabled=${id === null}
          @click=${(e: MouseEvent) => id !== null && this.#onClick(e, id)}
          @dblclick=${() => id !== null && this.#onDoubleClick(id)}
        >
          ${image ? html`<img src=${image} alt="" draggable="false" />` : initials(user.name)}
        </button>`;
      })}
      ${hidden > 0 ? html`<span class="more">+${hidden}</span>` : nothing}
    </div>`;
  }
}
