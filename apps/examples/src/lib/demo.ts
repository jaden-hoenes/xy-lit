/**
 * Shared helpers for the reactflow.dev-style example pages (`src/examples/*.ts`).
 *
 * Every page is a small Lit element that renders into its own light DOM (so the page CSS below
 * applies) and puts an `<xy-flow>` with its plugins in a template:
 *
 *     class MyExample extends ExampleElement {
 *       render() { return html`<xy-flow .nodes=${nodes} fit-view>...</xy-flow>`; }
 *     }
 *     export default mountExample('ex-my-example', MyExample);
 *
 * Nodes and edges are handed over once and the flow owns them afterwards (uncontrolled mode);
 * read the current state through `this.flow` (the `FlowInstance` API is on the element).
 */
import '@xy-lit/flow/define.js';
import { LitElement } from 'lit';
import { guard } from 'lit/directives/guard.js';
import type { XyFlowElement } from '@xy-lit/flow';
import type { Mount } from '../router';

const STYLE_ID = 'xy-examples-style';

const CSS = `
.ex-page { display: block; width: 100vw; height: 100vh; position: relative; font-family: system-ui, sans-serif; }
.ex-page xy-flow { display: block; width: 100%; height: 100%; }
.ex-row { display: flex; width: 100%; height: 100%; }
.ex-row > xy-flow { flex: 1; min-width: 0; }
.ex-sidebar { width: 190px; padding: 12px; border-right: 1px solid #e2e2e2; background: #fafafa; font-size: 12px; box-sizing: border-box; }
.ex-sidebar .ex-hint { margin-bottom: 10px; color: #555; }
.ex-box { background: #fff; border: 1px solid #d6d6d6; border-radius: 6px; padding: 6px 8px; font-size: 12px; color: #222; box-shadow: 0 1px 3px rgb(0 0 0 / 0.08); }
.ex-box h4 { margin: 0 0 4px; font-size: 12px; }
.ex-btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ex-btn { font: inherit; font-size: 12px; padding: 4px 9px; border: 1px solid #bbb; border-radius: 4px; background: #fff; color: #222; cursor: pointer; }
.ex-btn:hover { background: #f0f0f0; }
.ex-btn[aria-pressed='true'], .ex-btn.active { background: #1a192b; color: #fff; border-color: #1a192b; }
.ex-muted { color: #666; }
.ex-mono { font: 11px ui-monospace, monospace; }
.ex-menu { position: absolute; z-index: 20; display: flex; flex-direction: column; min-width: 130px; padding: 4px; background: #fff; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 4px 12px rgb(0 0 0 / 0.15); font-size: 12px; }
.ex-menu button { text-align: left; font: inherit; padding: 5px 8px; border: 0; background: none; cursor: pointer; border-radius: 4px; color: #222; }
.ex-menu button:hover { background: #eef2ff; }
.dark .ex-box, .ex-dark .ex-box { background: #1e1e24; border-color: #3a3a44; color: #eee; }
.dark .ex-btn, .ex-dark .ex-btn { background: #2a2a32; color: #eee; border-color: #4a4a55; }
.dark .ex-btn[aria-pressed='true'], .ex-dark .ex-btn[aria-pressed='true'] { background: #eee; color: #111; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/** Base class of the example pages: renders into the light DOM and exposes the page's flow. */
export abstract class ExampleElement extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    ensureStyle();
    this.classList.add('ex-page');
    return this;
  }

  /** The first `<xy-flow>` of the page (call after the first render). */
  get flow(): XyFlowElement {
    const flow = this.querySelector('xy-flow');
    if (!flow) throw new Error('the example has no <xy-flow> yet');
    return flow;
  }

  protected override firstUpdated(): void {
    // handy in DevTools and for the e2e specs
    Object.assign(window, { flow: this.querySelector('xy-flow') });
  }
}

/** Register the element once and return the `Mount` function the router expects. */
export function mountExample(tag: string, ctor: CustomElementConstructor): Mount {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
  return (root) => {
    root.replaceChildren(document.createElement(tag));
  };
}

/**
 * Binds `value` on the first render only. Lit re-sets a property binding to an object or array on
 * *every* render (`.nodes=${nodes}`), which would replace the flow's current nodes with the initial
 * ones each time the page re-renders. Use this for `.nodes` and `.edges`:
 * `.nodes=${initial(nodes)}`.
 */
export const initial = <T>(value: T) => guard([], () => value);

/** Adopt page CSS into the flow's render root (rules that must reach nodes and edges). */
export function adoptCss(flow: XyFlowElement, text: string): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  flow.adoptStyles(sheet);
}
