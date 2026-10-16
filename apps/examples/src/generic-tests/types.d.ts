/**
 * Shape of a generic-test fixture (`src/generic-tests/<topic>/<example>.ts`, default export).
 * `mountFixture` (`src/fixture.ts`) turns it into a `<xy-flow>` page, see spec/13 §Fixture pages.
 */
declare type FlowConfig = {
  /** Properties of `<xy-flow>` (Svelte Flow prop names; `initialViewport` maps to `defaultViewport`). */
  flowProps?: Record<string, unknown>;
  /** Properties of an `<xy-panel>` child. */
  panelProps?: Record<string, unknown>;
  /** Properties of an `<xy-minimap>` child. */
  minimapProps?: Record<string, unknown>;
  /** Properties of an `<xy-controls>` child. */
  controlsProps?: Record<string, unknown>;
  /** Properties of an `<xy-background>` child. */
  backgroundProps?: Record<string, unknown>;
};
