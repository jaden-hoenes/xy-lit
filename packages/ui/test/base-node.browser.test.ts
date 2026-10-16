import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import * as ui from '../src/index.js';
import { statusIndicator, uiStyles } from '../src/index.js';
import type { NodeStatus } from '../src/index.js';
import { cleanup, frames, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

type CardData = { status?: NodeStatus; header?: boolean; footer?: boolean };
const card = defineNodeType<Node<CardData>>({
  styles: uiStyles,
  render: ({ data, selected }) =>
    statusIndicator(
      data.status ?? 'initial',
      html`<xy-base-node class="xy-ui-node" ?selected=${selected}>
        ${data.header ? html`<div slot="header">Title</div>` : ''}
        <p class="body">Body</p>
        ${data.footer ? html`<div slot="footer">Footer</div>` : ''}
        <xy-handle type="target" position="left"></xy-handle>
        <xy-handle type="source" position="right"></xy-handle>
      </xy-base-node>`,
    ),
});

describe('package exports', () => {
  it('registers every element and exports the node and edge type maps', () => {
    for (const tag of [
      'xy-base-node',
      'xy-zoom-slider',
      'xy-zoom-select',
      'xy-node-search',
      'xy-devtools',
      'xy-devtools-inspector',
    ]) {
      expect(customElements.get(tag), tag).toBeDefined();
    }
    expect(Object.keys(ui.uiNodeTypes).sort()).toEqual([
      'databaseSchema',
      'labeledGroup',
      'placeholder',
      'shape',
    ]);
    expect(Object.keys(ui.uiEdgeTypes).sort()).toEqual(['animatedSvg', 'button', 'data']);
  });
});

describe('<xy-base-node>', () => {
  it('has header, content and footer parts and only shows header/footer when slotted', async () => {
    const flow = await mountFlow({
      nodes: [
        node('plain', 0, 0, { type: 'card', data: {} }),
        node('full', 300, 0, { type: 'card', data: { header: true, footer: true } }),
      ],
      props: { nodeTypes: { card } },
    });
    const parts = (id: string) => {
      const el = nodeEl(flow, id).querySelector('xy-base-node') as HTMLElement;
      const root = el.shadowRoot as ShadowRoot;
      return {
        el,
        header: root.querySelector<HTMLElement>('[part="header"]')!,
        content: root.querySelector<HTMLElement>('[part="content"]')!,
        footer: root.querySelector<HTMLElement>('[part="footer"]')!,
      };
    };
    await waitFor(() => parts('full').header.hidden === false);
    expect(parts('plain').header.hidden).toBe(true);
    expect(parts('plain').footer.hidden).toBe(true);
    expect(parts('full').footer.hidden).toBe(false);
    expect(parts('full').content.querySelector('slot')).not.toBeNull();
    // the slotted header text is projected into the header slot
    const slot = parts('full').header.querySelector('slot') as HTMLSlotElement;
    expect(slot.assignedElements()[0]?.textContent).toBe('Title');
  });

  it('never renders handles in its own template, and the slotted handles are measured', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'card', data: {} })],
      props: { nodeTypes: { card } },
    });
    const base = nodeEl(flow, 'a').querySelector('xy-base-node') as HTMLElement;
    expect(base.shadowRoot?.querySelector('xy-handle')).toBeNull();
    const internal = await waitFor(() => {
      const n = flow.getInternalNode('a');
      return n?.internals.handleBounds?.source?.length ? n : undefined;
    });
    expect(internal.internals.handleBounds?.source).toHaveLength(1);
    expect(internal.internals.handleBounds?.target).toHaveLength(1);
  });

  it('reflects selected from the node and draws the accent ring', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0, { type: 'card', data: {}, selected: true }),
        node('b', 300, 0, { type: 'card', data: {} }),
      ],
      props: { nodeTypes: { card } },
    });
    const a = nodeEl(flow, 'a').querySelector('xy-base-node') as HTMLElement;
    const b = nodeEl(flow, 'b').querySelector('xy-base-node') as HTMLElement;
    expect(a.hasAttribute('selected')).toBe(true);
    expect(b.hasAttribute('selected')).toBe(false);
    expect(getComputedStyle(a).boxShadow).not.toBe(getComputedStyle(b).boxShadow);
    flow.updateNode('b', { selected: true });
    await waitFor(() => b.hasAttribute('selected'));
  });

  it('follows the flow colour mode through the node tokens', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'card', data: {} })],
      props: { nodeTypes: { card } },
    });
    const base = nodeEl(flow, 'a').querySelector('xy-base-node') as HTMLElement;
    const light = getComputedStyle(base).backgroundColor;
    flow.colorMode = 'dark';
    await flow.updateComplete;
    await frames(2);
    expect(getComputedStyle(base).backgroundColor).not.toBe(light);
  });
});

describe('statusIndicator()', () => {
  it('sets data-status and aria-busy, with a ring that is not hit-testable', async () => {
    const flow = await mountFlow({
      nodes: (['initial', 'loading', 'success', 'error'] as const).map((status, i) =>
        node(status, i * 260, 0, { type: 'card', data: { status } }),
      ),
      props: { nodeTypes: { card } },
    });
    for (const status of ['initial', 'loading', 'success', 'error']) {
      const el = nodeEl(flow, status).querySelector<HTMLElement>('.xy-ui-status')!;
      expect(el.dataset.status).toBe(status);
      expect(el.getAttribute('aria-busy')).toBe(status === 'loading' ? 'true' : 'false');
      const ring = el.querySelector<HTMLElement>('.xy-ui-status__ring')!;
      expect(getComputedStyle(ring).pointerEvents).toBe('none');
      expect(getComputedStyle(ring).opacity).toBe(status === 'initial' ? '0' : '1');
    }
    // the ring is outside the content box and does not change the node size
    const loading = nodeEl(flow, 'loading').getBoundingClientRect();
    const initial = nodeEl(flow, 'initial').getBoundingClientRect();
    expect(loading.width).toBeCloseTo(initial.width, 0);
    const animated = getComputedStyle(
      nodeEl(flow, 'loading').querySelector('.xy-ui-status__ring') as Element,
      '::before',
    ).animationName;
    expect(animated).toBe('xy-ui-spin');
  });

  it('swaps the status when the node data changes', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'card', data: { status: 'loading' } })],
      props: { nodeTypes: { card } },
    });
    flow.updateNodeData('a', { status: 'success' });
    await waitFor(
      () =>
        nodeEl(flow, 'a').querySelector<HTMLElement>('.xy-ui-status')?.dataset.status === 'success',
    );
  });
});
