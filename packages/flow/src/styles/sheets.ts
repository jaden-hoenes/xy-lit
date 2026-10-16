import type { CSSResult } from 'lit';
import baseCss from './generated/base.css.js';
import defaultCss from './generated/default.css.js';
import extraCss from './extra.css.js';

const supported = typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype;

const sheetCache = new WeakMap<CSSResult, CSSStyleSheet>();

/**
 * Turn a Lit `CSSResult` into a constructable stylesheet, once per result (shared by every flow
 * and plugin on the page).
 *
 * @param result - A `css` / `unsafeCSS` result.
 */
export function sheetOf(result: CSSResult): CSSStyleSheet {
  let sheet = sheetCache.get(result);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(result.cssText);
    sheetCache.set(result, sheet);
  }
  return sheet;
}

/** The upstream `style.css` (init + style + node-resizer) followed by the XY Lit additions. */
export const defaultSheets: CSSStyleSheet[] = supported
  ? [sheetOf(defaultCss), sheetOf(extraCss)]
  : [];

/** The upstream `base.css` (unstyled variant) followed by the XY Lit additions. */
export const baseSheets: CSSStyleSheet[] = supported ? [sheetOf(baseCss), sheetOf(extraCss)] : [];

/**
 * Append stylesheets to a root's `adoptedStyleSheets`, skipping the ones already there.
 *
 * @param root - A document or shadow root.
 * @param sheets - Sheets to add.
 */
export function adoptInto(root: Document | ShadowRoot, sheets: readonly CSSStyleSheet[]): void {
  const current = root.adoptedStyleSheets;
  const missing = sheets.filter((s) => !current.includes(s));
  if (missing.length) root.adoptedStyleSheets = [...current, ...missing];
}
