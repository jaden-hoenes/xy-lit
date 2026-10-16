import { afterEach, describe, expect, it } from 'vitest';
import type { Node } from '@xy-lit/flow';
import type { XyNodeSearchElement } from '../src/index.js';
import { cleanup, mountFlow, node, rendered, waitFor } from './helpers.js';

afterEach(cleanup);

const nodes = [
  node('n1', 0, 0, { data: { label: 'Fetch data' } }),
  node('n2', 1200, 800, { data: { label: 'Transform rows' } }),
  node('n3', -900, 400, { data: { label: 'Fetch metadata' } }),
  node('n4', 300, 300, { data: { label: '<img src=x onerror=alert(1)>' } }),
  node('n5', 500, 500, { data: { label: 'Hidden fetch' }, hidden: true }),
];

async function mount(setup?: (el: XyNodeSearchElement) => void) {
  const search = document.createElement('xy-node-search') as XyNodeSearchElement;
  setup?.(search);
  const flow = await mountFlow({ nodes, children: [search] });
  await rendered(search);
  const root = search.shadowRoot!;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const type = async (text: string) => {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await search.updateComplete;
  };
  const options = () => [...root.querySelectorAll<HTMLElement>('[role="option"]')];
  const key = async (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    await search.updateComplete;
  };
  return { flow, search, root, input, type, options, key };
}

/** The flow position at the centre of the pane. */
const centre = (flow: {
  getViewport(): { x: number; y: number; zoom: number };
  clientWidth: number;
  clientHeight: number;
}) => {
  const v = flow.getViewport();
  return { x: (flow.clientWidth / 2 - v.x) / v.zoom, y: (flow.clientHeight / 2 - v.y) / v.zoom };
};

describe('<xy-node-search>', () => {
  it('is a combobox with a listbox, top-left by default', async () => {
    const { search, input, root } = await mount();
    expect(search.position).toBe('top-left');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    const list = root.querySelector('[role="listbox"]')!;
    expect(input.getAttribute('aria-controls')).toBe(list.id);
  });

  it('filters by data.label (case-insensitive, hidden nodes excluded) and by id', async () => {
    const { type, options } = await mount();
    await type('FETCH');
    expect(options().map((o) => o.querySelector('span')?.textContent)).toEqual([
      'Fetch data',
      'Fetch metadata',
    ]);
    await type('n2');
    expect(options().map((o) => o.querySelector('span')?.textContent)).toEqual(['Transform rows']);
    await type('');
    expect(options()).toHaveLength(0);
  });

  it('uses getLabel when given and limits the results to maxResults', async () => {
    const { type, options } = await mount((el) => {
      el.getLabel = (n: Node) => `node ${n.id}`;
      el.maxResults = 2;
    });
    await type('node');
    expect(options().map((o) => o.querySelector('span')?.textContent)).toEqual([
      'node n1',
      'node n2',
    ]);
  });

  it('highlights the match as text and never parses labels as HTML', async () => {
    const { type, options, root } = await mount();
    await type('onerror');
    const [first] = options();
    expect(first?.querySelector('mark')?.textContent).toBe('onerror');
    expect(root.querySelector('img')).toBeNull();
    expect(first?.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('says so when nothing matches', async () => {
    const { type, root } = await mount();
    await type('zzz');
    expect(root.querySelector('[role="status"]')?.textContent).toBe('No nodes found');
  });

  it('choosing a result selects the node and centres the viewport on it', async () => {
    const { flow, search, type, options } = await mount();
    const events: string[] = [];
    search.addEventListener('node-search-select', ((e: CustomEvent<{ node: Node }>) =>
      events.push(e.detail.node.id)) as unknown as EventListener);
    await type('transform');
    (options()[0] as HTMLElement).click();
    expect(events).toEqual(['n2']);
    await waitFor(() => flow.getNode('n2')?.selected === true);
    expect(
      flow
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
    ).toEqual(['n2']);
    const internal = flow.getInternalNode('n2')!;
    const target = {
      x: internal.internals.positionAbsolute.x + (internal.measured.width ?? 0) / 2,
      y: internal.internals.positionAbsolute.y + (internal.measured.height ?? 0) / 2,
    };
    await waitFor(() => {
      const c = centre(flow);
      return Math.abs(c.x - target.x) < 1 && Math.abs(c.y - target.y) < 1;
    });
    // the zoom is kept
    expect(flow.getZoom()).toBeCloseTo(1, 2);
  });

  it('applies the zoom property when centring', async () => {
    const { flow, type, options } = await mount((el) => {
      el.zoom = 1.5;
    });
    await type('metadata');
    (options()[0] as HTMLElement).click();
    await waitFor(() => Math.abs(flow.getZoom() - 1.5) < 0.01);
  });

  it('works with the keyboard: arrows move, Enter chooses, Escape clears', async () => {
    const { flow, type, options, key, input } = await mount();
    await type('fetch');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    await key('ArrowDown');
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1]?.id);
    await key('ArrowDown');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    await key('ArrowUp');
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    await key('Enter');
    await waitFor(() => flow.getNode('n3')?.selected === true);
    await type('fetch');
    await key('Escape');
    expect(input.value).toBe('');
    expect(options()).toHaveLength(0);
  });
});
