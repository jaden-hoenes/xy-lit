import { css } from 'lit';
import { tok } from './tokens.js';

/**
 * The light-DOM styles of the node and edge types in this package (status ring, labeled and
 * button handles, database schema table, shapes, placeholder, group, tooltip, appendix, edge
 * buttons). A flow adopts them automatically when a node or edge type that carries them is in its
 * `nodeTypes` / `edgeTypes`. When you build your own node type from the helpers
 * (`statusIndicator`, `labeledHandle`, `buttonHandle`, `nodeAppendix`, `nodeTooltip`), add this
 * sheet to its `styles`: `defineNodeType({ styles: uiStyles, render })`.
 *
 * Every colour derives from the flow's own theme tokens, so it follows `color-mode`.
 * `<xy-base-node>` and the panel elements carry their own styles in their shadow roots.
 */
export const uiStyles = css`
  /* ---- handles ----------------------------------------------------------------------------- */
  .lit-flow__handle.xy-ui-handle,
  .xy-ui-node .lit-flow__handle {
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border: 2px solid var(--xy-ui-handle-color, ${tok('borderStrong')});
    background: ${tok('surface')};
    transition:
      background 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  .lit-flow__handle.xy-ui-handle::after,
  .xy-ui-node .lit-flow__handle::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
  }
  .lit-flow__handle.xy-ui-handle.connectionindicator:hover,
  .xy-ui-node .lit-flow__handle.connectionindicator:hover,
  .lit-flow__handle.xy-ui-handle.connectingfrom,
  .xy-ui-node .lit-flow__handle.connectingfrom {
    border-color: ${tok('accent')};
    background: ${tok('accent')};
    box-shadow: 0 0 0 4px color-mix(in srgb, ${tok('accent')} 24%, transparent);
  }
  .lit-flow__handle.xy-ui-handle.connectingto.valid,
  .xy-ui-node .lit-flow__handle.connectingto.valid {
    border-color: ${tok('success')};
    background: ${tok('success')};
    box-shadow: 0 0 0 4px color-mix(in srgb, ${tok('success')} 24%, transparent);
  }
  .lit-flow__handle.xy-ui-handle.connectingto:not(.valid),
  .xy-ui-node .lit-flow__handle.connectingto:not(.valid) {
    border-color: ${tok('danger')};
    background: ${tok('danger')};
  }

  /* ---- labeled handle ---------------------------------------------------------------------- */
  .xy-ui-labeled-handle {
    --_edge: calc(var(--xy-base-node-px, 0px) + var(--xy-base-node-bw, 0px));
    position: relative;
    display: flex;
    align-items: center;
    min-height: 28px;
    margin-inline: calc(-1 * var(--_edge));
    padding-inline: calc(var(--_edge) + var(--xy-ui-label-gap, 0px));
    font-size: 12px;
    color: ${tok('text')};
  }
  .xy-ui-labeled-handle.right {
    justify-content: flex-end;
    text-align: right;
  }
  .xy-ui-labeled-handle.top,
  .xy-ui-labeled-handle.bottom {
    justify-content: center;
    text-align: center;
  }
  .xy-ui-labeled-handle__label {
    padding: 4px 0;
    pointer-events: none;
    user-select: none;
  }

  /* ---- button handle ----------------------------------------------------------------------- */
  /* a sibling of the handle with the handle's box and position classes; it never takes pointer events */
  .xy-ui-button-handle__anchor {
    position: absolute;
    width: 10px;
    height: 10px;
    pointer-events: none;
  }
  .xy-ui-button-handle__stem {
    position: absolute;
    background: ${tok('borderStrong')};
    pointer-events: none;
  }
  .xy-ui-button-handle__button {
    position: absolute;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid ${tok('borderStrong')};
    border-radius: 50%;
    background: ${tok('surface')};
    color: ${tok('text')};
    font:
      500 14px/1 system-ui,
      sans-serif;
    cursor: pointer;
    pointer-events: all;
    box-shadow: ${tok('shadow')};
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
  }
  .xy-ui-button-handle__button:hover {
    border-color: ${tok('accent')};
    background: ${tok('accent')};
    color: #fff;
  }
  .xy-ui-button-handle__button:focus-visible {
    outline: 2px solid ${tok('accent')};
    outline-offset: 2px;
  }
  .lit-flow__handle-right .xy-ui-button-handle__stem,
  .lit-flow__handle-left .xy-ui-button-handle__stem {
    top: 50%;
    width: 18px;
    height: 1px;
    translate: 0 -50%;
  }
  .lit-flow__handle-right .xy-ui-button-handle__stem {
    left: 100%;
  }
  .lit-flow__handle-left .xy-ui-button-handle__stem {
    right: 100%;
  }
  .lit-flow__handle-right .xy-ui-button-handle__button {
    left: calc(100% + 18px);
    top: 50%;
    translate: 0 -50%;
  }
  .lit-flow__handle-left .xy-ui-button-handle__button {
    right: calc(100% + 18px);
    top: 50%;
    translate: 0 -50%;
  }
  .lit-flow__handle-top .xy-ui-button-handle__stem,
  .lit-flow__handle-bottom .xy-ui-button-handle__stem {
    left: 50%;
    width: 1px;
    height: 18px;
    translate: -50% 0;
  }
  .lit-flow__handle-bottom .xy-ui-button-handle__stem {
    top: 100%;
  }
  .lit-flow__handle-top .xy-ui-button-handle__stem {
    bottom: 100%;
  }
  .lit-flow__handle-bottom .xy-ui-button-handle__button {
    top: calc(100% + 18px);
    left: 50%;
    translate: -50% 0;
  }
  .lit-flow__handle-top .xy-ui-button-handle__button {
    bottom: calc(100% + 18px);
    left: 50%;
    translate: -50% 0;
  }

  /* ---- status indicator -------------------------------------------------------------------- */
  .xy-ui-status {
    position: relative;
    border-radius: ${tok('radius')};
  }
  .xy-ui-status__body {
    position: relative;
  }
  .xy-ui-status__ring {
    position: absolute;
    inset: -3px;
    overflow: hidden;
    border-radius: calc(${tok('radius')} + 3px);
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  .xy-ui-status__ring::before {
    content: '';
    position: absolute;
    inset: -100%;
    background: ${tok('accent')};
  }
  .xy-ui-status[data-status='loading'] .xy-ui-status__ring,
  .xy-ui-status[data-status='success'] .xy-ui-status__ring,
  .xy-ui-status[data-status='error'] .xy-ui-status__ring {
    opacity: 1;
  }
  .xy-ui-status[data-status='loading'] .xy-ui-status__ring::before {
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      transparent 150deg,
      color-mix(in srgb, ${tok('accent')} 35%, transparent) 230deg,
      ${tok('accent')} 360deg
    );
    animation: xy-ui-spin 1.1s linear infinite;
  }
  .xy-ui-status[data-status='success'] .xy-ui-status__ring::before {
    background: ${tok('success')};
  }
  .xy-ui-status[data-status='error'] .xy-ui-status__ring::before {
    background: ${tok('danger')};
  }
  @keyframes xy-ui-spin {
    to {
      rotate: 360deg;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .xy-ui-status[data-status='loading'] .xy-ui-status__ring::before {
      animation: none;
      background: ${tok('accent')};
    }
    .xy-ui-status__ring {
      transition: none;
    }
  }

  /* ---- database schema node ---------------------------------------------------------------- */
  .xy-ui-schema__title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .xy-ui-schema__icon {
    flex: none;
    color: ${tok('muted')};
  }
  .xy-ui-schema__table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .xy-ui-schema__row:hover {
    background: ${tok('subtle')};
  }
  .xy-ui-schema__row + .xy-ui-schema__row .xy-ui-schema__cell {
    border-top: 1px solid ${tok('border')};
  }
  .xy-ui-schema__row:last-child .xy-ui-schema__cell--start {
    border-bottom-left-radius: calc(${tok('radius')} - 1px);
  }
  .xy-ui-schema__row:last-child .xy-ui-schema__cell--end {
    border-bottom-right-radius: calc(${tok('radius')} - 1px);
  }
  .xy-ui-schema__cell {
    position: relative;
    padding: 6px 14px 6px 8px;
    white-space: nowrap;
  }
  .xy-ui-schema__cell--start {
    /* as narrow as its content: a fixed width gets no extra space. Not a percentage (the old
       \`1%\` trick): WebKit sizes a max-content table from it as content / 1 %, 100 times too wide */
    width: 0;
    padding-left: 14px;
    padding-right: 4px;
  }
  .xy-ui-schema__name {
    font-weight: 500;
  }
  .xy-ui-schema__type {
    text-align: right;
    color: ${tok('muted')};
    font-family: ${tok('mono')};
    font-size: 11px;
  }
  .xy-ui-schema__key {
    display: inline-block;
    min-width: 20px;
    padding: 0 4px;
    border-radius: 4px;
    font: 700 9.5px/16px ${tok('mono')};
    text-align: center;
    letter-spacing: 0.03em;
  }
  .xy-ui-schema__key[data-key='PK'] {
    background: color-mix(in srgb, #f59e0b 24%, transparent);
    color: color-mix(in srgb, #f59e0b 80%, currentColor);
  }
  .xy-ui-schema__key[data-key='FK'] {
    background: color-mix(in srgb, ${tok('accent')} 20%, transparent);
    color: color-mix(in srgb, ${tok('accent')} 80%, currentColor);
  }
  .xy-ui-schema__key[data-key=''] {
    visibility: hidden;
  }

  /* ---- shapes ------------------------------------------------------------------------------ */
  .xy-ui-shape {
    position: relative;
    color: ${tok('text')};
    font-size: 12px;
  }
  .xy-ui-shape__svg {
    display: block;
    overflow: visible;
  }
  .xy-ui-shape__path {
    fill: color-mix(in srgb, var(--xy-shape-color, ${tok('accent')}) 11%, ${tok('surface')});
    stroke: var(--xy-shape-color, ${tok('borderStrong')});
    stroke-width: 1.5;
    stroke-linejoin: round;
    transition:
      stroke 140ms ease,
      filter 140ms ease;
  }
  .xy-ui-shape.selected .xy-ui-shape__path {
    stroke: ${tok('accent')};
    filter: drop-shadow(0 0 5px color-mix(in srgb, ${tok('accent')} 55%, transparent));
  }
  .xy-ui-shape__text {
    position: absolute;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 2px;
    overflow: hidden;
    text-align: center;
    line-height: 1.25;
    font-weight: 500;
    pointer-events: none;
    user-select: none;
  }
  .lit-flow__handle.xy-ui-shape__handle {
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
    opacity: 0;
  }
  .lit-flow__node:hover .xy-ui-shape__handle,
  .xy-ui-shape.selected .xy-ui-shape__handle,
  .xy-ui-shape__handle.connectingfrom,
  .xy-ui-shape__handle.connectingto {
    opacity: 1;
  }

  /* ---- placeholder node -------------------------------------------------------------------- */
  .xy-ui-placeholder {
    position: relative;
    box-sizing: border-box;
    min-width: 168px;
    border: 1.5px dashed ${tok('borderStrong')};
    border-radius: ${tok('radius')};
    color: ${tok('muted')};
    transition:
      border-color 140ms ease,
      color 140ms ease,
      background 140ms ease;
  }
  .xy-ui-placeholder:hover,
  .xy-ui-placeholder.selected {
    border-color: ${tok('accent')};
    background: color-mix(in srgb, ${tok('accent')} 6%, transparent);
    color: ${tok('accent')};
  }
  .xy-ui-placeholder__button {
    appearance: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 100%;
    padding: 14px 20px;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font:
      500 12px/1.3 system-ui,
      sans-serif;
    cursor: pointer;
  }
  .xy-ui-placeholder__button:focus-visible {
    outline: 2px solid ${tok('accent')};
    outline-offset: 2px;
  }
  .xy-ui-placeholder__plus {
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
  }

  /* ---- labeled group ----------------------------------------------------------------------- */
  .xy-ui-group {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    border: 1.5px dashed ${tok('borderStrong')};
    border-radius: calc(${tok('radius')} + 4px);
    background: color-mix(in srgb, currentColor 3.5%, transparent);
    color: ${tok('text')};
    transition: border-color 140ms ease;
  }
  .xy-ui-group.selected {
    border-color: ${tok('accent')};
  }
  .xy-ui-group__label {
    position: absolute;
    top: 0;
    left: 14px;
    translate: 0 -50%;
    padding: 1px 10px;
    border: 1px solid ${tok('border')};
    border-radius: 999px;
    background: ${tok('surface')};
    font:
      600 11px/18px system-ui,
      sans-serif;
    letter-spacing: 0.02em;
    white-space: nowrap;
    user-select: none;
  }
  .xy-ui-group[data-label-position='top-right'] .xy-ui-group__label {
    left: auto;
    right: 14px;
  }
  .xy-ui-group[data-label-position^='bottom'] .xy-ui-group__label {
    top: auto;
    bottom: 0;
    translate: 0 50%;
  }
  .xy-ui-group[data-label-position='bottom-right'] .xy-ui-group__label {
    left: auto;
    right: 14px;
  }

  /* ---- tooltip and appendix ---------------------------------------------------------------- */
  .xy-ui-tooltip {
    box-sizing: border-box;
    max-width: 240px;
    padding: 6px 10px;
    border: 1px solid ${tok('border')};
    border-radius: 8px;
    background: ${tok('surface')};
    color: ${tok('text')};
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);
    font:
      12px/1.4 system-ui,
      sans-serif;
    animation: xy-ui-fade 120ms ease-out;
  }
  @keyframes xy-ui-fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .xy-ui-tooltip {
      animation: none;
    }
  }
  .xy-ui-appendix {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    padding: 2px 8px;
    border: 1px solid ${tok('border')};
    border-radius: 6px;
    background: ${tok('surface')};
    color: ${tok('muted')};
    font:
      11px/1.5 system-ui,
      sans-serif;
    white-space: nowrap;
  }
  .xy-ui-appendix--bottom {
    top: 100%;
    left: 50%;
    translate: -50% 10px;
  }
  .xy-ui-appendix--top {
    bottom: 100%;
    left: 50%;
    translate: -50% -10px;
  }
  .xy-ui-appendix--left {
    right: 100%;
    top: 50%;
    translate: -10px -50%;
  }
  .xy-ui-appendix--right {
    left: 100%;
    top: 50%;
    translate: 10px -50%;
  }

  /* ---- edges ------------------------------------------------------------------------------- */
  .xy-ui-edge-button {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid ${tok('borderStrong')};
    border-radius: 50%;
    background: ${tok('surface')};
    color: ${tok('muted')};
    cursor: pointer;
    box-shadow: ${tok('shadow')};
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
  }
  .xy-ui-edge-button svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
  }
  .xy-ui-edge-button:hover {
    border-color: ${tok('danger')};
    background: ${tok('danger')};
    color: #fff;
  }
  .xy-ui-edge-button:focus-visible {
    outline: 2px solid ${tok('accent')};
    outline-offset: 2px;
  }
  .lit-flow__edge-label.xy-ui-data-edge {
    display: inline-flex;
    gap: 6px;
    align-items: baseline;
    padding: 2px 9px;
    border: 1px solid ${tok('border')};
    border-radius: 999px;
    background: ${tok('surface')};
    color: ${tok('text')};
    font:
      11px/1.5 system-ui,
      sans-serif;
    box-shadow: ${tok('shadow')};
  }
  .xy-ui-data-edge__key {
    color: ${tok('muted')};
  }
  .xy-ui-data-edge__value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .xy-ui-edge-dot {
    fill: ${tok('accent')};
    pointer-events: none;
    filter: drop-shadow(0 0 3px color-mix(in srgb, ${tok('accent')} 70%, transparent));
  }
`;
