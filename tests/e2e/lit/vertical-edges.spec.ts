import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const types = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'];

test.describe('vertical edges (top/bottom handles)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-vertical-edges');
    await ready(page);
  });

  for (const type of types) {
    test(`${type}: leaves the source downwards and enters the target downwards`, async ({
      page,
    }) => {
      const points = await page.evaluate((edgeType) => {
        const root = (window.flow as unknown as HTMLElement).shadowRoot!;
        const path = root.querySelector<SVGPathElement>(
          `g[data-id="e-${edgeType}"] .lit-flow__edge-path`,
        )!;
        const length = path.getTotalLength();
        const at = (l: number) => {
          const p = path.getPointAtLength(l);
          return { x: p.x, y: p.y };
        };
        return {
          start: at(0),
          afterStart: at(6),
          beforeEnd: at(length - 6),
          end: at(length),
        };
      }, type);
      // the source handle is on the bottom of its node and the target handle on top of its node
      expect(points.afterStart.y).toBeGreaterThan(points.start.y);
      expect(points.end.y).toBeGreaterThan(points.beforeEnd.y);
      // and the edge really goes from the upper node to the lower one
      expect(points.end.y).toBeGreaterThan(points.start.y + 100);
    });
  }

  test('the path starts at the bottom of the source and ends at the top of the target', async ({
    page,
  }) => {
    const geometry = await page.evaluate(() => {
      const flow = window.flow as unknown as {
        shadowRoot: ShadowRoot;
        getInternalNode(id: string): {
          internals: { positionAbsolute: { x: number; y: number } };
          measured: { width: number; height: number };
        };
      };
      const path = flow.shadowRoot.querySelector<SVGPathElement>(
        'g[data-id="e-straight"] .lit-flow__edge-path',
      )!;
      const s = flow.getInternalNode('s-straight');
      const t = flow.getInternalNode('t-straight');
      const at = (l: number) => {
        const p = path.getPointAtLength(l);
        return { x: p.x, y: p.y };
      };
      return {
        start: at(0),
        end: at(path.getTotalLength()),
        sourceBottom: s.internals.positionAbsolute.y + s.measured.height,
        targetTop: t.internals.positionAbsolute.y,
      };
    });
    // the edge ends on the outer side of the 8px handle that straddles the node border
    expect(Math.abs(geometry.start.y - geometry.sourceBottom)).toBeLessThanOrEqual(4);
    expect(Math.abs(geometry.end.y - geometry.targetTop)).toBeLessThanOrEqual(4);
  });
});
