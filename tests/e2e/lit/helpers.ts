import type { Locator, Page } from '@playwright/test';

/** The slice of the flow element the specs read inside the page. */
export type PageFlow = {
  whenRendered(): Promise<unknown>;
  getNode(id: string): PageNode | undefined;
  getNodes(): PageNode[];
  getEdge(id: string): PageEdge | undefined;
  getEdges(): PageEdge[];
  getZoom(): number;
  getInternalNode(
    id: string,
  ): { internals: { positionAbsolute: { x: number; y: number } } } | undefined;
  shadowRoot: ShadowRoot;
  [key: string]: unknown;
};
export type PageNode = {
  id: string;
  position: { x: number; y: number };
  selected?: boolean;
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
};
export type PageEdge = { id: string; source: string; target: string; selected?: boolean };

/**
 * Run `fn` inside the page with the flow element (`window[ref]`) as argument. `fn` is serialised, so
 * it must not use variables from the test file.
 */
export function inFlow<T>(
  page: Page,
  fn: (flow: PageFlow) => T | Promise<T>,
  ref = 'flow',
): Promise<T> {
  return page.evaluate(
    ([source, name]) => {
      const flow = (window as unknown as Record<string, unknown>)[name as string];
      return new Function('flow', `return (${source as string})(flow)`)(flow) as T;
    },
    [fn.toString(), ref],
  ) as Promise<T>;
}

/** Wait until the page's flow exists and has rendered (never a fixed sleep). */
export async function ready(page: Page, ref = 'flow'): Promise<void> {
  await page.waitForFunction((name) => !!(window as unknown as Record<string, unknown>)[name], ref);
  await inFlow(page, (flow) => flow.whenRendered(), ref);
}

/** Centre of a locator's bounding box. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drag with the mouse from one point to another in `steps` moves. */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** Position of a node in flow coordinates. */
export function nodePosition(
  page: Page,
  id: string,
  ref = 'flow',
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([name, nodeId]) => {
      const flow = (window as unknown as Record<string, PageFlow>)[name as string]!;
      return flow.getNode(nodeId as string)!.position;
    },
    [ref, id],
  );
}
