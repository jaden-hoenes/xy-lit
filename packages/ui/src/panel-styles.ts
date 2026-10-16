import { css } from 'lit';
import { tok } from './tokens.js';

/**
 * Styles shared by the panel components (`<xy-zoom-slider>`, `<xy-zoom-select>`,
 * `<xy-node-search>`, `<xy-devtools>`), adopted after the flow's own sheets.
 */
export const panelStyles = css`
  .xy-ui-panel {
    box-sizing: border-box;
    border: 1px solid ${tok('border')};
    border-radius: ${tok('radius')};
    background: ${tok('surface')};
    color: ${tok('text')};
    box-shadow: ${tok('shadow')};
    font:
      13px/1.4 system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }
  .xy-ui-btn {
    appearance: none;
    display: inline-grid;
    place-items: center;
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border: 0;
    border-radius: calc(${tok('radius')} - 3px);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background 120ms ease;
  }
  .xy-ui-btn:hover:not(:disabled) {
    background: ${tok('subtle')};
  }
  .xy-ui-btn:focus-visible,
  .xy-ui-input:focus-visible,
  .xy-ui-select:focus-visible,
  input[type='range']:focus-visible {
    outline: 2px solid ${tok('accent')};
    outline-offset: 1px;
  }
  .xy-ui-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .xy-ui-btn svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .xy-ui-mono {
    font-family: ${tok('mono')};
    font-variant-numeric: tabular-nums;
  }
  .xy-ui-muted {
    color: ${tok('muted')};
  }
  @media (prefers-reduced-motion: reduce) {
    .xy-ui-btn {
      transition: none;
    }
  }
`;
