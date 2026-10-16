import { createId, keyboardTracker } from '@xy-lit/store';
import type { Edge, EdgeChange, FlowStore, Node, NodeChange, XYPosition } from '@xy-lit/store';
import type { XyFlowElement } from '@xy-lit/flow';
import { storeOf, withStore } from '../common.js';
import type { Disposer, FlowLike } from '../common.js';

/** MIME type written next to `text/plain`. */
export const CLIPBOARD_MIME = 'application/x-xy-lit+json';

/** What copy and cut serialise. */
export interface ClipboardPayload {
  /** Format marker and version, so foreign clipboard text is never pasted as nodes. */
  'xy-lit': 1;
  /** The copied nodes (with their descendants). */
  nodes: Node[];
  /** The copied edges whose both ends are in the copy. */
  edges: Edge[];
}

/** Options of {@link installClipboard} and {@link pasteElements}. */
export interface ClipboardOptions {
  /** New id for a pasted element. Default: `${old}-${random 6 chars}`. Must not collide. */
  getId?: (old: string) => string;
  /** Flow units a repeated paste (or a duplicate) moves away from the original. Default 20. */
  pasteOffset?: number;
  /** Handle Mod+C / X / V / D while the flow is active. Default true. */
  keys?: boolean;
}

/** The handle `installClipboard` returns: call it to uninstall, or use the commands. */
export type InstalledClipboard = Disposer & {
  /** Copy the selection. Returns false when nothing is selected. */
  copy(): boolean;
  /** Copy the selection and delete it. Returns false when nothing is selected. */
  cut(): Promise<boolean>;
  /** Paste the clipboard content (or `payload`). Returns the ids of the new nodes. */
  paste(payload?: ClipboardPayload): string[];
  /** Copy and paste the selection, offset by `pasteOffset`, without touching the clipboard. */
  duplicate(): string[];
};

const LOCAL_FIELDS = ['selected', 'dragging', 'resizing', 'measured', 'remote'] as const;

/** Last serialised copy of the page: used when the system clipboard is unavailable. */
let memory: string | null = null;

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);

/** Whether the event came from a text field (copy/paste there must stay native). */
function isInputDOMNode(e: Event): boolean {
  const target = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
  if (!target || typeof target.tagName !== 'string') return false;
  return (
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
    target.hasAttribute?.('contenteditable') === true ||
    target.isContentEditable === true
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Serialise the selected nodes, the descendants of selected group nodes, and the edges between
 * them. Local fields are stripped. A copied node whose parent is not part of the copy becomes a
 * root (its position is converted to an absolute one).
 *
 * @returns The payload, or null when no node is selected.
 */
export function serializeSelection(flow: FlowLike): ClipboardPayload | null {
  const store = storeOf(flow);
  const { nodes, edges, nodeLookup, parentLookup, nodeOrigin } = store.getState();
  const ids = new Set<string>();
  const add = (id: string): void => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const child of parentLookup.get(id)?.keys() ?? []) add(child);
  };
  for (const node of nodes) if (node.selected) add(node.id);
  if (!ids.size) return null;

  const outNodes: Node[] = [];
  for (const node of nodes) {
    if (!ids.has(node.id)) continue;
    const item = clone(node) as Node & Record<string, unknown>;
    for (const key of LOCAL_FIELDS) delete item[key];
    if (node.parentId && !ids.has(node.parentId)) {
      const internal = nodeLookup.get(node.id);
      const origin = node.origin ?? nodeOrigin;
      const w = internal?.measured.width ?? node.width ?? 0;
      const h = internal?.measured.height ?? node.height ?? 0;
      const abs = internal?.internals.positionAbsolute ?? node.position;
      item.position = { x: abs.x + origin[0] * w, y: abs.y + origin[1] * h };
      delete item.parentId;
      delete item.expandParent;
      if (item.extent === 'parent') delete item.extent;
    }
    outNodes.push(item);
  }
  const outEdges = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => {
      const item = clone(e) as Edge & Record<string, unknown>;
      for (const key of LOCAL_FIELDS) delete item[key];
      return item;
    });
  return { 'xy-lit': 1, nodes: outNodes, edges: outEdges };
}

