import { defaultAriaLabelConfig } from '@xy-lit/store/internal';
import { afterEach, describe, expect, it } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, edge, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

const byId = (flow: XyFlowElement, id: string): HTMLElement | null =>
  flow.renderRoot.querySelector<HTMLElement>(`[id="${id}"]`);

const keydown = (el: Element, key: string, init: KeyboardEventInit = {}): void => {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }),
  );
};

describe('a11y descriptions', () => {
  it('renders the node and edge descriptions and an assertive live region', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const nodeDesc = byId(flow, 'lit-flow__node-desc-1');
    const edgeDesc = byId(flow, 'lit-flow__edge-desc-1');
    const live = byId(flow, 'lit-flow__aria-live-1');
    // keyboard enabled: the text that mentions moving with the arrow keys
    expect(nodeDesc?.textContent?.trim()).toBe(
      defaultAriaLabelConfig['node.a11yDescription.keyboardDisabled'],
    );
    expect(edgeDesc?.textContent?.trim()).toBe(
      defaultAriaLabelConfig['edge.a11yDescription.default'],
    );
    expect(live?.getAttribute('aria-live')).toBe('assertive');
    expect(live?.getAttribute('aria-atomic')).toBe('true');
    expect(nodeEl(flow, 'a').getAttribute('aria-describedby')).toBe('lit-flow__node-desc-1');
  });

  it('the descriptions are hidden from sight and the live region is visually hidden', async () => {
    const flow = await mountFlow({ nodes: [] });
    expect(getComputedStyle(byId(flow, 'lit-flow__node-desc-1')!).display).toBe('none');
    const live = byId(flow, 'lit-flow__aria-live-1')!;
    const box = live.getBoundingClientRect();
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });

  it('disable-keyboard-a11y drops the live region and swaps the description', async () => {
    const flow = await mountFlow({ nodes: [node('a')], props: { disableKeyboardA11y: true } });
    expect(byId(flow, 'lit-flow__aria-live-1')).toBeNull();
    expect(byId(flow, 'lit-flow__node-desc-1')?.textContent?.trim()).toBe(
      defaultAriaLabelConfig['node.a11yDescription.default'],
    );
  });

  it('ariaLabelConfig overrides the texts and the id follows the flow id', async () => {
    const flow = await mountFlow({
      nodes: [node('a')],
      attributes: { id: 'x' },
      props: {
        ariaLabelConfig: {
          'edge.a11yDescription.default': 'Edge help',
          'node.a11yDescription.ariaLiveMessage': ({ direction }) => `went ${direction}`,
        },
      },
    });
    expect(byId(flow, 'lit-flow__edge-desc-x')?.textContent?.trim()).toBe('Edge help');
    const el = nodeEl(flow, 'a');
    el.focus();
    keydown(el, 'Enter');
    keydown(el, 'ArrowLeft');
    await waitFor(() => byId(flow, 'lit-flow__aria-live-x')?.textContent?.trim() === 'went left');
  });

  it('announces keyboard moves in the live region', async () => {
    const flow = await mountFlow({ nodes: [node('a', 10, 20)] });
    const el = nodeEl(flow, 'a');
    el.focus();
    keydown(el, 'Enter');
    keydown(el, 'ArrowUp');
    await waitFor(() => byId(flow, 'lit-flow__aria-live-1')?.textContent?.includes('up'));
    expect(byId(flow, 'lit-flow__aria-live-1')?.textContent).toContain('x: 10, y: 20');
  });
});

describe('edge keyboard', () => {
  const nodes = [node('a', 0, 0), node('b', 300, 0)];
  const g = (flow: XyFlowElement, id: string): SVGGElement =>
    flow.renderRoot.querySelector<SVGGElement>(`g[data-id="${id}"]`)!;

  it('is focusable with a role, a label and a description', async () => {
    const flow = await mountFlow({ nodes, edges: [edge('e', 'a', 'b')] });
    const el = g(flow, 'e');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-roledescription')).toBe('edge');
    expect(el.getAttribute('aria-label')).toBe('Edge from a to b');
    expect(el.getAttribute('aria-describedby')).toBe('lit-flow__edge-desc-1');
  });

  it('Enter and Space select, Escape unselects and blurs', async () => {
    const flow = await mountFlow({ nodes, edges: [edge('e', 'a', 'b')] });
    const el = g(flow, 'e');
    el.focus();
    keydown(el, 'Enter');
    expect(flow.getEdge('e')?.selected).toBe(true);
    keydown(el, 'Escape');
    expect(flow.getEdge('e')?.selected).toBeFalsy();
    expect((flow.renderRoot as ShadowRoot).activeElement).not.toBe(el);
    keydown(el, ' ');
    expect(flow.getEdge('e')?.selected).toBe(true);
  });

  it('other keys do nothing, and non-selectable edges ignore the keys', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e', 'a', 'b'), edge('n', 'a', 'b', { selectable: false })],
    });
    keydown(g(flow, 'e'), 'a');
    expect(flow.getEdge('e')?.selected).toBeFalsy();
    keydown(g(flow, 'n'), 'Enter');
    expect(flow.getEdge('n')?.selected).toBeFalsy();
  });

  it('focusable: false removes the tab stop and the keyboard handling', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e', 'a', 'b', { focusable: false })],
    });
    const el = g(flow, 'e');
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.getAttribute('role')).toBe('img');
    expect(el.hasAttribute('aria-describedby')).toBe(false);
    keydown(el, 'Enter');
    expect(flow.getEdge('e')?.selected).toBeFalsy();
  });

  it('disable-keyboard-a11y ignores the keys; ariaLabel null drops the label', async () => {
    const flow = await mountFlow({
      nodes,
      edges: [edge('e', 'a', 'b', { ariaLabel: null as unknown as string })],
      props: { disableKeyboardA11y: true },
    });
    const el = g(flow, 'e');
    expect(el.hasAttribute('aria-label')).toBe(false);
    keydown(el, 'Enter');
    expect(flow.getEdge('e')?.selected).toBeFalsy();
  });
});
