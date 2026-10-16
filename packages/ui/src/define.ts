import '@xy-lit/flow/define.js';
import { XyBaseNodeElement } from './base-node.js';
import { XyDevtoolsElement, XyDevtoolsInspectorElement } from './devtools.js';
import { XyNodeSearchElement } from './node-search.js';
import { XyZoomSelectElement, XyZoomSliderElement } from './zoom-slider.js';

/**
 * Registers every element of `@xy-lit/ui` (and, through `@xy-lit/flow/define.js`, the flow's).
 * Idempotent: tags that are already defined are skipped.
 */
const elements: [string, CustomElementConstructor][] = [
  ['xy-base-node', XyBaseNodeElement],
  ['xy-zoom-slider', XyZoomSliderElement],
  ['xy-zoom-select', XyZoomSelectElement],
  ['xy-node-search', XyNodeSearchElement],
  ['xy-devtools', XyDevtoolsElement],
  ['xy-devtools-inspector', XyDevtoolsInspectorElement],
];

for (const [tag, ctor] of elements) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

declare global {
  interface HTMLElementTagNameMap {
    'xy-base-node': XyBaseNodeElement;
    'xy-zoom-slider': XyZoomSliderElement;
    'xy-zoom-select': XyZoomSelectElement;
    'xy-node-search': XyNodeSearchElement;
    'xy-devtools': XyDevtoolsElement;
    'xy-devtools-inspector': XyDevtoolsInspectorElement;
  }
}