/** Parse clipboard text. Returns null for anything that is not an XY Lit payload. */
export function parseClipboard(text: string | null | undefined): ClipboardPayload | null {
  if (!text || !text.includes('"xy-lit"')) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Partial<ClipboardPayload>;
  if (p['xy-lit'] !== 1 || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
  const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n);
  for (const n of p.nodes) {
    if (typeof n !== 'object' || n === null) return null;
    const node = n as Partial<Node>;
    if (typeof node.id !== 'string' || !finite(node.position?.x) || !finite(node.position?.y)) {
      return null;
    }
  }
  for (const e of p.edges) {
    if (typeof e !== 'object' || e === null) return null;
    const edge = e as Partial<Edge>;
    if (
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      return null;
    }
  }
  return p as ClipboardPayload;
}

/** Options of {@link pasteElements}. */
export interface PasteOptions {
  /** New id for a pasted element. */
  getId?: (old: string) => string;
  /** Put the top-left corner of the pasted set here (flow coordinates). */
  at?: XYPosition;
  /** Else move the pasted set by this much. Default `{ x: 20, y: 20 }`. */
  offset?: XYPosition;
}

/**
 * Add the payload's nodes and edges to the flow with new ids. The previous selection is replaced
 * by the pasted elements. One change batch per kind with a shared `gestureId` and
 * `origin: 'paste'`, so history records one step.
 *
 * @returns The ids of the new nodes (in payload order).
 */
export function pasteElements(
  flow: FlowLike,
  payload: ClipboardPayload,
  options: PasteOptions = {},
): string[] {
  const store = storeOf(flow);
  const state = store.getState();
  const taken = new Set<string>([...state.nodes.map((n) => n.id), ...state.edges.map((e) => e.id)]);
  const fresh = (old: string): string => {
    const make = options.getId ?? ((id: string) => `${id}-${crypto.randomUUID().slice(0, 6)}`);
    let id = make(old);
    while (taken.has(id)) id = `${make(old)}-${crypto.randomUUID().slice(0, 3)}`;
    taken.add(id);
    return id;
  };

  const inSet = new Set(payload.nodes.map((n) => n.id));
  const roots = payload.nodes.filter((n) => !n.parentId || !inSet.has(n.parentId));
  let delta: XYPosition = options.offset ?? { x: 20, y: 20 };
  if (options.at && roots.length) {
    const minX = Math.min(...roots.map((n) => n.position.x));
    const minY = Math.min(...roots.map((n) => n.position.y));
    delta = { x: options.at.x - minX, y: options.at.y - minY };
  }

  const idMap = new Map<string, string>();
  for (const n of payload.nodes) idMap.set(n.id, fresh(n.id));

  const nodeChanges: NodeChange[] = state.nodes
    .filter((n) => n.selected)
    .map((n) => ({ id: n.id, type: 'select', selected: false }));
  const nodeIds: string[] = [];
  for (const n of payload.nodes) {
    const isRoot = !n.parentId || !inSet.has(n.parentId);
    const item = clone(n) as Node & Record<string, unknown>;
    for (const key of LOCAL_FIELDS) delete item[key];
    item.id = idMap.get(n.id)!;
    if (isRoot) {
      item.position = { x: n.position.x + delta.x, y: n.position.y + delta.y };
      delete item.parentId;
    } else {
      item.parentId = idMap.get(n.parentId!);
    }
    item.selected = true;
    nodeIds.push(item.id);
    nodeChanges.push({ type: 'add', item });
  }

  const edgeChanges: EdgeChange[] = state.edges
    .filter((e) => e.selected)
    .map((e) => ({ id: e.id, type: 'select', selected: false }));
  for (const e of payload.edges) {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) continue;
    const item = clone(e) as Edge & Record<string, unknown>;
    for (const key of LOCAL_FIELDS) delete item[key];
    item.id = fresh(e.id);
    item.source = source;
    item.target = target;
    item.selected = true;
    edgeChanges.push({ type: 'add', item });
  }

  const meta = { phase: 'discrete', origin: 'paste', gestureId: createId() } as const;
  // nodes first: history saves the selection from the first batch it records
  const run = (): void => {
    store.triggerNodeChanges(nodeChanges, meta);
    store.triggerEdgeChanges(edgeChanges, meta);
  };
  // one atomic unit for sources that have transactions (one Yjs undo step)
  if (store.source.transact) store.source.transact(run, 'paste');
  else run();
  return nodeIds;
}

