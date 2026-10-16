import { describe, expect, it } from 'vitest';
import baseCss from '../src/styles/generated/base.css.js';
import defaultCss from '../src/styles/generated/default.css.js';
import { adoptInto, baseSheets, defaultSheets } from '../src/styles/sheets.js';

describe('generated styles', () => {
  for (const [name, css] of [
    ['default', defaultCss],
    ['base', baseCss],
  ] as const) {
    it(`${name}.css is renamed to lit-flow and nested rules are flattened`, () => {
      const text = css.cssText;
      expect(text).toContain('.lit-flow__node');
      expect(text).toContain('.lit-flow__handle');
      expect(text).not.toContain('.xy-flow');
      // postcss-nested: no `&` selectors are left
      expect(text).not.toMatch(/&[.:\s-]/);
      // custom properties keep their --xy- names
      expect(text).toContain('--xy-edge-stroke-default');
      // the node resizer styles are part of both bundles
      expect(text).toContain('.lit-flow__resize-control');
    });
  }

  it('default.css has the node theme, base.css does not', () => {
    expect(defaultCss.cssText).toContain('--xy-node-border-default');
    expect(baseCss.cssText).not.toContain('--xy-controls-button-background-color-default:');
  });
});

describe('sheets', () => {
  it('builds shared constructable sheets with the extra additions last', () => {
    expect(defaultSheets).toHaveLength(2);
    expect(baseSheets).toHaveLength(2);
    expect(defaultSheets[1]).toBe(baseSheets[1]);
    const rules = [...defaultSheets[1]!.cssRules].map((r) => r.cssText).join('\n');
    expect(rules).toContain('lit-flow__edge-label');
    expect(rules).toContain('lit-flow__loading');
  });

  it('adoptInto appends without duplicates', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    adoptInto(root, defaultSheets);
    adoptInto(root, defaultSheets);
    adoptInto(root, baseSheets);
    const adopted = [...root.adoptedStyleSheets];
    expect(adopted).toHaveLength(3);
    expect(adopted[0]).toBe(defaultSheets[0]);
    expect(adopted[1]).toBe(defaultSheets[1]);
    expect(adopted[2]).toBe(baseSheets[0]);
  });
});
