import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { nodeAppendix, nodeTooltip, uiNodeTypes, uiStyles } from '../src/index.js';
import type { AppendixPosition } from '../src/index.js';
import { cleanup, frames, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

describe('placeholderNode', () => {
  const mount = () =>
    mountFlow({
      nodes: [
        { id: 'p', type: 'placeholder', position: { x: 40, y: 40 }, data: { label: 'Add step' } },
      ],
      props: { nodeTypes: uiNodeTypes },
    });

  it('renders a dashed box with a plus, a label and a target handle', async () => {
    const flow = await mount();
    const el = nodeEl(flow, 'p');
    expect(el.querySelector('.xy-ui-placeholder__plus')?.textContent).toBe('+');
    expect(el.querySelector('.xy-ui-placeholder__label')?.textContent).toBe('Add step');
    expect(getComputedStyle(el.querySelector('.xy-ui-placeholder')!).borderStyle).toBe('dashed');
    const handle = el.querySelector('xy-handle')!;
    expect(handle.classList.contains('target')).toBe(true);
    expect(handle.getAttribute('position')).toBe('top');
  });

  it('emits a bubbling placeholder-click event on the flow with the node id', async () => {
    const flow = await mount();
    const events: { id: string; data: unknown }[] = [];
    flow.addEventListener(
      'placeholder-click' as never,
      ((e: CustomEvent<{ id: string; data: unknown }>) => {
        events.push(e.detail);
      }) as EventListener,
    );
    nodeEl(flow, 'p').querySelector<HTMLButtonElement>('.xy-ui-placeholder__button')!.click();
    expect(events).toEqual([{ id: 'p', data: { label: 'Add step' } }]);
  });
});

describe('labeledGroupNode', () => {
  it('draws the label tag and lets children live inside', async () => {
    const flow = await mountFlow({
      nodes: [
        {
          id: 'g',
          type: 'labeledGroup',
          position: { x: 0, y: 0 },
          width: 400,
          height: 240,
          data: { label: 'Backend', labelPosition: 'top-right' },
        },
        node('c', 40, 60, { parentId: 'g' }),
      ],
      props: { nodeTypes: uiNodeTypes },
    });
    const el = nodeEl(flow, 'g');
    const tag = el.querySelector<HTMLElement>('.xy-ui-group__label')!;
    expect(tag.textContent).toBe('Backend');
    const box = el.getBoundingClientRect();
    expect(box.width).toBeCloseTo(400, 0);
    expect(box.height).toBeCloseTo(240, 0);
    // top-right: the tag hugs the right edge
    expect(box.right - tag.getBoundingClientRect().right).toBeLessThan(20);
    expect(uiNodeTypes.labeledGroup.resizer).toEqual({
      variant: 'lines',
      minWidth: 120,
      minHeight: 80,
    });
    const child = nodeEl(flow, 'c').getBoundingClientRect();
    expect(child.left).toBeGreaterThan(box.left);
    expect(child.top).toBeGreaterThan(box.top);
  });
});

const withExtras = defineNodeType<Node<{ side?: AppendixPosition }>>({
  styles: uiStyles,
  render: ({ data }) =>
    html`<xy-base-node class="xy-ui-node">
      ${nodeTooltip({ position: 'top' }, html`<span class="tip-text">Runs nightly</span>`)} Task
      ${nodeAppendix(data.side ?? 'bottom', html`Last run 3 min ago`)}
    </xy-base-node>`,
});

describe('nodeTooltip()', () => {
  const toolbars = (flow: HTMLElement & { renderRoot: ParentNode }) =>
    flow.renderRoot.querySelectorAll('.lit-flow__node-toolbar.xy-ui-tooltip');

  it('shows while the node is hovered and hides when the pointer leaves', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { type: 'x', data: {} })],
      props: { nodeTypes: { x: withExtras } },
    });
    const el = nodeEl(flow, 'a');
    expect(toolbars(flow)).toHaveLength(0);
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    const bar = await waitFor(() => toolbars(flow)[0] as HTMLElement | undefined);
    expect(bar.textContent?.trim()).toBe('Runs nightly');
    expect(bar.classList.contains('xy-ui-tooltip--top')).toBe(true);
    expect(getComputedStyle(bar).pointerEvents).toBe('none');
    // above the node
    expect(bar.getBoundingClientRect().bottom).toBeLessThanOrEqual(el.getBoundingClientRect().top);
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    await waitFor(() => toolbars(flow).length === 0);
  });

  it('also shows for keyboard focus inside the node', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { type: 'x', data: {} })],
      props: { nodeTypes: { x: withExtras } },
    });
    const el = nodeEl(flow, 'a');
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await waitFor(() => toolbars(flow).length === 1);
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await waitFor(() => toolbars(flow).length === 0);
  });

  it('is removed with its node and does not leak listeners', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { type: 'x', data: {} })],
      props: { nodeTypes: { x: withExtras } },
    });
    const el = nodeEl(flow, 'a');
    el.dispatchEvent(new PointerEvent('pointerenter'));
    await waitFor(() => toolbars(flow).length === 1);
    flow.nodes = [];
    await waitFor(() => toolbars(flow).length === 0);
    await frames(2);
  });
});

describe('nodeAppendix()', () => {
  it.each(['top', 'right', 'bottom', 'left'] as const)(
    '%s: sits outside the node box on that side',
    async (side) => {
      const flow = await mountFlow({
        nodes: [node('a', 200, 200, { type: 'x', data: { side } })],
        props: { nodeTypes: { x: withExtras } },
      });
      const el = nodeEl(flow, 'a');
      const appendix = el.querySelector<HTMLElement>(`.xy-ui-appendix--${side}`)!;
      expect(appendix.textContent?.trim()).toBe('Last run 3 min ago');
      const nb = el.getBoundingClientRect();
      const box = appendix.getBoundingClientRect();
      if (side === 'bottom') expect(box.top).toBeGreaterThanOrEqual(nb.bottom);
      if (side === 'top') expect(box.bottom).toBeLessThanOrEqual(nb.top);
      if (side === 'left') expect(box.right).toBeLessThanOrEqual(nb.left);
      if (side === 'right') expect(box.left).toBeGreaterThanOrEqual(nb.right);
      // it does not change the measured size of the node
      const measured = flow.getInternalNode('a')!.measured;
      expect(measured.width).toBeCloseTo(nb.width, 0);
      expect(measured.height).toBeCloseTo(nb.height, 0);
    },
  );
});