/** Whether a flow-space point is inside the visible viewport. */
function insideViewport(store: FlowStore, p: XYPosition): boolean {
  const { transform, width, height } = store.getState();
  const x = p.x * transform[2] + transform[0];
  const y = p.y * transform[2] + transform[1];
  return x >= 0 && y >= 0 && x <= width && y <= height;
}

/**
 * Copy, cut, paste and duplicate for a flow.
 *
 * - `copy` / `cut` / `paste` events on the flow host (they reach it when focus is inside the
 *   flow) read and write `text/plain` and `application/x-xy-lit+json`.
 * - With `keys` (default), Mod+C / X / V / D also work while the flow is the active one and
 *   focus is not in an input, even when focus is not inside the flow. Copy writes with
 *   `navigator.clipboard.writeText` (a refusal is reported once as `flow-error` `XYL30` and the
 *   copy stays available in memory). Paste takes the system clipboard from the browser's own
 *   `paste` event, which needs no permission, and falls back to the last copy of this page.
 * - Paste puts the top-left of the set at the pointer when the pointer is over the viewport,
 *   else offsets it by `pasteOffset` per repeated paste. Mod+D always offsets.
 *
 * @returns A disposer with `copy`, `cut`, `paste` and `duplicate` attached for toolbars and menus.
 */
