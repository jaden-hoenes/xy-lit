import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShapeRegistry, createDefaultShapes, defaultShapes, uiNodeTypes } from '../src/index.js';
import { cleanup, mountFlow, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

const NAMES = [
  'rectangle',
  'rounded-rectangle',
  'circle',
  'ellipse',
  'diamond',
  'hexagon',
  'parallelogram',
  'triangle',
  'cylinder',
  'document',
  'plus',
  'arrow-rectangle',
];

describe('ShapeRegistry and defaultShapes', () => {
  it('registers the twelve default shapes', () => {
    expect([...defaultShapes.names()].sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s: path, handles and text box are finite and inside the box', (name) => {
    const def = defaultShapes.get(name)!;
    for (const [w, h] of [
      [120, 80],
      [60, 60],
      [200, 40],
    ] as const) {
      const d = def.path(w, h);
      expect(d).toMatch(/^M/);
      expect(d).not.toMatch(/NaN|Infinity|undefined/);
      const handles = def.handles(w, h);
      expect(handles.map((p) => p.id)).toEqual(['top', 'right', 'bottom', 'left']);
      for (const p of handles) {
        expect(p.x).toBeGreaterThanOrEqual(-0.001);
        expect(p.x).toBeLessThanOrEqual(w + 0.001);
        expect(p.y).toBeGreaterThanOrEqual(-0.001);
        expect(p.y).toBeLessThanOrEqual(h + 0.001);
      }
      const t = def.textBox(w, h);
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(w + 0.001);
      expect(t.y + t.height).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it('supports register/get/names/has/clone without touching the defaults', () => {
    const custom = defaultShapes.clone();
    custom.register('star', {
      path: (w, h) => `M${w / 2} 0L${w} ${h}L0 ${h}Z`,
      handles: (w) => [{ id: 'tip', position: 'top', x: w / 2, y: 0 }],
      textBox: (w, h) => ({ x: 0, y: 0, width: w, height: h }),
    });
    expect(custom.has('star')).toBe(true);
    expect(custom.names()).toHaveLength(13);
    expect(defaultShapes.has('star')).toBe(false);
    expect(new ShapeRegistry().names()).toEqual([]);
    expect(createDefaultShapes()).not.toBe(defaultShapes);
  });
});

describe('shapeNode', () => {
  const mount = (data: Record<string, unknown>, extra = {}) =>
    mountFlow({
      nodes: [
        {
          id: 's',
          type: 'shape',
          position: { x: 20, y: 20 },
          width: 140,
          height: 90,
          data,
          ...extra,
        },
      ],
      props: { nodeTypes: uiNodeTypes },
    });

  it('draws the outline at the node size, with the label in the text box', async () => {
    const flow = await mount({ shape: 'diamond', label: 'Decision <i>?</i>', color: '#ff0000' });
    const el = nodeEl(flow, 's');
    const path = el.querySelector('.xy-ui-shape__path')!;
    expect(path.getAttribute('d')).toBe(defaultShapes.get('diamond')!.path(140, 90));
    expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 140 90');
    const text = el.querySelector<HTMLElement>('.xy-ui-shape__text')!;
    expect(text.textContent?.trim()).toBe('Decision <i>?</i>');
    expect(text.querySelector('i')).toBeNull();
    const box = defaultShapes.get('diamond')!.textBox(140, 90);
    expect(text.style.left).toBe(`${box.x}px`);
    expect(getComputedStyle(path).stroke).toBe('rgb(255, 0, 0)');
  });

  it('has a source and a target handle at every connection point', async () => {
    const flow = await mount({ shape: 'rectangle' });
    const el = nodeEl(flow, 's');
    const handles = [...el.querySelectorAll('xy-handle')];
    expect(handles).toHaveLength(8);
    const bounds = await waitFor(() => {
      const b = flow.getInternalNode('s')?.internals.handleBounds;
      return b?.source?.length === 4 && b;
    });
    expect(bounds.source?.map((h) => h.id).sort()).toEqual(['bottom', 'left', 'right', 'top']);
    expect(bounds.target?.map((h) => h.id).sort()).toEqual(['bottom', 'left', 'right', 'top']);
    // handle centres are at handles(w, h)
    const node = el.getBoundingClientRect();
    const right = el.querySelector('xy-handle.source[handle-id="right"]')!.getBoundingClientRect();
    expect(right.left + right.width / 2 - node.left).toBeCloseTo(140, 0);
    expect(right.top + right.height / 2 - node.top).toBeCloseTo(45, 0);
  });

  it('is a resizable node type with minimum 40x40 and redraws at the new size', async () => {
    expect(uiNodeTypes.shape.resizer).toEqual({ variant: 'handles', minWidth: 40, minHeight: 40 });
    const flow = await mount({ shape: 'ellipse' }, { selected: true });
    const el = nodeEl(flow, 's');
    expect(el.querySelector('xy-node-resizer')).not.toBeNull();
    flow.updateNode('s', { width: 200, height: 100 });
    await waitFor(() => el.querySelector('svg')?.getAttribute('viewBox') === '0 0 200 100');
    expect(el.querySelector('.xy-ui-shape__path')?.getAttribute('d')).toBe(
      defaultShapes.get('ellipse')!.path(200, 100),
    );
  });

  it('draws shapes from a custom registry', async () => {
    const registry = defaultShapes.clone().register('wedge', {
      path: (w, h) => `M0 0L${w} ${h / 2}L0 ${h}Z`,
      handles: (w, h) => [{ id: 'tip', position: 'right', x: w, y: h / 2, type: 'source' }],
      textBox: (w, h) => ({ x: 4, y: 4, width: w / 2, height: h - 8 }),
    });
    const flow = await mount({ shape: 'wedge', label: 'go', registry });
    const el = nodeEl(flow, 's');
    expect(el.querySelector('.xy-ui-shape__path')?.getAttribute('d')).toBe('M0 0L140 45L0 90Z');
    const handles = el.querySelectorAll('xy-handle');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('handle-id')).toBe('tip');
    expect(handles[0]?.classList.contains('source')).toBe(true);
  });

  it('falls back to a rectangle for an unknown shape and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const flow = await mount({ shape: 'no-such-shape-xyz' });
    expect(nodeEl(flow, 's').querySelector('.xy-ui-shape__path')?.getAttribute('d')).toBe(
      defaultShapes.get('rectangle')!.path(140, 90),
    );
    const calls = warn.mock.calls.filter((c) => String(c[0]).includes('no-such-shape-xyz'));
    warn.mockRestore();
    expect(calls).toHaveLength(1);
  });
});
