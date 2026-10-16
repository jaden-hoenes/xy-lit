import { keyboardTracker } from '@xy-lit/store';
import type { FlowHistory } from '@xy-lit/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import {
  cleanup,
  edge,
  firePointer,
  frames,
  mountFlow,
  node,
  nodeEl,
  paneOf,
  waitFor,
} from './helpers.js';

const CODES: Record<string, string> = {
  Shift: 'ShiftLeft',
  Control: 'ControlLeft',
  Meta: 'MetaLeft',
  ' ': 'Space',
  Backspace: 'Backspace',
};

/** Dispatch a key event on `target` (default the window) the way the browser would. */
function key(
  type: 'keydown' | 'keyup',
  k: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key: k,
    code: CODES[k] ?? (k.length === 1 ? `Key${k.toUpperCase()}` : k),
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

const press = (k: string, init: KeyboardEventInit = {}, target?: EventTarget): void => {
  key('keydown', k, init, target);
  key('keyup', k, init, target);
};

afterEach(() => {
  window.dispatchEvent(new Event('blur'));
  keyboardTracker.activeFlow = null;
  cleanup();
  vi.restoreAllMocks();
});

/** Make a flow the active one the way a user would: press the pointer on it. */
const activate = (flow: XyFlowElement): void => {
  firePointer(paneOf(flow), 'pointerdown', 5, 5);
  firePointer(paneOf(flow), 'pointerup', 5, 5);
};

describe('FlowKeysController: activation keys', () => {
  it('follows the selection key and shows the selection cursor class', async () => {
    const flow = await mountFlow({ nodes: [] });
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    key('keydown', 'Shift', { shiftKey: true });
    expect(flow.store.getState().selectionKeyPressed).toBe(true);
    await waitFor(() => paneOf(flow).classList.contains('selection'));
    key('keyup', 'Shift');
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    await waitFor(() => !paneOf(flow).classList.contains('selection'));
  });

  it('follows the multi-selection and zoom activation keys (Control by default)', async () => {
    const flow = await mountFlow({ nodes: [] });
    key('keydown', 'Control', { ctrlKey: true });
    expect(flow.store.getState().multiSelectionActive).toBe(true);
    expect(flow.store.getState().zoomActivationKeyPressed).toBe(true);
    key('keyup', 'Control');
    expect(flow.store.getState().multiSelectionActive).toBe(false);
    expect(flow.store.getState().zoomActivationKeyPressed).toBe(false);
  });

  it('pan activation key (Space) makes the pane draggable and hands scrolling to panning', async () => {
    const flow = await mountFlow({ nodes: [], props: { panOnDrag: false } });
    expect(paneOf(flow).classList.contains('draggable')).toBe(false);
    key('keydown', ' ');
    expect(flow.store.getState().panActivationKeyPressed).toBe(true);
    await waitFor(() => paneOf(flow).classList.contains('draggable'));
    expect(flow.pane.interaction.panOnDrag).toBe(true);
    expect(flow.pane.interaction.panOnScroll).toBe(true);
    key('keyup', ' ');
    expect(flow.store.getState().panActivationKeyPressed).toBe(false);
  });

  it('supports combinations and arrays, and changes of the key property', async () => {
    const flow = await mountFlow({ nodes: [], props: { selectionKey: ['Meta+s', 'a'] } });
    key('keydown', 'a');
    expect(flow.store.getState().selectionKeyPressed).toBe(true);
    key('keyup', 'a');
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    key('keydown', 'Shift', { shiftKey: true });
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    key('keyup', 'Shift');

    flow.selectionKey = 'q';
    await flow.updateComplete;
    key('keydown', 'q');
    expect(flow.store.getState().selectionKeyPressed).toBe(true);
    key('keyup', 'q');
  });

  it('a null key code disables the key', async () => {
    const flow = await mountFlow({ nodes: [], props: { selectionKey: null } });
    key('keydown', 'Shift', { shiftKey: true });
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    key('keyup', 'Shift');
  });

  it('ignores plain keys typed in an input field', async () => {
    const flow = await mountFlow({ nodes: [], props: { selectionKey: 'a' } });
    const input = document.createElement('input');
    document.body.append(input);
    try {
      key('keydown', 'a', {}, input);
      expect(flow.store.getState().selectionKeyPressed).toBe(false);
      key('keyup', 'a', {}, input);
    } finally {
      input.remove();
    }
  });

  it('resets every flag and the user selection on window blur', async () => {
    const flow = await mountFlow({ nodes: [] });
    key('keydown', 'Shift', { shiftKey: true });
    key('keydown', 'Control', { ctrlKey: true, shiftKey: true });
    flow.store.setState({
      userSelectionRect: { x: 1, y: 1, width: 1, height: 1, startX: 1, startY: 1 },
    });
    window.dispatchEvent(new Event('blur'));
    const s = flow.store.getState();
    expect(s.selectionKeyPressed).toBe(false);
    expect(s.multiSelectionActive).toBe(false);
    expect(s.zoomActivationKeyPressed).toBe(false);
    expect(s.userSelectionRect).toBeNull();
    // a later press works again
    key('keydown', 'Shift', { shiftKey: true });
    expect(flow.store.getState().selectionKeyPressed).toBe(true);
    key('keyup', 'Shift');
  });

  it('every flow follows the shared key state', async () => {
    const a = await mountFlow({ nodes: [] });
    const b = await mountFlow({ nodes: [] });
    key('keydown', 'Shift', { shiftKey: true });
    expect(a.store.getState().selectionKeyPressed).toBe(true);
    expect(b.store.getState().selectionKeyPressed).toBe(true);
    key('keyup', 'Shift');
  });

  it('stops listening when the element is removed', async () => {
    const flow = await mountFlow({ nodes: [] });
    flow.remove();
    key('keydown', 'Shift', { shiftKey: true });
    expect(flow.store.getState().selectionKeyPressed).toBe(false);
    key('keyup', 'Shift');
  });
});

describe('FlowKeysController: delete', () => {
  const nodes = () => [
    node('a', 0, 0, { selected: true }),
    node('b', 200, 0),
    node('c', 400, 0, { selected: true, deletable: false }),
  ];
  const edges = () => [edge('ab', 'a', 'b'), edge('bc', 'b', 'c', { selected: true })];

  it('deletes the selection (and connected edges) with Backspace in the active flow', async () => {
    const flow = await mountFlow({ nodes: nodes(), edges: edges() });
    activate(flow);
    const spy = vi.fn();
    flow.addEventListener('delete', spy);
    press('Backspace');
    await waitFor(() => flow.getNodes().length === 2);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['b', 'c']);
    // `ab` goes with node a, `bc` was selected itself; node c is not deletable and stays
    expect(flow.getEdges()).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(flow.store.getState().nodesSelectionActive).toBe(false);
  });

  it('uses the configured delete key and ignores others', async () => {
    const flow = await mountFlow({ nodes: nodes(), edges: edges(), props: { deleteKey: 'd' } });
    activate(flow);
    press('Backspace');
    await frames(2);
    expect(flow.getNodes()).toHaveLength(3);
    press('d');
    await waitFor(() => flow.getNodes().length === 2);
  });

  it('does nothing with deleteKey null', async () => {
    const flow = await mountFlow({ nodes: nodes(), props: { deleteKey: null } });
    activate(flow);
    press('Backspace');
    await frames(2);
    expect(flow.getNodes()).toHaveLength(3);
  });

  it('does not delete while a modifier is held or in an input field', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    activate(flow);
    press('Backspace', { ctrlKey: true });
    press('Backspace', { shiftKey: true });
    await frames(2);
    expect(flow.getNodes()).toHaveLength(3);

    const input = document.createElement('input');
    document.body.append(input);
    try {
      press('Backspace', {}, input);
    } finally {
      input.remove();
    }
    await frames(2);
    expect(flow.getNodes()).toHaveLength(3);
  });

  it('acts on the active flow only', async () => {
    const a = await mountFlow({ nodes: [node('a1', 0, 0, { selected: true })] });
    const b = await mountFlow({ nodes: [node('b1', 0, 0, { selected: true })] });
    activate(b);
    press('Backspace');
    await waitFor(() => b.getNodes().length === 0);
    expect(a.getNodes()).toHaveLength(1);

    b.addNodes([node('b2', 0, 0, { selected: true })]);
    activate(a);
    press('Backspace');
    await waitFor(() => a.getNodes().length === 0);
    expect(b.getNodes()).toHaveLength(1);
  });

  it('focus moves the active flow', async () => {
    const a = await mountFlow({ nodes: [node('a1', 0, 0, { selected: true })] });
    const b = await mountFlow({ nodes: [node('b1', 0, 0, { selected: true })] });
    activate(b);
    nodeEl(a, 'a1').focus();
    expect(keyboardTracker.activeFlow).toBe(a);
    press('Backspace');
    await waitFor(() => a.getNodes().length === 0);
    expect(b.getNodes()).toHaveLength(1);
  });

  it('a lone flow handles the delete key before anything was pressed or focused', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0, { selected: true })] });
    keyboardTracker.activeFlow = null;
    press('Backspace');
    await waitFor(() => flow.getNodes().length === 0);
  });

  it('with two flows and no active one, nothing is deleted', async () => {
    const a = await mountFlow({ nodes: [node('a1', 0, 0, { selected: true })] });
    const b = await mountFlow({ nodes: [node('b1', 0, 0, { selected: true })] });
    keyboardTracker.activeFlow = null;
    press('Backspace');
    await frames(3);
    expect(a.getNodes()).toHaveLength(1);
    expect(b.getNodes()).toHaveLength(1);
  });

  it('honours onBeforeDelete', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      props: { onBeforeDelete: () => Promise.resolve(false) },
    });
    activate(flow);
    press('Backspace');
    await frames(3);
    expect(flow.getNodes()).toHaveLength(3);
  });
});

