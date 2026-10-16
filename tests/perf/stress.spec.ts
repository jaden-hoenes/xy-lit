import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTS, FRAME_EPSILON_MS, fit, windowed } from './budgets';
import type { Budget, Count } from './budgets';

/**
 * Frame-time budgets on the stress pages (spec/13 §Performance). A rAF recorder is injected into
 * the page; each scenario reports the p95 of the time between frames. Results are appended to
 * `results.json` (ignored by git) for trend tracking. Run with one worker (the config does).
 */

const here = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(here, 'results.json');

type Row = {
  variant: 'fit' | 'windowed';
  count: number;
  scenario: string;
  value: number;
  unit: 'ms';
  frames?: number;
  spec: number;
  limit: number;
  meetsSpec: boolean;
};
const rows: Row[] = [];

test.afterAll(() => {
  mkdirSync(here, { recursive: true });
  let previous: Row[] = [];
  try {
    previous = (JSON.parse(readFileSync(RESULTS, 'utf8')) as { rows: Row[] }).rows;
  } catch {
    /* first run */
  }
  const key = (r: Row) => `${r.variant}/${r.count}/${r.scenario}`;
  const merged = new Map(previous.map((r) => [key(r), r]));
  for (const r of rows) merged.set(key(r), r);
  writeFileSync(
    RESULTS,
    JSON.stringify({ date: new Date().toISOString(), rows: [...merged.values()] }, null, 2),
  );
});

/** The slice of the flow element the page code below uses (it runs inside the page). */
interface PageFlow {
  shadowRoot: ShadowRoot | null;
  getViewport(): { x: number; y: number; zoom: number };
  getZoom(): number;
  setViewport(
    v: Partial<{ x: number; y: number; zoom: number }>,
    o?: { duration: number },
  ): Promise<boolean>;
  setCenter(x: number, y: number, o?: { zoom: number }): Promise<boolean>;
  fitView(): Promise<boolean>;
  getNodes(): unknown[];
  getNodesBounds(nodes: unknown[]): { x: number; y: number; width: number; height: number };
}

declare global {
  interface Window {
    __rec: { on: boolean; deltas: number[] };
    /** Set by apps/examples/src/lib/stress.ts. */
    __stress?: { flow: PageFlow; count: number; ready: Promise<number> };
  }
}

async function open(page: Page, path: string): Promise<number> {
  await page.addInitScript(() => {
    window.__rec = { on: false, deltas: [] };
    let last = 0;
    const loop = (t: number) => {
      if (window.__rec.on && last) window.__rec.deltas.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.goto(path);
  await page.waitForFunction(() => !!window.__stress);
  const ms = await page.evaluate(() => window.__stress!.ready);
  await page.waitForTimeout(500);
  return ms;
}

/** p95 of the frame deltas recorded while `run` executes. */
async function frameTime(
  page: Page,
  run: () => Promise<void>,
): Promise<{ p95: number; frames: number }> {
  await page.evaluate(() => {
    window.__rec.deltas = [];
    window.__rec.on = true;
  });
  await run();
  const deltas = await page.evaluate(() => {
    window.__rec.on = false;
    return window.__rec.deltas;
  });
  expect(deltas.length, 'the page produced frames').toBeGreaterThan(10);
  deltas.sort((a, b) => a - b);
  return { p95: deltas[Math.ceil(0.95 * deltas.length) - 1]!, frames: deltas.length };
}

function record(
  variant: Row['variant'],
  count: Count,
  scenario: string,
  value: number,
  budget: Budget,
  frames?: number,
): void {
  rows.push({
    variant,
    count,
    scenario,
    value: Math.round(value * 10) / 10,
    unit: 'ms',
    frames,
    spec: budget.spec,
    limit: budget.limit,
    meetsSpec: value <= budget.spec + FRAME_EPSILON_MS,
  });
  const slack = scenario === 'render' ? 0 : FRAME_EPSILON_MS;
  expect
    .soft(
      value,
      `${variant} ${count} ${scenario}: ${value.toFixed(1)} ms vs limit ${budget.limit} ms (spec ${budget.spec} ms)`,
    )
    .toBeLessThanOrEqual(budget.limit + slack);
}

async function pan(page: Page): Promise<void> {
  await page.evaluate(() => {
    const flow = window.__stress!.flow;
    const v = flow.getViewport();
    return flow.setViewport({ x: v.x - 300, y: v.y + 100 }, { duration: 2000 });
  });
}

/** Zoom in by 3 around the centre of the window (like the zoom controls and the wheel do). */
async function zoom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const flow = window.__stress!.flow;
    const v = flow.getViewport();
    const next = v.zoom * 3;
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    return flow.setViewport(
      { x: cx - ((cx - v.x) * next) / v.zoom, y: cy - ((cy - v.y) * next) / v.zoom, zoom: next },
      { duration: 2000 },
    );
  });
}

/** Drag the node nearest to the middle of the window across the pane, one mouse move per frame. */
async function dragNode(page: Page): Promise<void> {
  const target = await page.evaluate(() => {
    const flow = window.__stress!.flow;
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    let best: { x: number; y: number; d: number } | null = null;
    for (const el of flow.shadowRoot!.querySelectorAll('.lit-flow__node')) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
    return best;
  });
  expect(target, 'a node is on screen').not.toBeNull();
  await page.mouse.move(target!.x, target!.y);
  await page.mouse.down();
  const moved = await frameTime(page, async () => {
    for (let i = 1; i <= 60; i++) {
      await page.mouse.move(target!.x + i * 4, target!.y + i * 2);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
    }
  });
  await page.mouse.up();
  dragResult = moved;
}
let dragResult = { p95: 0, frames: 0 };

for (const count of COUNTS) {
  test(`fit: ${count} nodes (everything rendered)`, async ({ page }) => {
    test.setTimeout(120_000);
    const ms = await open(page, `/stress/${count}`);
    record('fit', count, 'render', ms, fit.render[count]);

    const p = await frameTime(page, () => pan(page));
    record('fit', count, 'pan', p.p95, fit.pan[count], p.frames);

    const z = await frameTime(page, () => zoom(page));
    record('fit', count, 'zoom', z.p95, fit.zoom[count], z.frames);

    await page.evaluate(() => window.__stress!.flow.fitView());
    await page.waitForTimeout(800);
    await dragNode(page);
    record('fit', count, 'drag', dragResult.p95, fit.drag[count], dragResult.frames);
  });
}

for (const count of COUNTS) {
  test(`windowed: ${count} nodes (viewport culling at zoom 1)`, async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, `/stress/${count}?visible=1`);
    // work at a normal zoom in the middle of the grid
    await page.evaluate(() => {
      const flow = window.__stress!.flow;
      const b = flow.getNodesBounds(flow.getNodes());
      return flow.setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1 });
    });
    await page.waitForTimeout(800);
    const rendered = await page.locator('.lit-flow__node').count();
    expect(rendered, 'only the visible nodes are in the DOM').toBeLessThan(300);

    const p = await frameTime(page, () => pan(page));
    record('windowed', count, 'pan', p.p95, windowed.pan[count], p.frames);

    const z = await frameTime(page, () => zoom(page));
    record('windowed', count, 'zoom', z.p95, windowed.zoom[count], z.frames);

    await page.evaluate(() => {
      const flow = window.__stress!.flow;
      const b = flow.getNodesBounds(flow.getNodes());
      return flow.setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1 });
    });
    await page.waitForTimeout(800);
    await dragNode(page);
    record('windowed', count, 'drag', dragResult.p95, windowed.drag[count], dragResult.frames);
  });
}
