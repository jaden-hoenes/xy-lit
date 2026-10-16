import { unsafeCSS } from 'lit';

/**
 * Design tokens of `@xy-lit/ui`. Every colour derives from the upstream flow tokens
 * (`--xy-node-background-color`, `--xy-node-color`, ...), which already switch with the flow's
 * `color-mode`, so the components follow light and dark without selectors of their own. Each
 * `--xy-ui-*` custom property is an optional override.
 *
 * Exported as strings so they can be interpolated into `css` templates through {@link tok}.
 */
export const tokens = {
  /** Card surface. */
  surface:
    'var(--xy-ui-surface, var(--xy-node-background-color, var(--xy-node-background-color-default, #fff)))',
  /** Primary text. */
  text: 'var(--xy-ui-text, var(--xy-node-color, var(--xy-node-color-default, inherit)))',
  /** Hairline borders. */
  border: 'var(--xy-ui-border, color-mix(in srgb, currentColor 16%, transparent))',
  /** Stronger border (inputs, handles). */
  borderStrong: 'var(--xy-ui-border-strong, color-mix(in srgb, currentColor 34%, transparent))',
  /** Secondary text. */
  muted: 'var(--xy-ui-muted, color-mix(in srgb, currentColor 72%, transparent))',
  /** Subtle fill for headers, chips and hovered rows. */
  subtle: 'var(--xy-ui-subtle, color-mix(in srgb, currentColor 6%, transparent))',
  /** Brand accent: selection ring, focus, loading. */
  accent: 'var(--xy-ui-accent, #6366f1)',
  /** Success status colour. */
  success: 'var(--xy-ui-success, #22c55e)',
  /** Error status colour. */
  danger: 'var(--xy-ui-danger, #ef4444)',
  /** Card corner radius. */
  radius: 'var(--xy-ui-radius, 10px)',
  /** Card shadow. */
  shadow:
    'var(--xy-ui-shadow, 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.07))',
  /** Monospace font stack. */
  mono: "var(--xy-ui-font-mono, ui-monospace, 'JetBrains Mono Variable', 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace)",
} as const;

/**
 * A token as CSS for interpolation in a `css` template: `` css`color: ${tok('accent')}` ``.
 *
 * @param name - A key of {@link tokens}.
 */
export const tok = (name: keyof typeof tokens): ReturnType<typeof unsafeCSS> =>
  unsafeCSS(tokens[name]);
