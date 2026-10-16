import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { ARIA_EDGE_DESC_KEY, ARIA_LIVE_MESSAGE, ARIA_NODE_DESC_KEY } from '@xy-lit/store';
import { getInternalNodesBounds } from '@xy-lit/store/internal';
import { markerDefs } from '../../edges/markers.js';
import { connectionLine } from '../../connection-line.js';
import { activeToolbars } from '../../nodes/node-toolbar.js';
import type { XyFlowElement } from '../xy-flow.js';

/*
 * One function per layer of the render tree (spec/04 §Render tree). Each reads the host's
 * StoreControllers, so it stays cheap when its inputs did not change.
 */

/** The nodes layer: one `<xy-node>` per visible node. */
export function nodesLayer(host: XyFlowElement): TemplateResult {
  const ctx = host.nodeContext;
  const { parentLookup } = host.store.getState();
  return html`<div ${ref(host.nodesRef)} class="lit-flow__nodes">
    ${repeat(
      host.visibleNodes.value,
      (n) => n.id,
      (n) =>
        html`<xy-node
          .node=${n}
          .px=${n.internals.positionAbsolute.x}
          .py=${n.internals.positionAbsolute.y}
          .z=${n.internals.z}
          .isParent=${parentLookup.has(n.id)}
          .ctx=${ctx}
        ></xy-node>`,
    )}
  </div>`;
}

/** The edges layer: marker defs and one `<xy-edge>` per laid-out edge. */
export function edgesLayer(host: XyFlowElement): TemplateResult {
  const ctx = host.edgeContext;
  return html`<div class="lit-flow__edges lit-flow__container">
    <svg class="lit-flow__marker"><defs>${markerDefs(host.markers.value)}</defs></svg>
    ${repeat(
      host.layoutedEdges.value.values(),
      (e) => e.id,
      (e) => html`<xy-edge .edge=${e} .ctx=${ctx}></xy-edge>`,
    )}
  </div>`;
}

/** The HTML edge-label layer (labels are published by the `<xy-edge>`s). */
export function edgeLabelLayer(host: XyFlowElement): TemplateResult {
  return html`<div class="lit-flow__edgelabel-renderer">
    ${repeat(
      host.labelEntries(),
      (l) => l.key,
      (l) => l.template,
    )}
  </div>`;
}

/** The connection line while a connection is dragged. */
export function connectionLineLayer(host: XyFlowElement): TemplateResult | typeof nothing {
  const connection = host.connection.value;
  if (!connection.inProgress) return nothing;
  const s = host.store.getState();
  return connectionLine({
    connection,
    transform: s.transform,
    width: s.width,
    height: s.height,
    nodesConnectable: s.nodesConnectable,
    type: host.connectionLineType,
    renderer: host.connectionLineRenderer,
    containerStyle: host.connectionLineContainerStyle,
    style: host.connectionLineStyle,
    instance: host.instance,
  });
}

/**
 * The box around the selected nodes (React `NodesSelection`). `PaneController` attaches `XYDrag`
 * to the inner rect, focuses it when it appears and handles its arrow keys.
 */
export function nodesSelection(host: XyFlowElement): TemplateResult | typeof nothing {
  const [userSelectionActive, , nodesSelectionActive] = host.selection.value;
  if (!nodesSelectionActive || userSelectionActive) return nothing;
  const s = host.store.getState();
  const { x, y, width, height } = getInternalNodesBounds(s.nodeLookup, {
    filter: (node) => !!node.selected,
  });
  if (!(width > 0) || !(height > 0)) return nothing;
  const { pane } = host;
  return html`<div
    class="lit-flow__nodesselection lit-flow__container ${s.noPanClassName}"
    style="transform:translate(${x}px,${y}px)"
  >
    <div
      class="lit-flow__nodesselection-rect"
      part="nodes-selection"
      tabindex=${s.disableKeyboardA11y ? nothing : -1}
      style="width:${width}px;height:${height}px"
      @click=${pane.onSelectionClick}
      @contextmenu=${pane.onSelectionContextMenu}
      @keydown=${s.disableKeyboardA11y ? nothing : pane.onSelectionKeyDown}
    ></div>
  </div>`;
}

