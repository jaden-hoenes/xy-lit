/**
 * `mountFixture`: turns a generic-test fixture config (`src/generic-tests/<topic>/<example>.ts`) into
 * a page, the way the Svelte app's `tests/generic/[topic]/[example]` route does (spec/13 §Fixture
 * pages): a full-viewport `<xy-flow>` inside a `<xy-flow-provider>`, optional plugin children.
 */
import '@xy-lit/flow/define.js';
import { devWarn } from '@xy-lit/flow';
import type { XyFlowElement } from '@xy-lit/flow';

/** Svelte Flow prop names that differ from the element's property names. */
const FLOW_PROP_ALIASES: Record<string, string> = { initialViewport: 'defaultViewport' };

/** Plugin children appended to the flow when the config has the matching `*Props`. */
const PLUGINS = [
  ['panelProps', 'xy-panel'],
  ['minimapProps', 'xy-minimap'],
  ['controlsProps', 'xy-controls'],
  ['backgroundProps', 'xy-background'],
] as const;

/** Assign `props` to an element, warning about names it does not have. */
function assignProps(el: HTMLElement, props: Record<string, unknown>, what: string): void {
  for (const [key, value] of Object.entries(props)) {
    const name = FLOW_PROP_ALIASES[key] ?? key;
    if (!(name in el)) {
      devWarn('XYL05', `fixture: ${what} has no property "${name}"; ignored.`);
      continue;
    }
    (el as unknown as Record<string, unknown>)[name] = value;
  }
}

/**
 * Mount a fixture into `root`.
 *
 * @param root - The page root (`#app`).
 * @param config - The fixture's default export.
 * @returns The flow element (also exposed as `window.flow` for debugging).
 */
export function mountFixture(root: HTMLElement, config: FlowConfig): XyFlowElement {
  const provider = document.createElement('xy-flow-provider');
  const flow = document.createElement('xy-flow');
  flow.style.cssText = 'width:100vw;height:100vh';
  assignProps(flow, config.flowProps ?? {}, '<xy-flow>');

  for (const [key, tag] of PLUGINS) {
    const props = config[key];
    if (!props) continue;
    const child = document.createElement(tag);
    assignProps(child, props, `<${tag}>`);
    flow.append(child);
  }

  provider.append(flow);
  root.replaceChildren(provider);
  Object.assign(window, { flow });
  return flow;
}
