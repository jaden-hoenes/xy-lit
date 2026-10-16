import { afterEach, describe, expect, it, vi } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import {
  cleanup,
  centerOf,
  dragMouse,
  edge,
  firePointer,
  frames,
  mountFlow,
  node,
  nodeEl,
  paneOf,
  waitFor,
} from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Client position of a point given in the flow element's own coordinates. */
const at = (flow: XyFlowElement, x: number, y: number): { x: number; y: number } => {
  const r = flow.getBoundingClientRect();
  return { x: r.left + x, y: r.top + y };
};

const nodes = () => [
  node('a', 100, 100),
  node('b', 300, 100),
  node('c', 100, 300),
  node('far', 600, 400),
];

/** Draw a selection rectangle (selection key flag set directly) from `from` to `to` in flow px. */
async function select(
  flow: XyFlowElement,
  from: [number, number],
  to: [number, number],
  steps = 4,
): Promise<void> {
  const pane = paneOf(flow);
  const start = at(flow, ...from);
  firePointer(pane, 'pointerdown', start.x, start.y);
  for (let i = 1; i <= steps; i++) {
    const p = at(
      flow,
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    );
    firePointer(pane, 'pointermove', p.x, p.y);
    await frames(1);
  }
  const end = at(flow, ...to);
  firePointer(pane, 'pointerup', end.x, end.y);
  await frames(1);
}

describe('PaneController: clicks and events', () => {
  it('emits pane-click and clears the selection when the pane is clicked', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { selected: true }), node('b', 200, 0)],
    });
    const spy = vi.fn();
    flow.addEventListener('pane-click', spy);
    flow.store.setState({ nodesSelectionActive: true });
    paneOf(flow).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await waitFor(() => !flow.getNode('a')?.selected);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(flow.store.getState().nodesSelectionActive).toBe(false);
  });

  it('ignores clicks that bubble up from nodes', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0)] });
    const spy = vi.fn();
    flow.addEventListener('pane-click', spy);
    nodeEl(flow, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits pane-context-menu, or prevents the menu when right-click pans', async () => {
    const flow = await mountFlow({ nodes: [] });
    const spy = vi.fn();
    flow.addEventListener('pane-context-menu', spy);
    const first = new MouseEvent('contextmenu', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    paneOf(flow).dispatchEvent(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(false);

    flow.panOnDrag = [1, 2];
    await flow.updateComplete;
    const second = new MouseEvent('contextmenu', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    paneOf(flow).dispatchEvent(second);
    expect(second.defaultPrevented).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits pane-scroll and the pointer events only for listeners', async () => {
    const flow = await mountFlow({ nodes: [] });
    const types = ['pane-scroll', 'pane-pointer-enter', 'pane-pointer-move', 'pane-pointer-leave'];
    const seen: string[] = [];
    for (const type of types) {
      flow.addEventListener(type, () => {
        seen.push(type);
      });
    }
    const pane = paneOf(flow);
    pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    pane.dispatchEvent(new PointerEvent('pointerenter', { composed: true }));
    pane.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
    pane.dispatchEvent(new PointerEvent('pointerleave', { composed: true }));
    expect(seen).toEqual(types);
  });

  it('keeps lastPointerFlowPosition in flow coordinates, once per frame', async () => {
    const flow = await mountFlow({
      nodes: [],
      props: { defaultViewport: { x: 50, y: 20, zoom: 2 } },
    });
    const p = at(flow, 250, 120);
    paneOf(flow).dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: p.x,
        clientY: p.y,
        bubbles: true,
        composed: true,
      }),
    );
    await waitFor(() => flow.store.getState().lastPointerFlowPosition);
    expect(flow.store.getState().lastPointerFlowPosition).toEqual({ x: 100, y: 50 });
  });

  it('adds the draggable, dragging and selection classes', async () => {
    const flow = await mountFlow({ nodes: [] });
    const pane = paneOf(flow);
    expect(pane.classList.contains('draggable')).toBe(true);
    expect(pane.classList.contains('selection')).toBe(false);
    flow.store.setState({ selectionKeyPressed: true, paneDragging: true });
    await waitFor(() => pane.classList.contains('selection'));
    expect(pane.classList.contains('dragging')).toBe(true);
    flow.panOnDrag = [1];
    await waitFor(() => !pane.classList.contains('draggable'));
  });
});

