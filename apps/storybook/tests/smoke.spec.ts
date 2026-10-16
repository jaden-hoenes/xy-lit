// Smoke test over the built Storybook: every story id from dist/index.json renders with no console
// error or page error, and every <xy-flow> in it reaches `render-complete`.
// `A11Y=1` additionally runs axe-core (the engine of @storybook/addon-a11y) and prints violations
// without failing the test (informal check).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

interface IndexEntry {
  id: string;
  type: 'story' | 'docs';
  title: string;
  name: string;
}
const index = JSON.parse(readFileSync(new URL('../dist/index.json', import.meta.url), 'utf8')) as {
  entries: Record<string, IndexEntry>;
};
const stories = Object.values(index.entries).filter((e) => e.type === 'story');
const docs = Object.values(index.entries).filter((e) => e.type === 'docs');

const axeSource = process.env.A11Y
  ? readFileSync(
      createRequire(
        createRequire(import.meta.url).resolve('@storybook/addon-a11y/package.json'),
      ).resolve('axe-core/axe.min.js'),
      'utf8',
    )
  : '';

test('index.json lists the required stories', () => {
  const titles = new Set(stories.map((s) => s.title));
  for (const title of [
    'Flow/Basics',
    'Flow/Interaction',
    'Flow/Sub-flows',
    'Flow/Edges',
    'Flow/Nodes',
    'Flow/Lifecycle',
    'Plugins',
    'Collaboration',
    'Pro',
  ]) {
    expect(titles, `missing ${title}`).toContain(title);
  }
  expect([...titles].filter((t) => t.startsWith('UI/')).length).toBeGreaterThan(5);
});

for (const story of stories) {
  test(`${story.title} / ${story.name}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    // `sb-show-main` is set once the story rendered, `sb-show-errordisplay` when it threw
    await page.waitForFunction(
      () =>
        document.body.classList.contains('sb-show-main') ||
        document.body.classList.contains('sb-show-errordisplay'),
    );
    const errorText = await page.evaluate(() =>
      document.body.classList.contains('sb-show-errordisplay')
        ? (document.querySelector('#error-message')?.textContent ?? 'error display')
        : null,
    );
    expect(errorText, 'story threw while rendering').toBeNull();

    const rendered = await page.evaluate(async () => {
      const flows = [...document.querySelectorAll('xy-flow')] as (HTMLElement & {
        whenRendered(): Promise<unknown>;
      })[];
      const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 8000));
      const results: string[] = [];
      for (const [i, flow] of flows.entries()) {
        const out = await Promise.race([flow.whenRendered(), timeout]);
        if (out === 'timeout') results.push(`flow #${i} did not reach render-complete`);
      }
      return { count: flows.length, results };
    });
    expect(rendered.results).toEqual([]);

    if (process.env.A11Y) {
      await page.evaluate(axeSource);
      type Axe = {
        run(
          ctx: string,
          o: object,
        ): Promise<{
          violations: { id: string; impact: string; nodes: { target: string[] }[] }[];
        }>;
      };
      // axe refuses to run twice at once (the a11y addon may run it too): retry a few times
      let violations: string[] | null = null;
      for (let attempt = 0; attempt < 5 && violations === null; attempt++) {
        violations = await page.evaluate(async () => {
          try {
            const result = await (window as unknown as { axe: Axe }).axe.run('#storybook-root', {
              resultTypes: ['violations'],
            });
            return result.violations.map(
              (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`,
            );
          } catch {
            return null;
          }
        });
        if (violations === null) await page.waitForTimeout(500);
      }
      if (violations?.length) console.log(`A11Y ${story.id}\n  ${violations.join('\n  ')}`);
    }

    expect(problems).toEqual([]);
  });
}

// the autodocs pages (attribute tables from the manifest, every story inline)
for (const page of docs) {
  test(`${page.title} / ${page.name} (docs page)`, async ({ page: tab }) => {
    const problems: string[] = [];
    tab.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    tab.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    await tab.goto(`/iframe.html?id=${page.id}&viewMode=docs`);
    await tab.waitForSelector('.sbdocs-content', { timeout: 20_000 });
    await expect(tab.locator('.sbdocs-content h1').first()).toBeVisible();
    const rendered = await tab.evaluate(async () => {
      const flows = [...document.querySelectorAll('xy-flow')] as (HTMLElement & {
        whenRendered(): Promise<unknown>;
      })[];
      const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 10_000));
      const late: number[] = [];
      for (const [i, flow] of flows.entries()) {
        if ((await Promise.race([flow.whenRendered(), timeout])) === 'timeout') late.push(i);
      }
      return late;
    });
    expect(rendered, 'flows that did not reach render-complete').toEqual([]);
    expect(problems).toEqual([]);
  });
}
