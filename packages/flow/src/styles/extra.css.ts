import { css } from 'lit';

/**
 * XY Lit additions to the upstream stylesheets (spec/10 §extra.css): host rules, edge labels,
 * toolbars, a11y helpers, loading overlay, remote presence highlights, motion.
 *
 * `:host` rules apply in the default shadow render root; the `xy-flow` element selector rules
 * apply when the flow renders into the light DOM (`render-root="light"`).
 */
export default css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    contain: layout paint;
    min-height: 0;
  }
  :host([hidden]) {
    display: none;
  }
  xy-flow {
    display: block;
    position: relative;
    overflow: hidden;
    contain: layout paint;
    min-height: 0;
  }
  xy-flow[hidden] {
    display: none;
  }
  /* edge elements only host an <svg>; they must not create boxes of their own */
  xy-edge {
    display: contents;
  }

  .lit-flow__container {
    user-select: none;
  }
  /* the wrapper fills the host and isolates the flow's stacking contexts */
  .lit-flow.lit-flow__container {
    overflow: hidden;
    z-index: 0;
  }
  .lit-flow__edge-label {
    position: absolute;
    text-align: center;
    padding: 2px;
    font-size: 10px;
    color: var(--xy-edge-label-color, var(--xy-edge-label-color-default));
    background: var(
      --xy-edge-label-background-color,
      var(--xy-edge-label-background-color-default)
    );
  }
  .lit-flow__edge-label.transparent {
    background: transparent;
    padding: 0;
  }
  .lit-flow__selection {
    position: absolute;
    top: 0;
    left: 0;
  }
  .lit-flow__node-toolbars {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }
  .lit-flow__node-toolbar {
    pointer-events: all;
  }
  /* the upstream link colour (#999) fails WCAG AA contrast */
  .lit-flow__attribution a {
    color: var(--xy-attribution-color, #5f5f5f);
  }
  .lit-flow.dark .lit-flow__attribution a {
    color: var(--xy-attribution-color, #b4b4b4);
  }
  .lit-flow__edge-toolbar {
    width: max-content;
  }
  .lit-flow__a11y-hidden {
    display: none;
  }
  .lit-flow__a11y-live {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(100%);
  }
  .lit-flow__loading {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background: var(
      --xy-loading-background,
      var(--xy-background-color, var(--xy-background-color-default))
    );
  }
  .lit-flow__loading[data-slotted] .lit-flow__spinner {
    display: none;
  }
  .lit-flow__loading[hidden] {
    display: none;
  }
  .lit-flow__spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--xy-loading-track, rgba(0, 0, 0, 0.12));
    border-top-color: var(--xy-loading-color, #555);
    animation: lit-flow-spin 0.8s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .lit-flow__spinner {
      animation-duration: 2.4s;
    }
  }
  @keyframes lit-flow-spin {
    to {
      rotate: 360deg;
    }
  }
  .lit-flow__node.remote-selected {
    outline: 2px solid var(--xy-remote-color);
    outline-offset: 2px;
  }
  .lit-flow__node.remote-added {
    box-shadow: 0 0 0 2px var(--xy-remote-color);
    transition: box-shadow 1.2s ease-out;
  }
  .lit-flow__node.remote-added.settled {
    box-shadow: 0 0 0 0 transparent;
  }
  .lit-flow__node.remote-dragging {
    transition: transform 80ms linear;
  }
  .lit-flow__node:not(:hover) > xy-node-resizer[variant='hover-corner'] .lit-flow__resize-control {
    opacity: 0;
  }
  xy-node-resizer[variant='hover-corner'] .lit-flow__resize-control {
    transition: opacity 120ms;
  }

  /* motion (spec/10 §Motion) */
  .lit-flow__node.entering {
    animation: lit-flow-enter var(--xy-enter-duration, 260ms)
      var(--xy-enter-easing, cubic-bezier(0.2, 0.8, 0.2, 1)) both;
    animation-delay: calc(var(--xy-enter-index, 0) * var(--xy-enter-stagger, 18ms));
  }
  @keyframes lit-flow-enter {
    from {
      opacity: 0;
      scale: 0.96;
      translate: 0 6px;
    }
    to {
      opacity: 1;
      scale: 1;
      translate: 0 0;
    }
  }
  .lit-flow__edge.entering .lit-flow__edge-path {
    animation: lit-flow-draw var(--xy-enter-duration, 260ms) ease-out both;
    animation-delay: calc(var(--xy-enter-index, 0) * var(--xy-enter-stagger, 18ms) + 120ms);
  }
  @keyframes lit-flow-draw {
    to {
      stroke-dashoffset: 0;
    }
  }
`;