describe('PaneController: user selection', () => {
  it('draws a rectangle, selects the nodes inside and shows the selection box', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      edges: [edge('ab', 'a', 'b'), edge('bf', 'b', 'far')],
    });
    const start = vi.fn();
    const end = vi.fn();
    flow.addEventListener('selection-start', start);
    flow.addEventListener('selection-end', end);
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;

    const pane = paneOf(flow);
    const from = at(flow, 50, 50);
    firePointer(pane, 'pointerdown', from.x, from.y);
    const mid = at(flow, 300, 200);
    firePointer(pane, 'pointermove', mid.x, mid.y);
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__selection'));
    const rect = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__selection');
    expect(rect?.style.width).toBe('250px');
    expect(rect?.style.height).toBe('150px');
    expect(rect?.style.transform).toBe('translate(50px, 50px)');
    expect(flow.store.getState().userSelectionActive).toBe(true);

    const to = at(flow, 560, 260);
    firePointer(pane, 'pointermove', to.x, to.y);
    firePointer(pane, 'pointerup', to.x, to.y);
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__nodesselection'));

    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
    expect(
      flow
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
    ).toEqual(['a', 'b']);
    // the edge between two selected nodes is selected; one to an unselected node is selected too
    expect(
      flow
        .getEdges()
        .filter((e) => e.selected)
        .map((e) => e.id),
    ).toEqual(['ab', 'bf']);
    expect(flow.renderRoot.querySelector('.lit-flow__selection')).toBeNull();
    expect(flow.store.getState().nodesSelectionActive).toBe(true);
    expect(flow.store.getState().userSelectionRect).toBeNull();
    const box = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection');
    expect(box?.classList.contains('nopan')).toBe(true);
    expect(box?.style.transform).toBe('translate(100px, 100px)');
    const inner = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection-rect');
    expect(inner?.getAttribute('tabindex')).toBe('-1');
    expect((flow.renderRoot as ShadowRoot).activeElement).toBe(inner);
  });

  it('selects partially covered nodes only in partial mode', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      props: { selectionMode: 'partial' },
    });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [150, 150]);
    expect(
      flow
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
    ).toEqual(['a']);
  });

  it('does not select a node that is only partially covered in full mode', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [150, 150]);
    expect(flow.getNodes().some((n) => n.selected)).toBe(false);
    expect(flow.store.getState().nodesSelectionActive).toBe(false);
  });

  it('sends one change batch per change of the selected set', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    const batches: number[] = [];
    flow.addEventListener('nodes-change', (e) => {
      batches.push((e as CustomEvent).detail.changes.length);
    });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [500, 500], 8);
    // growing the rectangle over a, b, c adds nodes at most once each
    expect(batches.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3);
    expect(flow.getNodes().filter((n) => n.selected).length).toBe(3);
  });

  it('selects with a plain drag when selectionOnDrag is set and the primary button does not pan', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      props: { selectionOnDrag: true, panOnDrag: [1, 2] },
    });
    await select(flow, [50, 50], [500, 500]);
    expect(flow.getNodes().filter((n) => n.selected).length).toBe(3);
  });

  it('does not select with a plain drag when the primary button pans', async () => {
    const flow = await mountFlow({ nodes: nodes(), props: { selectionOnDrag: true } });
    await select(flow, [50, 50], [500, 500]);
    expect(flow.getNodes().some((n) => n.selected)).toBe(false);
  });

  it('lets touch input pan unless the selection key is held', async () => {
    const flow = await mountFlow({
      nodes: nodes(),
      props: { selectionOnDrag: true, panOnDrag: [1, 2] },
    });
    const pane = paneOf(flow);
    const p = at(flow, 50, 50);
    firePointer(pane, 'pointerdown', p.x, p.y, { pointerType: 'touch' });
    expect(flow.store.getState().userSelectionRect).toBeNull();
    firePointer(pane, 'pointerup', p.x, p.y, { pointerType: 'touch' });

    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    firePointer(pane, 'pointerdown', p.x, p.y, { pointerType: 'touch' });
    expect(flow.store.getState().userSelectionRect).not.toBeNull();
    firePointer(pane, 'pointerup', p.x, p.y, { pointerType: 'touch' });
  });

  it('starts a selection on a node while the selection key is held, and swallows the gesture', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    const el = nodeEl(flow, 'a');
    const c = centerOf(el);
    const event = firePointer(el, 'pointerdown', c.x, c.y);
    expect(event.defaultPrevented).toBe(true);
    expect(flow.store.getState().userSelectionRect).not.toBeNull();
    firePointer(paneOf(flow), 'pointerup', c.x, c.y);
  });

  it('does not start a selection on a .nokey child', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    const el = nodeEl(flow, 'a');
    el.classList.add('nokey');
    const c = centerOf(el);
    firePointer(el, 'pointerdown', c.x, c.y);
    expect(flow.store.getState().userSelectionRect).toBeNull();
  });

  it('does not select when elements are not selectable', async () => {
    const flow = await mountFlow({ nodes: nodes(), props: { elementsSelectable: false } });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [500, 500]);
    expect(flow.getNodes().some((n) => n.selected)).toBe(false);
  });

  it('keeps a click-sized press a pane click and swallows the click after a drag', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { selected: true })],
      props: { selectionOnDrag: true, panOnDrag: [1, 2] },
    });
    const click = vi.fn();
    flow.addEventListener('pane-click', click);
    const pane = paneOf(flow);
    const p = at(flow, 400, 300);
    firePointer(pane, 'pointerdown', p.x, p.y);
    firePointer(pane, 'pointerup', p.x, p.y);
    await frames(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(flow.getNode('a')?.selected).toBeFalsy();

    // a real drag: the click that follows is swallowed
    await select(flow, [350, 250], [450, 350]);
    pane.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
    );
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('auto-pans while the pointer is near the edge', async () => {
    const flow = await mountFlow({ nodes: nodes() });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    const pane = paneOf(flow);
    const from = at(flow, 400, 250);
    firePointer(pane, 'pointerdown', from.x, from.y);
    const near = at(flow, 790, 250);
    firePointer(pane, 'pointermove', near.x, near.y);
    firePointer(pane, 'pointermove', near.x, near.y);
    const before = flow.store.getState().transform[0];
    await waitFor(() => flow.store.getState().transform[0] < before - 10);
    firePointer(pane, 'pointerup', near.x, near.y);
    // the start of the rectangle stays fixed on the canvas (flow coordinates)
    expect(flow.store.getState().userSelectionRect).toBeNull();
    // and the loop stops after the gesture
    const after = flow.store.getState().transform[0];
    await frames(4);
    expect(flow.store.getState().transform[0]).toBe(after);
  });
});

