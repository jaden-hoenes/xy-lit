/** Small helpers for the `pro-*` demo pages: plain positioned HTML, no UI package needed. */
import '@xy-lit/flow/define.js';
import type { XyFlowElement } from '@xy-lit/flow';

/** A fixed bar with buttons at the top left of the page. Returns the bar and a button map. */
export function toolbar(
  root: HTMLElement,
  buttons: Record<string, () => void | Promise<void>>,
): { bar: HTMLElement; buttons: Record<string, HTMLButtonElement>; status: HTMLElement } {
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:20;display:flex;gap:6px;align-items:center;' +
    'background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px;font:13px system-ui';
  bar.dataset.testid = 'toolbar';
  const made: Record<string, HTMLButtonElement> = {};
  for (const [label, run] of Object.entries(buttons)) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.action = label.toLowerCase().replace(/\W+/g, '-');
    b.addEventListener('click', () => void run());
    bar.append(b);
    made[label] = b;
  }
  const status = document.createElement('span');
  status.dataset.testid = 'status';
  bar.append(status);
  root.append(bar);
  return { bar, buttons: made, status };
}

/** A full-page flow element with the usual demo size, put on `window.flow`. */
export function demoFlow(root: HTMLElement): XyFlowElement {
  root.replaceChildren();
  const flow = document.createElement('xy-flow');
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  root.append(flow);
  Object.assign(window, { flow });
  return flow;
}
