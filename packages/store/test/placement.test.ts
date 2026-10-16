import { describe, expect, it } from 'vitest';
import { NodeSpatialIndex, findFreePosition } from '../src/placement.js';
import { getEdgeEndLabelPosition } from '../src/edges/end-labels.js';
import { Position } from '../src/engine.js';
import { createStore, node } from './helpers.js';

const small = (id: string) =>
  node(id, 0, 0, { width: 10, height: 10, measured: { width: 10, height: 10 } });
const unplaced = (id: string) => {
  const { position: _position, ...rest } = small(id);
  void _position;
  return { ...rest, id };
};
const SIZE = { width: 10, height: 10 };

describe('findFreePosition', () => {
  it('returns the centred position in an empty flow', () => {
    const { store } = createStore();
    expect(store.instance.findFreePosition(SIZE, { around: { x: 0, y: 0 } })).toEqual({
      x: -5,
      y: -5,
    });
  });

  it('follows a spiral: top edge left to right, right edge down, bottom edge right to left, left edge up', () => {
    const { store } = createStore();
    const placement = { around: { x: 0, y: 0 }, step: 20, gap: 0 };
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) {
      store.instance.addNodes(unplaced(`n${i}`), { placement });
      positions.push(store.getState().nodes[i]!.position);
    }
    expect(positions).toEqual([
      { x: -5, y: -5 }, // ring 0
      { x: -25, y: -25 }, // ring 1: top-left
      { x: -5, y: -25 }, // top
      { x: 15, y: -25 }, // top-right
      { x: 15, y: -5 }, // right
      { x: 15, y: 15 }, // bottom-right
      { x: -5, y: 15 }, // bottom
      { x: -25, y: 15 }, // bottom-left
      { x: -25, y: -5 }, // left
    ]);
  });

  it('batch placement in one addNodes call gives the same sequence (no self-overlap)', () => {
    const { store } = createStore();
    store.instance.addNodes(
      Array.from({ length: 9 }, (_, i) => unplaced(`n${i}`)),
      { placement: { around: { x: 0, y: 0 }, step: 20, gap: 0 } },
    );
    expect(store.getState().nodes.map((n) => n.position)).toEqual([
      { x: -5, y: -5 },
      { x: -25, y: -25 },
      { x: -5, y: -25 },
      { x: 15, y: -25 },
      { x: 15, y: -5 },
      { x: 15, y: 15 },
      { x: -5, y: 15 },
      { x: -25, y: 15 },
      { x: -25, y: -5 },
    ]);
  });

  it('keeps the gap to existing nodes', () => {
    const { store } = createStore({ nodes: [node('a', 0, 0)] }); // 100x50 at the origin
    const p = store.instance.findFreePosition(
      { width: 20, height: 20 },
      { around: { x: 50, y: 25 }, step: 10, gap: 30 },
    );
    const overlapsInflated = p.x < 100 + 30 && p.x + 20 > -30 && p.y < 50 + 30 && p.y + 20 > -30;
    // inclusive collision: touching the inflated border is a collision too
    expect(overlapsInflated).toBe(false);
  });

  it('defaults to a gap of 20 and a step of 20', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0, { width: 100, height: 100, measured: { width: 100, height: 100 } })],
    });
    const p = store.instance.findFreePosition(SIZE, { around: { x: 50, y: 50 } });
    const rectRight = p.x >= 120 || p.x + 10 <= -20 || p.y >= 120 || p.y + 10 <= -20;
    expect(rectRight).toBe(true);
  });

  it('snaps candidates to the grid when snapToGrid is on and uses its width as the step', () => {
    const { store } = createStore({ snapToGrid: true, snapGrid: [20, 20] });
    expect(store.instance.findFreePosition(SIZE, { around: { x: 0, y: 0 } })).toEqual({
      x: 0,
      y: 0,
    });
    store.instance.addNodes(unplaced('a'), { placement: { around: { x: 0, y: 0 }, gap: 0 } });
    expect(store.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
    store.instance.addNodes(unplaced('b'), { placement: { around: { x: 0, y: 0 }, gap: 0 } });
    // first candidate on ring 1 is (-20, -20) centre => top-left (-25, -25) => snapped to (-20, -20)
    expect(store.getState().nodes[1]?.position).toEqual({ x: -20, y: -20 });
    for (const n of store.getState().nodes) {
      expect(n.position.x % 20 === 0 && n.position.y % 20 === 0).toBe(true);
    }
  });

  it('converts the top-left corner to a position using the node origin', () => {
    const { store } = createStore({ nodeOrigin: [0.5, 0.5] });
    expect(
      store.instance.findFreePosition({ width: 40, height: 20 }, { around: { x: 100, y: 100 } }),
    ).toEqual({ x: 100, y: 100 });
    store.setOptions({ nodeOrigin: [1, 1] });
    expect(
      store.instance.findFreePosition({ width: 40, height: 20 }, { around: { x: 100, y: 100 } }),
    ).toEqual({ x: 120, y: 110 });
    store.setOptions({ nodeOrigin: [0, 0] });
    expect(
      store.instance.findFreePosition({ width: 40, height: 20 }, { around: { x: 100, y: 100 } }),
    ).toEqual({ x: 80, y: 90 });
  });

  it('uses a node-specific origin for addNodes', () => {
    const { store } = createStore();
    store.instance.addNodes(
      { ...unplaced('a'), origin: [0.5, 0.5] },
      { placement: { around: { x: 100, y: 100 } } },
    );
    expect(store.getState().nodes[0]?.position).toEqual({ x: 100, y: 100 });
  });

  it('centres on the viewport by default, honouring the transform', () => {
    const { store } = createStore();
    store.setState({ width: 200, height: 100, transform: [100, 50, 2] });
    expect(store.instance.findFreePosition(SIZE)).toEqual({ x: -5, y: -5 });
    store.setState({ transform: [0, 0, 1] });
    expect(store.instance.findFreePosition(SIZE, { around: 'viewport-center' })).toEqual({
      x: 95,
      y: 45,
    });
  });

  it('uses the last pointer position for "pointer", falling back to the viewport centre', () => {
    const { store } = createStore();
    store.setState({ width: 200, height: 100 });
    expect(store.instance.findFreePosition(SIZE, { around: 'pointer' })).toEqual({ x: 95, y: 45 });
    store.setState({ lastPointerFlowPosition: { x: 500, y: 600 } });
    expect(store.instance.findFreePosition(SIZE, { around: 'pointer' })).toEqual({
      x: 495,
      y: 595,
    });
  });

  it('returns the centred position when nothing is free within maxRings', () => {
    const { store } = createStore({
      nodes: [
        node('big', -1000, -1000, {
          width: 2000,
          height: 2000,
          measured: { width: 2000, height: 2000 },
        }),
      ],
    });
    expect(
      store.instance.findFreePosition(SIZE, { around: { x: 0, y: 0 }, maxRings: 3, step: 20 }),
    ).toEqual({ x: -5, y: -5 });
  });

  it('ignores hidden nodes and treats unmeasured nodes as the default size', () => {
    const { store } = createStore({
      nodes: [
        node('hidden', 0, 0, { hidden: true }),
        node('bare', 500, 500, { width: undefined, height: undefined, measured: undefined }),
      ],
    });
    expect(store.instance.findFreePosition(SIZE, { around: { x: 5, y: 5 } })).toEqual({
      x: 0,
      y: 0,
    });
    // the unmeasured node occupies 150x40 from (500, 500)
    const p = store.instance.findFreePosition(SIZE, {
      around: { x: 600, y: 520 },
      gap: 0,
      step: 10,
    });
    expect(p.x + 10 <= 500 || p.x >= 650 || p.y + 10 <= 500 || p.y >= 540).toBe(true);
  });

  it('is exported as a function of the store', () => {
    const { store } = createStore();
    expect(findFreePosition(store, SIZE, { around: { x: 0, y: 0 } })).toEqual({ x: -5, y: -5 });
  });
});

