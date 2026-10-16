import { describe, expect, it } from 'vitest';
import {
  createMarkerDefs,
  getCustomMarkerId,
  getMarkerUrl,
  resolveMarkerId,
} from '../src/markers.js';
import { MarkerType } from '../src/engine.js';
import type { CustomEdgeMarker } from '../src/types/edges.js';
import { createStore, edge, node } from './helpers.js';

const opts = { flowId: '1', defaultColor: '#b1b1b7' };

describe('createMarkerDefs: upstream markers', () => {
  it('produces upstream ids like 1__type=arrowclosed with the default colour', () => {
    const defs = createMarkerDefs(
      [edge('e', 'a', 'b', { markerEnd: { type: MarkerType.ArrowClosed } })],
      opts,
    );
    expect(defs).toEqual([{ id: '1__type=arrowclosed', color: '#b1b1b7', type: 'arrowclosed' }]);
  });

  it('includes markerStart and markerEnd, dedupes and sorts by id', () => {
    const defs = createMarkerDefs(
      [
        edge('e1', 'a', 'b', {
          markerEnd: { type: MarkerType.ArrowClosed },
          markerStart: { type: MarkerType.Arrow, color: 'red' },
        }),
        edge('e2', 'a', 'b', { markerEnd: { type: MarkerType.ArrowClosed } }),
      ],
      opts,
    );
    expect(defs.map((d) => d.id)).toEqual(['1__color=red&type=arrow', '1__type=arrowclosed']);
    expect(defs[0]).toMatchObject({ color: 'red', type: 'arrow' });
  });

  it('ignores string markers and edges without markers', () => {
    const defs = createMarkerDefs(
      [edge('e1', 'a', 'b', { markerEnd: 'my-own-marker' }), edge('e2', 'a', 'b')],
      opts,
    );
    expect(defs).toEqual([]);
  });

  it('takes defaults from defaultEdgeOptions when the edge has none', () => {
    const defs = createMarkerDefs(
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'b', { markerEnd: 'x' })],
      {
        ...opts,
        defaultEdgeOptions: { markerEnd: { type: MarkerType.Arrow } },
      },
    );
    expect(defs.map((d) => d.id)).toEqual(['1__type=arrow']);
  });

  it('prefixes ids with the flow id', () => {
    const defs = createMarkerDefs(
      [edge('e', 'a', 'b', { markerEnd: { type: MarkerType.Arrow } })],
      { ...opts, flowId: 'flow-2' },
    );
    expect(defs[0]?.id).toBe('flow-2__type=arrow');
  });
});