describe('selected nodes box', () => {
  async function withSelection() {
    const flow = await mountFlow({ nodes: nodes() });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [500, 500]);
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__nodesselection-rect'));
    // the browser clicks right after the drag; the pane swallows that click, then the key is released
    const swallowed = vi.fn();
    flow.addEventListener('pane-click', swallowed);
    paneOf(flow).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(swallowed).not.toHaveBeenCalled();
    flow.store.setState({ selectionKeyPressed: false });
    await flow.updateComplete;
    return flow;
  }

  it('moves the selection with the arrow keys (Shift = 4x)', async () => {
    const flow = await withSelection();
    const rect = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection-rect')!;
    const before = flow.getNode('a')!.position;
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await waitFor(() => flow.getNode('a')!.position.x === before.x + 5);
    rect.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
    );
    await waitFor(() => flow.getNode('a')!.position.y === before.y + 20);
    expect(flow.getNode('c')!.position.x).toBe(105);
    expect(flow.getNode('far')!.position.x).toBe(600);
  });

  it('has no tabindex and ignores keys with disable-keyboard-a11y', async () => {
    const flow = await mountFlow({ nodes: nodes(), props: { disableKeyboardA11y: true } });
    flow.store.setState({ selectionKeyPressed: true });
    await flow.updateComplete;
    await select(flow, [50, 50], [500, 500]);
    const rect = await waitFor(() =>
      flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection-rect'),
    );
    expect(rect.hasAttribute('tabindex')).toBe(false);
    const x = flow.getNode('a')!.position.x;
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await frames(2);
    expect(flow.getNode('a')!.position.x).toBe(x);
  });

  it('drags all selected nodes together with XYDrag', async () => {
    const flow = await withSelection();
    const rect = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection-rect')!;
    const c = centerOf(rect);
    const drag = vi.fn();
    flow.addEventListener('selection-drag-stop', drag);
    await dragMouse(rect, c, { x: c.x + 40, y: c.y + 30 });
    await waitFor(() => flow.getNode('a')!.position.x > 100);
    const a = flow.getNode('a')!.position;
    const b = flow.getNode('b')!.position;
    expect(b.x - a.x).toBe(200);
    expect(a.x).toBeGreaterThan(100);
    expect(a.y).toBeGreaterThan(100);
    expect(drag).toHaveBeenCalled();
    // the unselected node did not move
    expect(flow.getNode('far')!.position).toEqual({ x: 600, y: 400 });
  });

  it('emits selection-click and selection-context-menu with the selected nodes', async () => {
    const flow = await withSelection();
    const click = vi.fn();
    const menu = vi.fn();
    flow.addEventListener('selection-click', click);
    flow.addEventListener('selection-context-menu', menu);
    const rect = flow.renderRoot.querySelector<HTMLElement>('.lit-flow__nodesselection-rect')!;
    rect.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    rect.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true }));
    expect(
      (click.mock.calls[0]![0] as CustomEvent).detail.nodes.map((n: { id: string }) => n.id),
    ).toEqual(['a', 'b', 'c']);
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it('disappears when a pane click clears the selection', async () => {
    const flow = await withSelection();
    paneOf(flow).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await waitFor(() => !flow.renderRoot.querySelector('.lit-flow__nodesselection'));
    expect(flow.getNodes().some((n) => n.selected)).toBe(false);
  });
});