describe('NodeSpatialIndex', () => {
  it('inflates queries by the gap, counts touching as colliding, and accepts inserts', () => {
    const { store } = createStore({ nodes: [node('a', 0, 0)] });
    const index = new NodeSpatialIndex(store.getState().nodeLookup, 10);
    expect(index.collides({ x: 105, y: 0, width: 10, height: 10 })).toBe(true); // within the gap
    expect(index.collides({ x: 110, y: 0, width: 10, height: 10 })).toBe(true); // touches the inflated border
    expect(index.collides({ x: 111, y: 0, width: 10, height: 10 })).toBe(false);
    expect(index.collides({ x: 0, y: 200, width: 10, height: 10 })).toBe(false);
    index.insert({ x: 0, y: 200, width: 10, height: 10 });
    expect(index.collides({ x: 0, y: 205, width: 10, height: 10 })).toBe(true);
  });

  it('can exclude nodes (ancestors)', () => {
    const { store } = createStore({ nodes: [node('a', 0, 0), node('b', 500, 0)] });
    const index = new NodeSpatialIndex(store.getState().nodeLookup, 0, new Set(['a']));
    expect(index.collides({ x: 10, y: 10, width: 10, height: 10 })).toBe(false);
    expect(index.collides({ x: 510, y: 10, width: 10, height: 10 })).toBe(true);
  });
});

describe('getEdgeEndLabelPosition', () => {
  const p = (sp: Position, tp: Position) => ({
    sourceX: 100,
    sourceY: 100,
    targetX: 300,
    targetY: 200,
    sourcePosition: sp,
    targetPosition: tp,
  });

  it('moves along the handle direction and sideways with the defaults 14 / 10', () => {
    // right: dir (1,0), normal (0,1)
    expect(getEdgeEndLabelPosition(p(Position.Right, Position.Left), { end: 'source' })).toEqual({
      x: 114,
      y: 110,
    });
    // left: dir (-1,0), normal (0,-1)
    expect(getEdgeEndLabelPosition(p(Position.Right, Position.Left), { end: 'target' })).toEqual({
      x: 286,
      y: 190,
    });
    // top: dir (0,-1), normal (1,0)
    expect(getEdgeEndLabelPosition(p(Position.Top, Position.Bottom), { end: 'source' })).toEqual({
      x: 110,
      y: 86,
    });
    // bottom: dir (0,1), normal (-1,0)
    expect(getEdgeEndLabelPosition(p(Position.Top, Position.Bottom), { end: 'target' })).toEqual({
      x: 290,
      y: 214,
    });
  });

  it('honours distance and normalOffset', () => {
    expect(
      getEdgeEndLabelPosition(p(Position.Right, Position.Left), {
        end: 'source',
        distance: 30,
        normalOffset: 0,
      }),
    ).toEqual({ x: 130, y: 100 });
    expect(
      getEdgeEndLabelPosition(p(Position.Right, Position.Left), {
        end: 'source',
        distance: 0,
        normalOffset: -5,
      }),
    ).toEqual({ x: 100, y: 95 });
  });
});
