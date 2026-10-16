import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArraySource } from '@xy-lit/store';
import {
  CLIPBOARD_MIME,
  LocalHistory,
  installClipboard,
  parseClipboard,
  pasteElements,
  serializeSelection,
} from '../src/index.js';
import { cleanup, edge, frames, mountFlow, node, nodeEl, pos, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MAC = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
const mod = (init: KeyboardEventInit): KeyboardEventInit =>
  MAC ? { ...init, metaKey: true } : { ...init, ctrlKey: true };
const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    ...mod(init),
  });
  window.dispatchEvent(e);
  return e;
};
const activate = (flow: HTMLElement): void => {
  nodeEl(flow as never, 'a').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  );
};

const graph = () =>
  mountFlow({
    nodes: [
      node('a', 0, 0, { selected: true }),
      node('b', 300, 0, { selected: true }),
      node('c', 0, 200),
      node('g', 600, 0, { type: 'group', width: 300, height: 200 }),
      node('k', 20, 20, { parentId: 'g' }),
    ],
    edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('gk', 'g', 'k')],
  });

describe('clipboard serialisation', () => {
  it('copies selected nodes and the edges between them, without local fields', async () => {
    const flow = await graph();
    const payload = serializeSelection(flow)!;
    expect(payload['xy-lit']).toBe(1);
    expect(payload.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(payload.edges.map((e) => e.id)).toEqual(['ab']);
    for (const n of payload.nodes) {
      expect(n).not.toHaveProperty('selected');
      expect(n).not.toHaveProperty('measured');
      expect(n).not.toHaveProperty('dragging');
    }
  });

  it('includes the descendants of a selected group', async () => {
    const flow = await graph();
    flow.store.addSelectedNodes(['g']);
    const payload = serializeSelection(flow)!;
    expect(payload.nodes.map((n) => n.id)).toEqual(['g', 'k']);
    expect(payload.edges.map((e) => e.id)).toEqual(['gk']);
    expect(payload.nodes[1]!.parentId).toBe('g');
  });

  it('turns a child copied without its parent into a root at its absolute position', async () => {
    const flow = await graph();
    flow.store.addSelectedNodes(['k']);
    const payload = serializeSelection(flow)!;
    expect(payload.nodes[0]!.parentId).toBeUndefined();
    expect(payload.nodes[0]!.position).toEqual({ x: 620, y: 20 });
  });

  it('returns null without a selection', async () => {
    const flow = await graph();
    flow.store.resetSelectedElements();
    expect(serializeSelection(flow)).toBeNull();
  });

  it('rejects text that is not a payload', () => {
    expect(parseClipboard('hello')).toBeNull();
    expect(parseClipboard('{"xy-lit":1}')).toBeNull();
    expect(parseClipboard('{"xy-lit":1,"nodes":[{"id":"a"}],"edges":[]}')).toBeNull();
    expect(parseClipboard('{"xy-lit":2,"nodes":[],"edges":[]}')).toBeNull();
    expect(parseClipboard(JSON.stringify({ 'xy-lit': 1, nodes: [], edges: [] }))).not.toBeNull();
  });
});

describe('pasteElements', () => {
  it('remaps ids, parentId, source and target and selects the pasted elements', async () => {
    const flow = await graph();
    flow.store.addSelectedNodes(['g']);
    const payload = serializeSelection(flow)!;
    const ids = pasteElements(flow, payload, { getId: (id) => `${id}2` });
    expect(ids).toEqual(['g2', 'k2']);
    const k2 = flow.nodes.find((n) => n.id === 'k2')!;
    expect(k2.parentId).toBe('g2');
    expect(k2.position).toEqual({ x: 20, y: 20 });
    expect(flow.nodes.find((n) => n.id === 'g2')!.position).toEqual({ x: 620, y: 20 });
    expect(flow.edges.find((e) => e.id === 'gk2')).toMatchObject({ source: 'g2', target: 'k2' });
    expect(flow.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['g2', 'k2']);
    expect(flow.edges.filter((e) => e.selected).map((e) => e.id)).toEqual(['gk2']);
    // parents stay before their children
    const order = flow.nodes.map((n) => n.id);
    expect(order.indexOf('g2')).toBeLessThan(order.indexOf('k2'));
  });

  it('keeps edges only between copied nodes', async () => {
    const flow = await graph();
    pasteElements(flow, serializeSelection(flow)!, { getId: (id) => `${id}2` });
    expect(flow.edges.map((e) => e.id)).toContain('ab2');
    expect(flow.edges.some((e) => e.id.startsWith('bc') && e.id !== 'bc')).toBe(false);
  });

  it('places the set at a point (top-left of the bounding box)', async () => {
    const flow = await graph();
    const ids = pasteElements(flow, serializeSelection(flow)!, { at: { x: 100, y: 400 } });
    expect(pos(flow, ids[0]!)).toEqual({ x: 100, y: 400 });
    expect(pos(flow, ids[1]!)).toEqual({ x: 400, y: 400 });
  });

  it('generates unique ids by default and never reuses an existing one', async () => {
    const flow = await graph();
    const payload = serializeSelection(flow)!;
    const first = pasteElements(flow, payload);
    const second = pasteElements(flow, payload, { getId: () => 'a' });
    expect(new Set([...flow.nodes.map((n) => n.id)]).size).toBe(flow.nodes.length);
    expect(first[0]).toMatch(/^a-[0-9a-f]{6}$/);
    expect(second[0]).not.toBe('a');
  });

  it('runs both batches in one source transaction (one Yjs undo step)', async () => {
    const flow = await graph();
    const origins: unknown[] = [];
    class TxSource extends ArraySource {
      transact(fn: () => void, origin?: unknown): void {
        origins.push(origin);
        fn();
      }
    }
    flow.source = new TxSource(flow.nodes, flow.edges);
    pasteElements(flow, serializeSelection(flow)!);
    expect(origins).toEqual(['paste']);
  });

  it('is one history step, and undo restores the previous selection', async () => {
    const flow = await graph();
    const history = new LocalHistory(flow);
    const before = flow.nodes.length;
    pasteElements(flow, serializeSelection(flow)!);
    expect(history.undoSize).toBe(1);
    expect(flow.nodes).toHaveLength(before + 2);
    history.undo();
    expect(flow.nodes).toHaveLength(before);
    expect(flow.edges.map((e) => e.id)).toEqual(['ab', 'bc', 'gk']);
    expect(flow.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['a', 'b']);
    history.redo();
    expect(flow.nodes).toHaveLength(before + 2);
  });
});

describe('installClipboard', () => {
  it('copy and paste events on the host use the clipboard data', async () => {
    const flow = await graph();
    const stop = installClipboard(flow, { keys: false, getId: (id) => `${id}x` });
    const data = new DataTransfer();
    const copy = new ClipboardEvent('copy', {
      clipboardData: data,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    nodeEl(flow, 'a').dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(true);
    // Firefox gives synthetic events their own data store: read what the handler wrote from the event
    const written = copy.clipboardData ?? data;
    if (written.getData(CLIPBOARD_MIME)) {
      expect(written.getData(CLIPBOARD_MIME)).toContain('"xy-lit"');
      expect(written.getData('text/plain')).toBe(written.getData(CLIPBOARD_MIME));
    }
    data.setData(CLIPBOARD_MIME, JSON.stringify(serializeSelection(flow)));

    const paste = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    nodeEl(flow, 'a').dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(flow.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['ax', 'bx']));
    stop();
  });

  it('leaves clipboard events from text inputs alone', async () => {
    const flow = await graph();
    const stop = installClipboard(flow, { keys: false });
    const input = document.createElement('input');
    flow.append(input);
    const copy = new ClipboardEvent('copy', {
      clipboardData: new DataTransfer(),
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    input.dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(false);
    input.remove();
    stop();
  });

  it('copy and paste with the keys, repeated paste offsets, pointer placement', async () => {
    const flow = await graph();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const stop = installClipboard(flow, { pasteOffset: 30 });
    activate(flow);
    expect(press('c').defaultPrevented).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();

    press('v');
    await waitFor(() => flow.nodes.length === 7);
    const firstIds = flow.nodes.filter((n) => n.selected).map((n) => n.id);
    expect(firstIds).toHaveLength(2);
    // no pointer over the viewport: offset by 30 on the first paste
    expect(pos(flow, firstIds[0]!)).toEqual({ x: 30, y: 30 });

    press('v');
    await waitFor(() => flow.nodes.length === 9);
    const second = flow.nodes.filter((n) => n.selected)[0]!;
    expect(second.position).toEqual({ x: 60, y: 60 });

    // pointer over the viewport: top-left at the pointer
    flow.store.setState({ lastPointerFlowPosition: { x: 200, y: 300 } });
    press('v');
    await waitFor(() => flow.nodes.length === 11);
    const third = flow.nodes.filter((n) => n.selected);
    expect(third[0]!.position).toEqual({ x: 200, y: 300 });
    expect(third[1]!.position).toEqual({ x: 500, y: 300 });
    stop();
  });

  it('cut removes the selection (nodes and their edges) and keeps it pasteable', async () => {
    const flow = await graph();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const history = new LocalHistory(flow);
    const clipboard = installClipboard(flow);
    activate(flow);
    expect(press('x').defaultPrevented).toBe(true);
    await waitFor(() => flow.nodes.length === 3);
    expect(flow.edges.map((e) => e.id)).toEqual(['gk']);
    expect(history.undoSize).toBe(1);
    const ids = clipboard.paste();
    expect(ids).toHaveLength(2);
    expect(flow.nodes).toHaveLength(5);
    clipboard();
  });

  it('duplicate (Mod+D) offsets the copy and does not touch the clipboard', async () => {
    const flow = await graph();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const stop = installClipboard(flow, { getId: (id) => `${id}-dup` });
    activate(flow);
    expect(press('d').defaultPrevented).toBe(true);
    expect(flow.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a-dup', 'b-dup']));
    expect(pos(flow, 'a-dup')).toEqual({ x: 20, y: 20 });
    expect(flow.edges.some((e) => e.id === 'ab-dup')).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    stop();
  });

  it('only the active flow reacts, and nothing is prevented without a selection', async () => {
    const flow = await graph();
    const other = await mountFlow({ nodes: [node('z', 0, 0, { selected: true })] });
    const stopA = installClipboard(flow);
    const stopB = installClipboard(other);
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    activate(flow);
    press('d');
    await frames(1);
    expect(flow.nodes.length).toBe(7);
    expect(other.nodes.length).toBe(1);
    flow.store.resetSelectedElements();
    expect(press('c').defaultPrevented).toBe(false);
    stopA();
    stopB();
  });

  it('reports a refused system clipboard once as XYL30 and still pastes from memory', async () => {
    const flow = await graph();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors: string[] = [];
    flow.addEventListener('flow-error', (e) => errors.push(e.detail.code));
    const clipboard = installClipboard(flow);
    clipboard.copy();
    clipboard.copy();
    await frames(2);
    expect(errors).toEqual(['XYL30']);
    expect(clipboard.paste()).toHaveLength(2);
    clipboard();
  });

  it('stops listening when disposed', async () => {
    const flow = await graph();
    const stop = installClipboard(flow);
    stop();
    activate(flow);
    expect(press('d').defaultPrevented).toBe(false);
    expect(flow.nodes).toHaveLength(5);
  });
});
