import '@xy-lit/flow/define.js';
import '@xy-lit/collab-yjs/define.js';
import { html, nothing, render } from 'lit';
import type { TemplateResult } from 'lit';
import { MarkerType } from '@xy-lit/flow';
import type { Node, XyFlowElement } from '@xy-lit/flow';
import type { XyPresenceAvatarsElement, YjsFlowSource } from '@xy-lit/collab-yjs';
import { nodeTypes, EMOJIS, startEdit } from '../collab/nodes';
import { SWATCHES } from '../collab/seed';
import { createSession } from '../collab/session';
import type { ConnectionStatus, Session } from '../collab/session';
import { icons, logo, shellCss } from '../collab/ui';
import type { Mount } from '../router';

export const links = ['/collab/demo'];

type MenuState =
  | { kind: 'pane'; x: number; y: number; point: { x: number; y: number } }
  | { kind: 'node'; x: number; y: number; id: string }
  | { kind: 'edge'; x: number; y: number; id: string };

type Toast = { id: number; text: string; color?: string };

declare global {
  interface Window {
    /** Test hook: everything the collab e2e specs need. */
    collab?: {
      session: Session;
      flow: XyFlowElement;
      source: YjsFlowSource;
      addIdea(point?: { x: number; y: number }): string;
    };
  }
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const uid = (): string => `n-${Math.random().toString(36).slice(2, 9)}`;

const mount: Mount = (root, params) => {
  const room = params.room ?? 'demo';
  const search = new URLSearchParams(location.search);
  const readOnly = search.has('ro');
  const session = createSession(room, { readOnly });
  const { source } = session;

  if (!document.getElementById('cx-style')) {
    const style = document.createElement('style');
    style.id = 'cx-style';
    style.textContent = shellCss;
    document.head.append(style);
  }
  document.title = `${room} · XY Lit collab`;

  // state ---------------------------------------------------------------------------------------
  let theme: 'light' | 'dark' =
    (localStorage.getItem('xy-collab-theme') as 'light' | 'dark' | null) ??
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  let status: ConnectionStatus = session.status();
  let online = 0;
  let zoom = 1;
  let copied = false;
  let menu: MenuState | null = null;
  let toasts: Toast[] = [];
  let toastId = 0;
  let canUndo = false;
  let canRedo = false;

  // the flow ------------------------------------------------------------------------------------
  const flow = document.createElement('xy-flow');
  flow.loading = true;
  flow.setAttribute('min-zoom', '0.2');
  flow.setAttribute('max-zoom', '2.5');
  flow.setAttribute('connection-mode', 'loose');
  flow.setAttribute('default-marker-color', '#94a3b8');
  flow.setAttribute('edges-reconnectable', '');
  flow.setAttribute('color-mode', theme);
  flow.setAttribute('data-testid', 'collab-flow');
  flow.nodeTypes = nodeTypes;
  flow.fitViewOptions = { padding: 0.25, maxZoom: 1.1 };
  flow.defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 } };
  if (readOnly) {
    flow.nodesDraggable = false;
    flow.nodesConnectable = false;
    flow.elementsSelectable = true;
  }
  const cursors = document.createElement('xy-remote-cursors');
  const avatars = document.createElement('xy-presence-avatars') as XyPresenceAvatarsElement;
  flow.append(cursors, avatars);
  flow.source = source;
  void session.ready.then(async () => {
    await flow.whenRendered();
    await flow.fitView({ padding: 0.25, maxZoom: 1.1 });
    flow.loading = false;
  });

  // helpers -------------------------------------------------------------------------------------
  const toast = (text: string, color?: string): void => {
    const id = ++toastId;
    toasts = [...toasts, { id, text, color }];
    draw();
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      draw();
    }, 4500);
  };

  const stageRect = (): DOMRect => root.querySelector('.cx-stage')!.getBoundingClientRect();

  const centerPoint = (): { x: number; y: number } => {
    const rect = flow.getBoundingClientRect();
    return flow.instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  /** Add a node around a flow position and select it. Returns its id. */
  const addNode = (kind: 'idea' | 'note', at?: { x: number; y: number }): string => {
    const id = uid();
    const p = at ?? centerPoint();
    const swatch = SWATCHES[Math.floor(Math.random() * SWATCHES.length)]!;
    const node: Node =
      kind === 'idea'
        ? {
            id,
            type: 'idea',
            position: { x: Math.round(p.x - 95), y: Math.round(p.y - 26) },
            data: {
              label: 'New idea',
              emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
              color: swatch.id,
            },
          }
        : {
            id,
            type: 'note',
            position: { x: Math.round(p.x - 135), y: Math.round(p.y - 20) },
            data: { title: 'Note', body: '', color: swatch.id },
          };
    flow.instance.addNodes(node);
    flow.store.flush();
    flow.store.resetSelectedElements();
    flow.store.addSelectedNodes([id]);
    // start typing the title of a new node at once
    const t0 = performance.now();
    const focus = (): void => {
      const input = flow.renderRoot.querySelector<HTMLInputElement>(
        `xy-node[data-id="${id}"] header input, xy-node[data-id="${id}"] .xyc-idea input`,
      );
      // a node is hidden until it is measured, and a hidden field cannot take focus: retry
      if (input) startEdit(input);
      const focused = (flow.shadowRoot ?? document).activeElement;
      if (focused !== input && performance.now() - t0 < 1500) {
        requestAnimationFrame(focus);
      }
    };
    requestAnimationFrame(focus);
    return id;
  };

  const duplicate = (id: string): void => {
    const n = flow.instance.getNode(id);
    if (!n) return;
    const copy: Node = {
      ...structuredClone({ type: n.type, data: n.data, position: n.position }),
      id: uid(),
      position: { x: n.position.x + 36, y: n.position.y + 36 },
    };
    flow.instance.addNodes(copy);
  };

  const copyLink = async (): Promise<void> => {
    const url = new URL(location.href);
    url.searchParams.delete('ro');
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      /* clipboard may be unavailable (insecure context); the URL is in the address bar anyway */
    }
    copied = true;
    draw();
    setTimeout(() => {
      copied = false;
      draw();
    }, 1600);
  };

  const closeMenu = (): void => {
    if (!menu) return;
    menu = null;
    draw();
  };

  const openMenu = (event: MouseEvent, build: (x: number, y: number) => MenuState): void => {
    event.preventDefault();
    const rect = stageRect();
    const x = Math.min(event.clientX - rect.left, rect.width - 220);
    const y = Math.min(event.clientY - rect.top, rect.height - 260);
    menu = build(Math.max(8, x), Math.max(8, y));
    draw();
  };

  // events --------------------------------------------------------------------------------------
  flow.addEventListener('pane-context-menu', (e) => {
    const { event } = e.detail;
    openMenu(event, (x, y) => ({
      kind: 'pane',
      x,
      y,
      point: flow.instance.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    }));
  });
  flow.addEventListener('node-context-menu', (e) => {
    openMenu(e.detail.event, (x, y) => ({ kind: 'node', x, y, id: e.detail.node.id }));
  });
  flow.addEventListener('edge-context-menu', (e) => {
    openMenu(e.detail.event, (x, y) => ({ kind: 'edge', x, y, id: e.detail.edge.id }));
  });
  flow.addEventListener('pane-click', closeMenu);
  flow.addEventListener('move-start', closeMenu);
  flow.addEventListener('viewport-change', (e) => {
    const { x, y, zoom: z } = e.detail.viewport;
    const dots = root.querySelector<HTMLElement>('.cx-dots');
    if (dots) {
      dots.style.setProperty('--z', String(z));
      dots.style.setProperty('--dz', String(Math.max(0.6, Math.min(1.6, z))));
      dots.style.setProperty('--x', `${x}px`);
      dots.style.setProperty('--y', `${y}px`);
    }
    if (Math.abs(z - zoom) > 0.001) {
      zoom = z;
      draw();
    }
  });
  flow.addEventListener('flow-error', (e) => {
    const { code, message } = e.detail;
    if (code === 'XYL20' || code === 'XYL21' || code === 'XYL10') toast(message, '#f59e0b');
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeMenu();
  };
  const onDocPointer = (e: PointerEvent): void => {
    if (menu && !(e.target as Element | null)?.closest?.('.cx-menu')) closeMenu();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onDocPointer, true);

  let wasOffline = false;
  session.onStatus((next) => {
    status = next;
    if (next === 'offline') wasOffline = true;
    if (next === 'online' && wasOffline) {
      wasOffline = false;
      toast('Back online: your changes were merged', '#22c55e');
    }
    draw();
  });
  source.history?.subscribe(() => {
    canUndo = source.history!.canUndo();
    canRedo = source.history!.canRedo();
    draw();
  });
  const known = new Set<number>();
  source.presence?.subscribe(() => {
    const remotes = source.presence!.remotes();
    const names = new Map([...remotes].map(([id, s]) => [id, s.user]));
    for (const [id, user] of names) {
      if (!known.has(id)) {
        known.add(id);
        toast(`${user.name} joined`, user.color);
      }
    }
    for (const id of [...known]) if (!names.has(id)) known.delete(id);
    if (names.size !== online) {
      online = names.size;
      draw();
    }
  });

  // template ------------------------------------------------------------------------------------
  const setTheme = (next: 'light' | 'dark'): void => {
    theme = next;
    localStorage.setItem('xy-collab-theme', next);
    flow.colorMode = next;
    draw();
  };

  const statusText = (): string =>
    status === 'online'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : session.hasServer
          ? 'Offline · saved locally'
          : 'Collaboration server not reachable · saved locally';

  const menuTemplate = (): TemplateResult | typeof nothing => {
    if (!menu) return nothing;
    const m = menu;
    const run = (fn: () => void) => () => {
      fn();
      closeMenu();
    };
    let body: TemplateResult;
    if (m.kind === 'pane') {
      body = html`
        <h6>Add here</h6>
        ${
          readOnly
            ? nothing
            : html`<button
                  class="item"
                  data-testid="menu-add-idea"
                  @click=${run(() => addNode('idea', m.point))}
                >
                  ${icons.bulb}Add idea
                </button>
                <button
                  class="item"
                  data-testid="menu-add-note"
                  @click=${run(() => addNode('note', m.point))}
                >
                  ${icons.note}Add note
                </button>
                <hr />`
        }
        <button
          class="item"
          @click=${run(() => void flow.fitView({ duration: 300, padding: 0.25 }))}
        >
          ${icons.fit}Fit view
        </button>
        <button class="item" @click=${run(() => void copyLink())}>
          ${icons.link}Copy invite link
        </button>
      `;
    } else if (m.kind === 'node') {
      body = html`
        ${
          readOnly
            ? nothing
            : html`<h6>Colour</h6>
                <div class="cx-swatches">
                  ${SWATCHES.map(
                    (s) =>
                      html`<button
                        style="background:${s.accent}"
                        title=${s.id}
                        aria-label=${s.id}
                        @click=${run(() => flow.instance.updateNodeData(m.id, { color: s.id }))}
                      ></button>`,
                  )}
                </div>
                <hr />
                <button class="item" @click=${run(() => duplicate(m.id))}>
                  ${icons.copy}Duplicate
                </button>
                <button
                  class="item danger"
                  data-testid="menu-delete"
                  @click=${run(() => void flow.instance.deleteElements({ nodes: [{ id: m.id }] }))}
                >
                  ${icons.trash}Delete
                </button>`
        }
      `;
    } else {
      body = readOnly
        ? html`<h6>View only</h6>`
        : html`<button
            class="item danger"
            @click=${run(() => void flow.instance.deleteElements({ edges: [{ id: m.id }] }))}
          >
            ${icons.trash}Delete connection
          </button>`;
    }
    return html`<div
      class="cx-menu"
      role="menu"
      data-testid="context-menu"
      style="left:${m.x}px;top:${m.y}px"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${body}
    </div>`;
  };

  const tool = (
    label: string,
    iconTpl: TemplateResult,
    onClick: () => void,
    o: { disabled?: boolean; testid?: string; cls?: string; text?: string } = {},
  ) =>
    html`<button
      class="cx-tool ${o.cls ?? ''}"
      type="button"
      title=${label}
      aria-label=${label}
      data-testid=${o.testid ?? nothing}
      ?disabled=${o.disabled}
      @click=${onClick}
    >
      ${iconTpl}${o.text ?? nothing}
    </button>`;

  const draw = (): void => {
    render(
      html`<div class="cx-app" data-theme=${theme}>
        <header class="cx-bar">
          <a class="cx-brand" href=${import.meta.env.BASE_URL}>${logo}<span>XY Lit</span><small>Collab</small></a>
          <button
            class="cx-room"
            type="button"
            title="Copy invite link"
            data-testid="copy-link"
            @click=${() => void copyLink()}
          >
            ${icons.link}<b>${room}</b><em>${copied ? 'Copied!' : 'Copy link'}</em>
          </button>
          <span class="cx-spacer"></span>
          ${readOnly ? html`<span class="cx-badge">${icons.eye}<span>View only</span></span>` : nothing}
          <span class="cx-status" data-status=${status} data-testid="status"
            ><i></i>${statusText()}</span
          >
          <button
            class="cx-btn"
            type="button"
            data-testid="offline-toggle"
            ?disabled=${!session.hasServer}
            title=${session.isOffline() ? 'Reconnect to the server' : 'Disconnect: edits are kept locally and merged when you reconnect'}
            @click=${() => session.setOffline(!session.isOffline())}
          >
            ${session.isOffline() ? icons.wifi : icons.wifiOff}<span
              >${session.isOffline() ? 'Reconnect' : 'Go offline'}</span
            >
          </button>
          <button
            class="cx-btn icon"
            type="button"
            title="Toggle theme"
            aria-label="Toggle theme"
            @click=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            ${theme === 'dark' ? icons.sun : icons.moon}
          </button>
          <span class="cx-you" title="You">
            <i style="background:${session.user.color}">${initials(session.user.name)}</i
            ><span>${session.user.name}</span>
          </span>
        </header>
        <main class="cx-stage">
          <div class="cx-dots"></div>
          ${flow}
          <div class="cx-toolbar" role="toolbar" aria-label="Canvas tools">
            ${tool('Undo (your changes only)', icons.undo, () => source.history?.undo(), { disabled: !canUndo, testid: 'undo' })}
            ${tool('Redo', icons.redo, () => source.history?.redo(), { disabled: !canRedo, testid: 'redo' })}
            <span class="cx-sep"></span>
            ${tool('Zoom out', icons.minus, () => void flow.instance.zoomOut({ duration: 200 }))}
            ${tool('Reset zoom', html``, () => void flow.instance.zoomTo(1, { duration: 200 }), { cls: 'zoom', text: `${Math.round(zoom * 100)}%` })}
            ${tool('Zoom in', icons.plus, () => void flow.instance.zoomIn({ duration: 200 }))}
            ${tool('Fit view', icons.fit, () => void flow.fitView({ duration: 300, padding: 0.25 }))}
            ${
              readOnly
                ? nothing
                : html`<span class="cx-sep"></span>
                    ${tool('Add idea', icons.bulb, () => addNode('idea'), { testid: 'add-idea', cls: 'primary', text: 'Idea' })}
                    ${tool('Add note', icons.note, () => addNode('note'), { testid: 'add-note', text: 'Note' })}`
            }
          </div>
          <p class="cx-hint">
            <kbd>Right-click</kbd> the canvas to add a node<br />Share this URL to invite others
          </p>
          ${menuTemplate()}
          <div class="cx-toasts" aria-live="polite">
            ${toasts.map((t) => html`<div class="cx-toast" style=${t.color ? `--c:${t.color}` : ''}><i></i>${t.text}</div>`)}
          </div>
        </main>
      </div>`,
      root,
    );
  };

  window.collab = { session, flow, source, addIdea: (p) => addNode('idea', p) };
  window.flow = flow;
  draw();
};

export default mount;