describe('FlowKeysController: undo and redo', () => {
  const history = (): FlowHistory & { undo: Mock; redo: Mock } => ({
    undo: vi.fn<() => void>(),
    redo: vi.fn<() => void>(),
    canUndo: () => true,
    canRedo: () => true,
    subscribe: () => () => {},
  });

  it('Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo, on the active flow only', async () => {
    const flow = await mountFlow({ nodes: [] });
    const other = await mountFlow({ nodes: [] });
    const h = history();
    const hOther = history();
    flow.store.setHistory(h);
    other.store.setHistory(hOther);
    activate(flow);

    const undo = key('keydown', 'z', { ctrlKey: true });
    key('keyup', 'z');
    expect(h.undo).toHaveBeenCalledTimes(1);
    expect(undo.defaultPrevented).toBe(true);
    press('z', { ctrlKey: true, shiftKey: true });
    press('y', { ctrlKey: true });
    expect(h.redo).toHaveBeenCalledTimes(2);
    expect(hOther.undo).not.toHaveBeenCalled();
    expect(hOther.redo).not.toHaveBeenCalled();
  });

  it('ignores plain z, inputs and history-keys="off"', async () => {
    const flow = await mountFlow({ nodes: [] });
    const h = history();
    flow.store.setHistory(h);
    activate(flow);
    press('z');
    const input = document.createElement('input');
    document.body.append(input);
    try {
      press('z', { ctrlKey: true }, input);
    } finally {
      input.remove();
    }
    expect(h.undo).not.toHaveBeenCalled();

    flow.historyKeys = 'off';
    await flow.updateComplete;
    press('z', { ctrlKey: true });
    expect(h.undo).not.toHaveBeenCalled();
  });

  it('does nothing without a history', async () => {
    const flow = await mountFlow({ nodes: [] });
    activate(flow);
    const event = key('keydown', 'z', { ctrlKey: true });
    key('keyup', 'z');
    expect(event.defaultPrevented).toBe(false);
  });
});
