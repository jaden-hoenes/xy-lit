import { svg } from 'lit';

/** Stroke icons (24x24, 1.8 stroke), inline so the demo needs no icon font. */
const icon = (paths: ReturnType<typeof svg>) =>
  svg`<svg class="cx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  undo: icon(svg`<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>`),
  redo: icon(svg`<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>`),
  minus: icon(svg`<path d="M5 12h14"/>`),
  plus: icon(svg`<path d="M12 5v14M5 12h14"/>`),
  fit: icon(
    svg`<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>`,
  ),
  link: icon(
    svg`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  ),
  wifi: icon(
    svg`<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".6" fill="currentColor"/>`,
  ),
  wifiOff: icon(
    svg`<path d="m3 3 18 18"/><path d="M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 3.2-2.2M12.5 7.6A10 10 0 0 1 19 12.5"/><circle cx="12" cy="19.5" r=".6" fill="currentColor"/>`,
  ),
  sun: icon(
    svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  ),
  moon: icon(svg`<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>`),
  bulb: icon(
    svg`<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>`,
  ),
  note: icon(
    svg`<path d="M5 4h14a1 1 0 0 1 1 1v9l-6 6H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 20v-5a1 1 0 0 1 1-1h5"/>`,
  ),
  trash: icon(
    svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>`,
  ),
  copy: icon(
    svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>`,
  ),
  eye: icon(
    svg`<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>`,
  ),
};

export const logo = svg`<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><defs><linearGradient id="cx-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#cx-g)"/><circle cx="9.5" cy="16" r="2.6" fill="#fff"/><circle cx="22.5" cy="9.5" r="2.6" fill="#fff"/><circle cx="22.5" cy="22.5" r="2.6" fill="#fff"/><path d="M12 15.2 20 10.6M12 16.8 20 21.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;

export const shellCss = /* css */ `
.cx-app {
  --cx-bg: #f5f6fb;
  --cx-bar: rgba(255, 255, 255, 0.8);
  --cx-surface: #ffffff;
  --cx-fg: #0f172a;
  --cx-muted: #64748b;
  --cx-line: rgba(15, 23, 42, 0.09);
  --cx-dot: rgba(100, 116, 139, 0.32);
  --cx-accent: #6366f1;
  --cx-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px -6px rgba(15, 23, 42, 0.16);
  --cx-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  /* node look, read by the node renderers inside the flow's shadow root */
  --xyc-surface: #ffffff;
  --xyc-fg: #0f172a;
  --xyc-muted: #94a3b8;
  --xyc-line: rgba(15, 23, 42, 0.1);
  --xyc-font: var(--cx-font);
  /* flow theming */
  --xy-background-color: transparent;
  --xy-edge-stroke: #94a3b8;
  --xy-edge-stroke-width: 2;
  --xy-edge-stroke-selected: var(--cx-accent);
  --xy-connectionline-stroke: var(--cx-accent);
  --xy-connectionline-stroke-width: 2;
  --xy-attribution-background-color: transparent;

  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--cx-bg);
  color: var(--cx-fg);
  font-family: var(--cx-font);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}
.cx-app[data-theme='dark'] {
  --cx-bg: #0b0d14;
  --cx-bar: rgba(17, 20, 30, 0.8);
  --cx-surface: #151925;
  --cx-fg: #e6e9f2;
  --cx-muted: #8a93a8;
  --cx-line: rgba(255, 255, 255, 0.09);
  --cx-dot: rgba(148, 163, 184, 0.22);
  --cx-accent: #818cf8;
  --cx-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 30px -8px rgba(0, 0, 0, 0.6);
  --xyc-surface: #171b29;
  --xyc-fg: #e6e9f2;
  --xyc-muted: #6b7489;
  --xyc-line: rgba(255, 255, 255, 0.1);
  --xy-edge-stroke: #4b5568;
}
.cx-app *, .cx-app *::before, .cx-app *::after { box-sizing: border-box; }
.cx-app button { font: inherit; color: inherit; }
.cx-ico { width: 18px; height: 18px; flex: none; }