/** The rectangle drawn while selecting (screen space, inside the pane). */
export function userSelectionRect(host: XyFlowElement): TemplateResult | typeof nothing {
  const [userSelectionActive, rect] = host.selection.value;
  if (!userSelectionActive || !rect) return nothing;
  return html`<div
    class="lit-flow__selection lit-flow__container"
    style="width:${rect.width}px;height:${rect.height}px;transform:translate(${rect.x}px,${rect.y}px)"
  ></div>`;
}

/**
 * The node toolbar layer, outside the scaled viewport (so toolbars keep their size). It is only
 * rendered while a toolbar is shown; `<xy-flow>` follows the viewport transform only then.
 */
export function nodeToolbarLayer(host: XyFlowElement): TemplateResult | typeof nothing {
  if (host.toolbars.size === 0) {
    host.toolbarsActive = false;
    return nothing;
  }
  const toolbars = activeToolbars(host.store, host.toolbars.values());
  host.toolbarsActive = toolbars.length > 0;
  if (toolbars.length === 0) return nothing;
  return html`<div class="lit-flow__node-toolbars">
    ${repeat(
      toolbars,
      (t) => t.key,
      (t) =>
        html`<div class="lit-flow__node-toolbar ${t.class}" data-id=${t.dataId} style=${t.style}>
          ${t.content}
        </div>`,
    )}
  </div>`;
}

/** Hidden descriptions referenced by `aria-describedby` and the aria-live region (React `A11yDescriptions`). */
export function a11yDescriptions(host: XyFlowElement): TemplateResult {
  const [ariaLabelConfig, ariaLiveMessage, disableKeyboardA11y, flowId] = host.a11y.value;
  return html`<div id="${ARIA_NODE_DESC_KEY}-${flowId}" class="lit-flow__a11y-hidden">
      ${
        disableKeyboardA11y
          ? ariaLabelConfig['node.a11yDescription.default']
          : ariaLabelConfig['node.a11yDescription.keyboardDisabled']
      }
    </div>
    <div id="${ARIA_EDGE_DESC_KEY}-${flowId}" class="lit-flow__a11y-hidden">
      ${ariaLabelConfig['edge.a11yDescription.default']}
    </div>
    ${
      disableKeyboardA11y
        ? nothing
        : html`<div
            id="${ARIA_LIVE_MESSAGE}-${flowId}"
            class="lit-flow__a11y-live"
            aria-live="assertive"
            aria-atomic="true"
          >
            ${ariaLiveMessage}
          </div>`
    }`;
}

/** A `<slot>` of the shadow-root render; light mode projects children instead (`LightSlotProjector`). */
export function slotFor(host: XyFlowElement, name?: string): TemplateResult | typeof nothing {
  if (host.renderRootMode === 'light') return nothing;
  return name ? html`<slot name=${name}></slot>` : html`<slot></slot>`;
}

/** The attribution link, unless hidden. */
export function attribution(host: XyFlowElement): TemplateResult | typeof nothing {
  if (host.hideAttribution) return nothing;
  const position = host.attributionPosition.split('-').join(' ');
  return html`<div class="lit-flow__panel lit-flow__attribution ${position}">
    <a href="https://xyflow.com" target="_blank" rel="noopener noreferrer">XY Lit · xyflow</a>
  </div>`;
}

/** The loading overlay, visible until the first render completes. */
export function loadingOverlay(host: XyFlowElement): TemplateResult {
  const show = !host.noLoadingOverlay && (host.loading || !host.firstRenderComplete);
  const spinner = html`<div
    class="lit-flow__spinner"
    role="status"
    aria-label="Loading diagram"
  ></div>`;
  // light root: no <slot>; `LightSlotProjector` moves a `slot="loading"` child in here
  return html`<div class="lit-flow__loading" part="loading" ?hidden=${!show}>
    ${host.renderRootMode === 'light' ? spinner : html`<slot name="loading">${spinner}</slot>`}
  </div>`;
}
