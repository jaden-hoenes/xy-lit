import { afterEach, describe, expect, it } from 'vitest';
import { LocalHistory, installHelperLines } from '../src/index.js';
import type { HelperGuides } from '../src/index.js';
import { cleanup, dragNode, frames, mountFlow, node, pos, waitFor } from './helpers.js';

afterEach(cleanup);

const sized = { width: 100, height: 50 };
const make = () =>
  mountFlow({
    nodes: [
      node('a', 0, 0, sized),
      node('b', 300, 200, sized),
      node('c', 600, 100, sized),
      node('d', 300, 400, sized),
    ],
  });

type Phase = 'start' | 'live' | 'end';
const move = (
  flow: Awaited<ReturnType<typeof make>>,
  phase: Phase,
  id: string,
  x: number,
  y: number,
) =>
  flow.store.triggerNodeChanges(
    [{ id, type: 'position', position: { x, y }, dragging: phase !== 'end' }],
    { phase, origin: 'drag', gestureId: 'g1' },
  );

describe('installHelperLines', () => {
  it('snaps a dragged node onto aligned edges and publishes guides', async () => {
    const flow = await make();
    const seen: (HelperGuides | null)[] = [];
    const stop = installHelperLines(flow, { onChange: (g) => seen.push(g) });
    move(flow, 'start', 'b', 4, 103);
    // left-left with a (x 0), top-top with c (y 100)
    expect(pos(flow, 'b')).toEqual({ x: 0, y: 100 });
    expect(stop.guides).toEqual({
      vertical: { x: 0, y1: 0, y2: 150 },
      horizontal: { y: 100, x1: 0, x2: 700 },
    });
    expect(seen.at(-1)).toEqual(stop.guides);
    stop();
  });

  it('supports every anchor pair: left/right, right/left, right/right, centres', async () => {
    const flow = await make();
    const stop = installHelperLines(flow);
    // dragged right edge (x+100) onto a's left edge (0): x = -100 + 3
    move(flow, 'start', 'b', -97, 300);
    expect(pos(flow, 'b')!.x).toBe(-100);
    // dragged left edge onto a's right edge (100)
    move(flow, 'live', 'b', 104, 300);
    expect(pos(flow, 'b')!.x).toBe(100);
    // right onto right (a: 100): x = 0
    move(flow, 'live', 'b', 3, 300);
    // left-left also matches here (0); both give x = 0 or 0, closest wins
    expect(pos(flow, 'b')!.x).toBe(0);
    // centres: a centre x 50 -> b x = 0 is also centre-aligned; use c (600..700, centre 650)
    move(flow, 'live', 'b', 652 - 50 + 0, 300);
    expect(pos(flow, 'b')!.x).toBe(600);
    // vertical axis: centre of d (y 400..450 centre 425) -> b.y = 400
    move(flow, 'live', 'b', 350, 403);
    expect(pos(flow, 'b')!.y).toBe(400);
    move(flow, 'end', 'b', 350, 403);
    stop();
  });

  it('snaps on the end phase too (the engine reports the raw pointer position there)', async () => {
    const flow = await make();
    const stop = installHelperLines(flow);
    move(flow, 'start', 'b', 4, 103);
    move(flow, 'live', 'b', 5, 104);
    move(flow, 'end', 'b', 5, 104);
    expect(pos(flow, 'b')).toEqual({ x: 0, y: 100 });
    expect(stop.guides).toBeNull();
    stop();
  });

  it('uses a threshold in screen pixels (divided by zoom)', async () => {
    const flow = await make();
    flow.store.setState({ transform: [0, 0, 2] });
    const stop = installHelperLines(flow, { threshold: 6 });
    // range = 3 flow units at zoom 2
    move(flow, 'start', 'b', 4, 450);
    expect(pos(flow, 'b')).toEqual({ x: 4, y: 450 });
    move(flow, 'live', 'b', 3, 450);
    expect(pos(flow, 'b')!.x).toBe(0);
    stop();
  });

  it('does not move the node with snap: false but still publishes guides', async () => {
    const flow = await make();
    const stop = installHelperLines(flow, { snap: false });
    move(flow, 'start', 'b', 4, 103);
    expect(pos(flow, 'b')).toEqual({ x: 4, y: 103 });
    expect(stop.guides?.vertical?.x).toBe(0);
    stop();
  });

  it('leaves multi-node drags alone', async () => {
    const flow = await make();
    const stop = installHelperLines(flow);
    flow.store.triggerNodeChanges(
      [
        { id: 'b', type: 'position', position: { x: 4, y: 103 }, dragging: true },
        { id: 'd', type: 'position', position: { x: 304, y: 403 }, dragging: true },
      ],
      { phase: 'start', origin: 'drag', gestureId: 'g' },
    );
    expect(pos(flow, 'b')).toEqual({ x: 4, y: 103 });
    expect(stop.guides).toBeNull();
    stop();
  });

  it('ignores hidden nodes, children of the dragged node, and non-drag changes', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0, { ...sized, hidden: true }),
        node('b', 300, 200, sized),
        node('kid', 500, 0, { ...sized }),
      ],
    });
    const stop = installHelperLines(flow);
    move(flow, 'start', 'b', 4, 103);
    expect(pos(flow, 'b')).toEqual({ x: 4, y: 103 });
    flow.store.triggerNodeChanges([{ id: 'b', type: 'position', position: { x: 502, y: 3 } }], {
      phase: 'discrete',
      origin: 'keyboard',
    });
    expect(pos(flow, 'b')).toEqual({ x: 502, y: 3 });
    stop();
  });

  it('renders two lines in flow coordinates with stroke 1/zoom and clears at the end', async () => {
    const flow = await make();
    flow.store.setState({ transform: [0, 0, 2] });
    const stop = installHelperLines(flow);
    const el = flow.querySelector('xy-helper-lines')!;
    expect(el.getAttribute('slot')).toBe('viewport-front');
    move(flow, 'start', 'b', 2, 449);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    const lines = el.shadowRoot!.querySelectorAll('line');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.getAttribute('stroke-width')).toBe('0.5');
    expect(lines[0]!.getAttribute('x1')).toBe('0');
    move(flow, 'end', 'b', 2, 449);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(el.shadowRoot!.querySelectorAll('line')).toHaveLength(0);
    stop();
    expect(flow.querySelector('xy-helper-lines')).toBeNull();
  });

  it('snaps a real drag and composes with LocalHistory (one undoable step to the snapped spot)', async () => {
    const flow = await make();
    const history = new LocalHistory(flow);
    const stop = installHelperLines(flow);
    // XYDrag loses the first of the 8 pointer steps: 7/8 of (-338, -111) lands about 4 px off the guides
    await dragNode(flow, 'b', -338, -111, 8);
    await waitFor(() => pos(flow, 'b')!.x === 0);
    expect(pos(flow, 'b')).toEqual({ x: 0, y: 100 });
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(pos(flow, 'b')).toEqual({ x: 300, y: 200 });
    history.redo();
    expect(pos(flow, 'b')).toEqual({ x: 0, y: 100 });
    await frames(1);
    stop();
  });
});