/* top bar ------------------------------------------------------------------------------------ */
.cx-bar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  background: var(--cx-bar);
  backdrop-filter: saturate(1.4) blur(14px);
  border-bottom: 1px solid var(--cx-line);
}
.cx-brand { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; font-weight: 700; letter-spacing: -0.02em; font-size: 15px; }
.cx-brand small { font-weight: 600; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--cx-accent); background: color-mix(in srgb, var(--cx-accent) 12%, transparent); padding: 3px 8px; border-radius: 999px; }
.cx-room {
  display: inline-flex; align-items: center; gap: 8px; margin-left: 8px; height: 32px; padding: 0 6px 0 12px;
  border-radius: 999px; border: 1px solid var(--cx-line); background: var(--cx-surface); cursor: pointer; color: var(--cx-muted);
  transition: border-color .15s, color .15s;
}
.cx-room:hover { border-color: color-mix(in srgb, var(--cx-accent) 50%, var(--cx-line)); color: var(--cx-fg); }
.cx-room b { font-weight: 600; color: var(--cx-fg); max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cx-room em { font-style: normal; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: color-mix(in srgb, var(--cx-accent) 14%, transparent); color: var(--cx-accent); }
.cx-spacer { flex: 1; }
.cx-status { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--cx-surface); border: 1px solid var(--cx-line); font-size: 12.5px; font-weight: 600; color: var(--cx-muted); white-space: nowrap; }
.cx-status i { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
.cx-status[data-status='online'] i { background: #22c55e; box-shadow: 0 0 0 0 rgba(34, 197, 94, .5); animation: cx-pulse 2s infinite; }
.cx-status[data-status='connecting'] i { background: #f59e0b; animation: cx-blink 1s infinite; }
.cx-status[data-status='offline'] i { background: #ef4444; }
.cx-status[data-status='offline'] { color: #b91c1c; }
.cx-app[data-theme='dark'] .cx-status[data-status='offline'] { color: #fca5a5; }
.cx-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 999px;
  border: 1px solid var(--cx-line); background: var(--cx-surface); cursor: pointer; font-size: 12.5px; font-weight: 600; transition: background .15s, border-color .15s, transform .1s;
}
.cx-btn:hover { border-color: color-mix(in srgb, var(--cx-accent) 45%, var(--cx-line)); }
.cx-btn:active { transform: translateY(1px); }
.cx-btn.icon { width: 32px; padding: 0; }
.cx-btn:focus-visible, .cx-tool:focus-visible, .cx-menu button:focus-visible { outline: 2px solid var(--cx-accent); outline-offset: 2px; }
.cx-you { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 6px; border-radius: 999px; background: var(--cx-surface); border: 1px solid var(--cx-line); font-weight: 600; font-size: 12.5px; }
.cx-you i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-style: normal; font-size: 10px; font-weight: 700; }
.cx-badge { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; background: color-mix(in srgb, #f59e0b 18%, transparent); color: #b45309; display: inline-flex; gap: 6px; align-items: center; }

/* stage -------------------------------------------------------------------------------------- */
.cx-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; isolation: isolate; }
.cx-dots {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  --z: 1; --x: 0px; --y: 0px;
  background-image: radial-gradient(circle, var(--cx-dot) calc(1.3px * var(--dz, 1)), transparent calc(1.6px * var(--dz, 1)));
  background-size: calc(24px * var(--z)) calc(24px * var(--z));
  background-position: var(--x) var(--y);
}
.cx-dots::after { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 40%, transparent 55%, color-mix(in srgb, var(--cx-bg) 90%, transparent) 100%); }
.cx-stage xy-flow { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 1; }

/* floating toolbar --------------------------------------------------------------------------- */
.cx-toolbar {
  position: absolute; z-index: 10; left: 50%; bottom: 22px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px; padding: 5px; border-radius: 16px;
  background: var(--cx-bar); backdrop-filter: saturate(1.4) blur(14px); border: 1px solid var(--cx-line); box-shadow: var(--cx-shadow);
}
.cx-tool {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 36px; height: 36px; padding: 0 10px; border: 0; border-radius: 11px;
  background: transparent; cursor: pointer; color: var(--cx-fg); font-weight: 600; font-size: 12.5px; transition: background .12s;
}
.cx-tool:hover:not(:disabled) { background: color-mix(in srgb, var(--cx-fg) 8%, transparent); }
.cx-tool:disabled { opacity: .35; cursor: default; }
.cx-tool.zoom { min-width: 54px; font-variant-numeric: tabular-nums; color: var(--cx-muted); }
.cx-tool.primary { background: var(--cx-accent); color: #fff; padding: 0 14px; }
.cx-tool.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--cx-accent) 88%, #000); }
.cx-sep { width: 1px; height: 22px; margin: 0 5px; background: var(--cx-line); }
.cx-hint { position: absolute; z-index: 0; left: 18px; bottom: 18px; margin: 0; font-size: 12px; color: var(--cx-muted); pointer-events: none; line-height: 1.5; }
.cx-hint kbd { font: inherit; font-weight: 600; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--cx-line); background: var(--cx-surface); }

/* context menu ------------------------------------------------------------------------------- */
.cx-menu {
  position: absolute; z-index: 30; min-width: 200px; padding: 6px; border-radius: 14px; background: var(--cx-surface);
  border: 1px solid var(--cx-line); box-shadow: var(--cx-shadow); animation: cx-pop .12s ease-out; transform-origin: top left;
}
.cx-menu h6 { margin: 6px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cx-muted); }
.cx-menu button.item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; font-size: 13.5px; font-weight: 500;
}
.cx-menu button.item:hover { background: color-mix(in srgb, var(--cx-accent) 12%, transparent); }
.cx-menu button.item.danger { color: #dc2626; }
.cx-menu button.item.danger:hover { background: color-mix(in srgb, #dc2626 12%, transparent); }
.cx-menu hr { border: 0; border-top: 1px solid var(--cx-line); margin: 6px 4px; }
.cx-swatches { display: flex; gap: 6px; padding: 4px 10px 8px; }
.cx-swatches button { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--cx-surface); box-shadow: 0 0 0 1px var(--cx-line); cursor: pointer; padding: 0; transition: transform .1s; }
.cx-swatches button:hover { transform: scale(1.18); }

/* toasts ------------------------------------------------------------------------------------- */
.cx-toasts { position: absolute; z-index: 40; top: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
.cx-toast {
  display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 12px; background: var(--cx-surface); border: 1px solid var(--cx-line);
  box-shadow: var(--cx-shadow); font-size: 13px; font-weight: 500; animation: cx-drop .2s ease-out; pointer-events: auto;
}
.cx-toast i { width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--cx-accent)); flex: none; }

@keyframes cx-pop { from { opacity: 0; transform: scale(.96); } }
@keyframes cx-drop { from { opacity: 0; transform: translateY(-8px); } }
@keyframes cx-pulse { 70% { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
@keyframes cx-blink { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .cx-app * { animation: none !important; transition: none !important; } }
@media (max-width: 720px) {
  .cx-brand small, .cx-room em, .cx-hint, .cx-you span, .cx-btn span { display: none; }
  .cx-bar { gap: 6px; padding: 0 10px; }
  .cx-room b { max-width: 12ch; }
}
`;
