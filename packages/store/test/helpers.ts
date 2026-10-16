import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PanZoomInstance } from '../src/engine.js';
import type { FlowHost } from '../src/flow-store.js';
import { FlowStore } from '../src/flow-store.js';
import type { Edge } from '../src/types/edges.js';
import type { FlowEventMap } from '../src/types/events.js';
import type { Node } from '../src/types/nodes.js';
import type { FlowOptions } from '../src/types/options.js';

/** A node with a size, so it counts as measured. */
export const node = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: {},
  width: 100,
  height: 50,
  measured: { width: 100, height: 50 },
  ...extra,
});

/** A node without any dimensions (needs measuring). */
export const bareNode = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: {},
  ...extra,
});

export const edge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<Edge> = {},
): Edge => ({
  id,
  source,
  target,
  ...extra,
});

export type RecordedEvent = {
  type: keyof FlowEventMap;
  detail: unknown;
  cancelable: boolean;
};

/** A host that records events and lets tests prevent chosen cancelable events. */
export function createHost() {
  const events: RecordedEvent[] = [];
  const prevent = new Set<string>();
  const host: FlowHost = {
    emit(type, detail, cancelable = false) {
      events.push({ type, detail, cancelable });
      return !(cancelable && prevent.has(type));
    },
  };
  return {
    host,
    events,
    prevent,
    of: <K extends keyof FlowEventMap>(type: K) =>
      events.filter((e) => e.type === type).map((e) => e.detail as FlowEventMap[K]),
    clear: () => {
      events.length = 0;
    },
  };
}

/** A pan/zoom engine double that records the viewports it was asked to set. */
export function createFakePanZoom(): {
  panZoom: PanZoomInstance;
  fn: Record<keyof PanZoomInstance, Mock>;
  viewports: { x: number; y: number; zoom: number }[];
} {
  const viewports: { x: number; y: number; zoom: number }[] = [];
  const panZoom = {
    update: vi.fn(),
    destroy: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setViewport: vi.fn((v: { x: number; y: number; zoom: number }) => {
      viewports.push(v);
      return Promise.resolve(undefined);
    }),
    setViewportConstrained: vi.fn(() => Promise.resolve(undefined)),
    setScaleExtent: vi.fn(),
    setTranslateExtent: vi.fn(),
    scaleTo: vi.fn(() => Promise.resolve(true)),
    scaleBy: vi.fn(() => Promise.resolve(true)),
    syncViewport: vi.fn(),
    setClickDistance: vi.fn(),
  };
  return {
    panZoom: panZoom as unknown as PanZoomInstance,
    fn: panZoom as unknown as Record<keyof PanZoomInstance, Mock>,
    viewports,
  };
}

/** A store with a recording host. */
export function createStore(options: Partial<FlowOptions> = {}) {
  const store = new FlowStore(options);
  const h = createHost();
  store.setHost(h.host);
  return { store, ...h };
}

/** Let microtasks (notifications, batched setNodes) run. */
export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
