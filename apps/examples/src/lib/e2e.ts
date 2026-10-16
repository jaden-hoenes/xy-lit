/**
 * Helpers for the pages the XY Lit e2e specs (`tests/e2e/lit/*.spec.ts`) drive. Pages live in
 * `src/examples/e2e-*.ts` and expose what the specs need on `window` (`flow`, `__events`, ...).
 */
import '@xy-lit/flow/define.js';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';

/** Page globals the specs read. */
declare global {
  interface Window {
    flow?: XyFlowElement;
    /** Names of the events the page listens to, in order. */
    __events?: string[];
    /** Details of `render-complete` events. */
    __renderComplete?: unknown[];
    __pwned?: number;
    [key: string]: unknown;
  }
}

/** Create a flow element that fills its container (or the given size) and set its data. */
export function createFlow(
  o: {
    nodes?: Node[];
    edges?: Edge[];
    attributes?: Record<string, string>;
    props?: Record<string, unknown>;
    style?: string;
  } = {},
): XyFlowElement {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = o.style ?? 'display:block;width:100vw;height:100vh';
  for (const [key, value] of Object.entries(o.attributes ?? {})) flow.setAttribute(key, value);
  Object.assign(flow, o.props ?? {});
  flow.nodes = o.nodes ?? [];
  flow.edges = o.edges ?? [];
  return flow;
}

/** Record the named events on `window.__events` as `name` (or `name:detail` when `describe` gives one). */
export function recordEvents(
  flow: XyFlowElement,
  names: string[],
  describe: (name: string, detail: unknown) => string = (name) => name,
): string[] {
  const events: string[] = [];
  window.__events = events;
  for (const name of names) {
    flow.addEventListener(name, (e) => {
      events.push(describe(name, (e as CustomEvent).detail));
    });
  }
  return events;
}

/** Put the flow on the page and expose it as `window.flow`. */
export function show(root: HTMLElement, ...children: HTMLElement[]): void {
  root.replaceChildren(...children);
  const flow = root.querySelector('xy-flow');
  if (flow) window.flow = flow;
}