export function installClipboard(
  flow: XyFlowElement,
  options: ClipboardOptions = {},
): InstalledClipboard {
  const offsetStep = options.pasteOffset ?? 20;
  const useKeys = options.keys ?? true;
  let repeat = 0;
  let lastAt: XYPosition | null = null;
  let warned = false;
  const handled = new WeakSet<Event>();

  const warn = (error: unknown): void => {
    if (warned) return;
    warned = true;
    flow.store.reportError(
      'XYL30',
      `The system clipboard is not available (${String(error)}); copies stay in memory.`,
    );
  };

  const write = (payload: ClipboardPayload): string => {
    const text = JSON.stringify(payload);
    memory = text;
    repeat = 0;
    lastAt = null;
    return text;
  };

  const copy = (): boolean => {
    const payload = serializeSelection(flow);
    if (!payload) return false;
    const text = write(payload);
    try {
      navigator.clipboard.writeText(text).catch(warn);
    } catch (error) {
      warn(error);
    }
    return true;
  };

  const doPaste = (payload: ClipboardPayload | null): string[] => {
    if (!payload) return [];
    const store = flow.store;
    const pointer = store.getState().lastPointerFlowPosition;
    if (pointer && insideViewport(store, pointer)) {
      const same = lastAt && lastAt.x === pointer.x && lastAt.y === pointer.y;
      repeat = same ? repeat + 1 : 0;
      lastAt = { ...pointer };
      const shift = repeat * offsetStep;
      return pasteElements(flow, payload, {
        getId: options.getId,
        at: { x: pointer.x + shift, y: pointer.y + shift },
      });
    }
    repeat += 1;
    lastAt = null;
    const shift = repeat * offsetStep;
    return pasteElements(flow, payload, {
      getId: options.getId,
      offset: { x: shift, y: shift },
    });
  };

  const api = {
    copy,
    async cut(): Promise<boolean> {
      const store = flow.store;
      if (!copy()) return false;
      const { nodes, edges } = store.getState();
      await store.instance.deleteElements({
        nodes: nodes.filter((n) => n.selected),
        edges: edges.filter((e) => e.selected),
      });
      return true;
    },
    paste(payload?: ClipboardPayload): string[] {
      return doPaste(payload ?? parseClipboard(memory));
    },
    duplicate(): string[] {
      const payload = serializeSelection(flow);
      if (!payload) return [];
      return pasteElements(flow, payload, {
        getId: options.getId,
        offset: { x: offsetStep, y: offsetStep },
      });
    },
  };

  const stop = withStore(flow, (store, host) => {
    if (!host) return;
    const onCopy = (cut: boolean) => (e: Event) => {
      if (handled.has(e) || isInputDOMNode(e)) return;
      const payload = serializeSelection(flow);
      if (!payload) return;
      handled.add(e);
      const text = write(payload);
      const data = (e as ClipboardEvent).clipboardData;
      if (data) {
        data.setData('text/plain', text);
        data.setData(CLIPBOARD_MIME, text);
        e.preventDefault();
      }
      if (cut) void api.cut();
    };
    const onPaste = (e: Event): void => {
      if (handled.has(e) || isInputDOMNode(e)) return;
      handled.add(e);
      const data = (e as ClipboardEvent).clipboardData;
      const text = data?.getData(CLIPBOARD_MIME) || data?.getData('text/plain') || '';
      const payload = parseClipboard(text) ?? (text === '' ? parseClipboard(memory) : null);
      if (!payload) return;
      e.preventDefault();
      doPaste(payload);
    };
    const copyHandler = onCopy(false);
    const cutHandler = onCopy(true);
    host.addEventListener('copy', copyHandler);
    host.addEventListener('cut', cutHandler);
    host.addEventListener('paste', onPaste);

    const isActive = (): boolean => {
      const active = keyboardTracker.activeFlow;
      if (active !== null) return active === host;
      return activeInstalls.size === 1 && activeInstalls.has(host);
    };
    activeInstalls.add(host);
    let offKeys: Disposer | undefined;
    if (useKeys) {
      offKeys = keyboardTracker.subscribe((e, type) => {
        if (type !== 'down' || e.repeat || e.altKey || e.shiftKey) return;
        const mod = MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
        if (!mod || !isActive() || isInputDOMNode(e)) return;
        switch (e.key.toLowerCase()) {
          case 'c':
            if (copy()) e.preventDefault();
            break;
          case 'x':
            if (store.getState().nodes.some((n) => n.selected)) {
              e.preventDefault();
              void api.cut();
            }
            break;
          case 'd':
            e.preventDefault();
            api.duplicate();
            break;
          case 'v':
            armPaste();
            break;
          default:
            break;
        }
      });
    }

    /*
     * Paste: let the browser's own `paste` event deliver the system clipboard (no permission, no
     * prompt); if it does not arrive, use the last copy of this page.
     */
    function armPaste(): void {
      let done = false;
      const finish = (payload: ClipboardPayload | null): void => {
        if (done) return;
        done = true;
        document.removeEventListener('paste', listener, true);
        clearTimeout(timer);
        doPaste(payload);
      };
      const listener = (e: Event): void => {
        if (isInputDOMNode(e)) {
          done = true;
          document.removeEventListener('paste', listener, true);
          clearTimeout(timer);
          return;
        }
        handled.add(e);
        const data = (e as ClipboardEvent).clipboardData;
        const text = data?.getData(CLIPBOARD_MIME) || data?.getData('text/plain') || '';
        const parsed = parseClipboard(text);
        if (parsed) e.preventDefault();
        finish(parsed ?? (text === '' ? parseClipboard(memory) : null));
      };
      // eslint-disable-next-line no-restricted-syntax -- temporary listener: removed on the first paste event or after 60 ms
      document.addEventListener('paste', listener, true);
      const timer = setTimeout(() => {
        finish(parseClipboard(memory));
      }, 60);
    }

    return () => {
      host.removeEventListener('copy', copyHandler);
      host.removeEventListener('cut', cutHandler);
      host.removeEventListener('paste', onPaste);
      offKeys?.();
      activeInstalls.delete(host);
    };
  });
  return Object.assign(() => {
    stop();
  }, api);
}

const activeInstalls = new Set<XyFlowElement>();
