// Screenshots of stories from the built Storybook (needs `scripts/serve.ts` running):
//   tsx scripts/screenshots.ts <outDir> <modes: light,dark> <storyId>...
// Used for visual review; not part of the gate.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { ports } from '../../../config/ports.ts';

const [out, modes, ...ids] = process.argv.slice(2);
if (!out || !modes || ids.length === 0)
  throw new Error('usage: screenshots.ts <outDir> <modes> <ids...>');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: Number(process.env.H ?? 640) },
});
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on(
  'console',
  (m) => m.type() === 'error' && console.log('console.error', m.text().slice(0, 200)),
);
for (const id of ids) {
  for (const mode of modes.split(',')) {
    try {
      await page.goto(
        `http://localhost:${ports.storybook}/iframe.html?id=${id}&viewMode=story&globals=colorMode:${mode}`,
      );
      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'));
      await page.evaluate(async () => {
        for (const f of document.querySelectorAll('xy-flow')) {
          await Promise.race([
            (f as HTMLElement & { whenRendered(): Promise<unknown> }).whenRendered(),
            new Promise((r) => setTimeout(r, 6000)),
          ]);
        }
      });
      await page.waitForTimeout(Number(process.env.SETTLE ?? 700));
      await page.screenshot({ path: `${out}/${id}.${mode}.png` });
      console.log(`${out}/${id}.${mode}.png`);
    } catch (e) {
      console.log(`FAILED ${id}: ${String(e).split('\n')[0]}`);
    }
  }
}
await browser.close();