describe('createMarkerDefs: custom markers', () => {
  const heart: CustomEdgeMarker = { type: 'custom', path: 'M0 0 L5 5', width: 10 };

  it('hashes the spec; id is stable across key order and calls', () => {
    const reordered = { width: 10, path: 'M0 0 L5 5', type: 'custom' } as CustomEdgeMarker;
    const id = getCustomMarkerId(heart, '1');
    expect(id).toMatch(/^1__custom-[0-9a-z]+$/);
    expect(getCustomMarkerId(reordered, '1')).toBe(id);
    expect(getCustomMarkerId({ ...heart }, '1')).toBe(id);
    expect(getCustomMarkerId(heart, '2')).toBe(`2__custom-${id.split('custom-')[1]}`);
  });

  it('different specs get different ids; undefined fields do not matter', () => {
    expect(getCustomMarkerId({ ...heart, width: 11 }, '1')).not.toBe(getCustomMarkerId(heart, '1'));
    expect(getCustomMarkerId({ ...heart, color: undefined }, '1')).toBe(
      getCustomMarkerId(heart, '1'),
    );
  });

  it('is deterministic (fixed expected value)', () => {
    expect(getCustomMarkerId({ type: 'custom', path: 'M0 0' }, '1')).toBe(
      getCustomMarkerId({ path: 'M0 0', type: 'custom' }, '1'),
    );
    expect(getCustomMarkerId({ type: 'custom', path: 'M0 0' }, '1')).toBe('1__custom-vz53em');
  });

  it('creates one def per distinct spec and resolves the default colour', () => {
    const defs = createMarkerDefs(
      [
        edge('e1', 'a', 'b', { markerEnd: heart }),
        edge('e2', 'a', 'b', { markerEnd: { ...heart }, markerStart: { ...heart, path: 'M1 1' } }),
        edge('e3', 'a', 'b', { markerEnd: { type: MarkerType.Arrow } }),
      ],
      opts,
    );
    expect(defs).toHaveLength(3);
    // upstream first, then custom sorted by id
    expect(defs[0]).toMatchObject({ id: '1__type=arrow' });
    const custom = defs.slice(1);
    expect(custom.every((d) => d.type === 'custom' && d.color === '#b1b1b7')).toBe(true);
    expect(new Set(custom.map((d) => d.id)).size).toBe(2);
    expect(custom.map((d) => d.id)).toEqual([...custom.map((d) => d.id)].sort());
  });

  it('keeps an explicit colour and does not mutate the user marker', () => {
    const marker: CustomEdgeMarker = { ...heart, color: 'tomato' };
    const defs = createMarkerDefs([edge('e', 'a', 'b', { markerEnd: marker })], opts);
    expect(defs[0]).toMatchObject({ color: 'tomato', path: 'M0 0 L5 5' });
    expect(marker).not.toHaveProperty('id');
  });

  it('does not let a custom marker pick up the default marker of defaultEdgeOptions', () => {
    const defs = createMarkerDefs([edge('e', 'a', 'b', { markerEnd: heart })], {
      ...opts,
      defaultEdgeOptions: { markerEnd: { type: MarkerType.Arrow } },
    });
    expect(defs.map((d) => d.type)).toEqual(['custom']);
  });
});

describe('getMarkerUrl / resolveMarkerId', () => {
  it('returns undefined for no marker', () => {
    expect(getMarkerUrl(undefined, '1')).toBeUndefined();
  });

  it('string markers are used as ids', () => {
    expect(getMarkerUrl('my-marker', '1')).toBe("url('#my-marker')");
    expect(resolveMarkerId('my-marker', '1')).toBe('my-marker');
  });

  it('upstream markers resolve to the createMarkerIds id', () => {
    expect(getMarkerUrl({ type: MarkerType.ArrowClosed }, '1')).toBe("url('#1__type=arrowclosed')");
    const [def] = createMarkerDefs(
      [edge('e', 'a', 'b', { markerEnd: { type: MarkerType.ArrowClosed, color: 'red' } })],
      opts,
    );
    expect(getMarkerUrl({ type: MarkerType.ArrowClosed, color: 'red' }, '1')).toBe(
      `url('#${def?.id}')`,
    );
  });

  it('custom markers resolve to their hashed id, matching the def', () => {
    const marker: CustomEdgeMarker = { type: 'custom', path: 'M0 0' };
    const [def] = createMarkerDefs([edge('e', 'a', 'b', { markerEnd: marker })], opts);
    expect(getMarkerUrl(marker, '1')).toBe(`url('#${def?.id}')`);
  });
});

describe('store.getMarkerDefs', () => {
  it('is memoised on edges, default edge options, colour and flow id', () => {
    const { store } = createStore({
      nodes: [node('a'), node('b')],
      edges: [edge('e', 'a', 'b', { markerEnd: { type: MarkerType.Arrow } })],
    });
    const first = store.getMarkerDefs();
    expect(first.map((d) => d.id)).toEqual(['1__type=arrow']);
    expect(store.getMarkerDefs()).toBe(first);
    store.setState({ width: 5 });
    expect(store.getMarkerDefs()).toBe(first);
    store.setOptions({ defaultMarkerColor: 'red' });
    const second = store.getMarkerDefs();
    expect(second).not.toBe(first);
    expect(second[0]).toMatchObject({ color: 'red' });
    store.setOptions({ flowId: 'x' });
    expect(store.getMarkerDefs()[0]?.id).toBe('x__type=arrow');
  });
});
