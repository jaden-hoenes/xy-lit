// Every page of the built site: no console errors or page errors, every demo reaches
// `render-complete`, and every internal link (and anchor) resolves.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const dist = join(import.meta.dirname, '../.vitepress/dist');

function pages(dir = dist): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'assets' || name === 'hashmap.json') continue;
      out.push(...pages(path));
    } else if (name.endsWith('.html') && name !== '404.html') {
      const rel = relative(dist, path).replace(/\\/g, '/');
      out.push(rel === 'index.html' ? '/' : '/' + rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, ''));
    }
  }
  return out.sort();
}

if (!existsSync(dist)) throw new Error('build the site first: pnpm --filter @xy-lit/docs build');
const urls = pages();
const known = new Set(urls.map((u) => (u.length > 1 ? u.replace(/\/$/, '') : u)));
test.describe.configure({ mode: 'parallel' });

for (const url of urls) {
  test(`page ${url}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      // the live demos load only local code; an external request failing would be a real problem
      if (r.url().startsWith('http://localhost:')) errors.push(`request failed: ${r.url()}`);
    });
    const response = await page.goto(url, { waitUntil: 'load' });
    expect(response?.status(), url).toBeLessThan(400);

    await waitForDemos(page);
    const demos = await page.locator('[data-demo]').count();
    if (url.startsWith('/guide/')) expect(demos, `${url} has no live demo`).toBeGreaterThan(0);

    const failed = await page.locator('[data-demo][data-state="error"]').count();
    expect(failed, `${url}: a demo failed to load`).toBe(0);

    expect(errors, url).toEqual([]);
  });
}

test('internal links and anchors resolve', async ({ page }) => {
  // visit every page again (cheap: no demos needed) to be independent of worker scheduling
  const collected: { from: string; href: string }[] = [];
  const pageIds = new Map<string, Set<string>>();
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const found = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
      hrefs: [...document.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    }));
    pageIds.set(url, new Set(found.ids));
    for (const href of found.hrefs) collected.push({ from: url, href });
  }
  const broken: string[] = [];
  for (const { from, href } of collected) {
    if (!href || /^(https?:|mailto:|tel:|javascript:)/.test(href)) continue;
    const target = new URL(href, new URL(from, 'http://x'));
    const path = target.pathname.length > 1 ? target.pathname.replace(/\/$/, '').replace(/\.html$/, '') : target.pathname;
    if (/\.(svg|png|ico|json|xml|txt|css|js)$/.test(path)) {
      const res = await page.request.get(target.pathname);
      if (!res.ok()) broken.push(`${from}: asset ${href} -> ${res.status()}`);
      continue;
    }
    if (!known.has(path)) {
      broken.push(`${from}: ${href} is not a page`);
      continue;
    }
    if (target.hash.length > 1) {
      const id = decodeURIComponent(target.hash.slice(1));
      if (!pageIds.get(path)?.has(id) && !pageIds.get(path + '/')?.has(id))
        broken.push(`${from}: ${href} has no anchor #${id}`);
    }
  }
  expect(broken, 'broken internal links').toEqual([]);
});

async function waitForDemos(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const demos = [...document.querySelectorAll('[data-demo]')];
      return demos.every((d) => d.getAttribute('data-render-complete') === 'true' || d.getAttribute('data-state') === 'error');
    },
    undefined,
    { timeout: 60_000 },
  );
}
