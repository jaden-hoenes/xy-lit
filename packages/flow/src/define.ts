import { XyEdgeElement } from './elements/xy-edge.js';
import { XyFlowElement } from './elements/xy-flow.js';
import { XyFlowProviderElement } from './elements/xy-flow-provider.js';
import { XyHandleElement } from './elements/xy-handle.js';
import { XyNodeElement } from './elements/xy-node.js';
import { XyBackgroundElement } from './plugins/xy-background.js';
import { XyControlButtonElement } from './plugins/xy-control-button.js';
import { XyControlsElement } from './plugins/xy-controls.js';
import { XyMinimapElement } from './plugins/xy-minimap.js';
import { XyNodeResizerElement } from './plugins/xy-node-resizer.js';
import { XyPanelElement } from './plugins/xy-panel.js';
import { XyResizeControlElement } from './plugins/xy-resize-control.js';
import { XyViewportPortalElement } from './plugins/xy-viewport-portal.js';

/**
 * Registers every element of `@xy-lit/flow`. Importing `@xy-lit/flow/define.js` is the only
 * place with side effects; registration is idempotent (tags that are already defined are
 * skipped, so two copies of the package do not throw).
 */
const elements: [string, CustomElementConstructor][] = [
  ['xy-flow-provider', XyFlowProviderElement],
  ['xy-flow', XyFlowElement],
  ['xy-node', XyNodeElement],
  ['xy-handle', XyHandleElement],
  ['xy-edge', XyEdgeElement],
  ['xy-panel', XyPanelElement],
  ['xy-background', XyBackgroundElement],
  ['xy-controls', XyControlsElement],
  ['xy-control-button', XyControlButtonElement],
  ['xy-minimap', XyMinimapElement],
  ['xy-resize-control', XyResizeControlElement],
  ['xy-node-resizer', XyNodeResizerElement],
  ['xy-viewport-portal', XyViewportPortalElement],
];

for (const [tag, ctor] of elements) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

declare global {
  interface HTMLElementTagNameMap {
    'xy-flow-provider': XyFlowProviderElement;
    'xy-flow': XyFlowElement;
    'xy-node': XyNodeElement;
    'xy-handle': XyHandleElement;
    'xy-edge': XyEdgeElement;
    'xy-panel': XyPanelElement;
    'xy-background': XyBackgroundElement;
    'xy-controls': XyControlsElement;
    'xy-control-button': XyControlButtonElement;
    'xy-minimap': XyMinimapElement;
    'xy-resize-control': XyResizeControlElement;
    'xy-node-resizer': XyNodeResizerElement;
    'xy-viewport-portal': XyViewportPortalElement;
  }
}
