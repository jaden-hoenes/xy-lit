import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';

/** What `/collab/:room` puts on `window.collab` (apps/examples/src/pages/collab.[room].ts). */
type CollabHook = {
  session: {
    setOffline(offline: boolean): void;
    isOffline(): boolean;
    ready: Promise<void>;
    destroy(): void;
  };
  source: {
    toObject(): {
      nodes: { id: string; position: { x: number; y: number }; data: Record<string, unknown> }[];
      edges: { id: string; source: string; target: string }[];
    };
  };
  flow: {
    getNode(
      id: string,
    ): { position: { x: number; y: number }; selected?: boolean; remote?: unknown } | undefined;
    whenRendered(): Promise<unknown>;
  };
};
type W = { collab: CollabHook };

export type Peer = { context: BrowserContext; page: Page; name: string };

export const uniqueRoom = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Open `/collab/:room` in a fresh browser context (a separate person with a separate IndexedDB). */
export async function openPeer(
  browser: Browser,
  info: TestInfo,
  room: string,
  name: string,
  query = '',
): Promise<Peer> {
  const baseURL = info.project.use.baseURL as string;
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`/collab/${room}?name=${name}${query}`);
  await page.waitForFunction(() => (window as unknown as Partial<W>).collab);
  await page.evaluate(() => (window as unknown as W).collab.session.ready);
  await page.evaluate(() => (window as unknown as W).collab.flow.whenRendered());
  return { context, page, name };
}

/** Wait until the peer shows the seed graph and has finished fitting it. */
export async function seeded(peer: Peer): Promise<void> {
  await expect
    .poll(() => peer.page.locator('.lit-flow__node').count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(6);
  await expect(peer.page.getByTestId('status')).toContainText('Live', { timeout: 15_000 });
}

/** The committed document content (no overlay, no remote live positions). */
export const docOf = (page: Page) =>
  page.evaluate(() => {
    const { nodes, edges } = (window as unknown as W).collab.source.toObject();
    const sort = <T extends { id: string }>(xs: T[]): T[] =>
      [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
    return JSON.stringify({ nodes: sort(nodes), edges: sort(edges) });
  });

/** A node as the flow shows it (committed position, or the live one during a remote drag). */
export const viewNode = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const n = (window as unknown as W).collab.flow.getNode(nodeId);
    return n
      ? { position: n.position, remote: n.remote as { draggingBy?: { name: string } } | undefined }
      : null;
  }, id);

/** The committed position of a node. */
export const docPosition = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    return (
      (window as unknown as W).collab.source.toObject().nodes.find((n) => n.id === nodeId)
        ?.position ?? null
    );
  }, id);

export const nodeBox = async (page: Page, id: string) => {
  const box = await page.locator(`.lit-flow__node[data-id="${id}"]`).boundingBox();
  if (!box) throw new Error(`node ${id} has no box`);
  return box;
};

/** Both documents hold the same nodes and edges. */
export async function expectConverged(a: Peer, b: Peer, timeout = 15_000): Promise<void> {
  await expect
    .poll(async () => (await docOf(a.page)) === (await docOf(b.page)), { timeout })
    .toBe(true);
}

/** Disconnect or reconnect a peer's provider (edits keep being saved in IndexedDB). */
export async function setOffline(peer: Peer, offline: boolean): Promise<void> {
  await peer.page.evaluate((v) => (window as unknown as W).collab.session.setOffline(v), offline);
  await expect(peer.page.getByTestId('status')).toContainText(offline ? 'Offline' : 'Live', {
    timeout: 20_000,
  });
}

export const close = async (...peers: Peer[]): Promise<void> => {
  // tear each session down while its page is alive: closing the context under a connected peer makes
  // Firefox close IndexedDB before the last updates arrive (y-indexeddb: "closed database")
  for (const p of peers) {
    await p.page
      .evaluate(() => (window as unknown as Partial<W>).collab?.session.destroy())
      .catch(() => undefined);
    await p.context.close();
  }
};

/**
 * Add a node with a toolbar button, wait until its title field has focus (a new node is hidden
 * until it is measured), type the title and confirm it.
 */
export async function addNodeWithTitle(
  page: Page,
  kind: 'idea' | 'note',
  title: string,
): Promise<void> {
  await page.getByTestId(kind === 'idea' ? 'add-idea' : 'add-note').click();
  await expect(page.locator('xy-node input:focus')).toHaveCount(1);
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
}
