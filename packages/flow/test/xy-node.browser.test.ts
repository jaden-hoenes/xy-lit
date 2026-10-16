import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowNodeElement } from '../src/nodes/flow-node-element.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
import {
  cleanup,
  centerOf,
  dragMouse,
  frames,
  mountFlow,
  node,
  nodeEl,
  waitFor,
} from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<xy-node> host', () => {
  it('writes classes, data-id and a11y attributes', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { class: 'mine other', selected: true })],
    });
    const el = nodeEl(flow, 'a');
    expect(el.getAttribute('data-id')).toBe('a');
    expect(el.getAttribute('part')).toBe('node');
    for (const c of [
      'lit-flow__node',
      'lit-flow__node-default',
      'mine',
      'other',
      'selected',
      'draggable',
      'connectable',
      'selectable',
      'nopan',
    ]) {
      expect(el.classList.contains(c), c).toBe(true);
    }
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-roledescription')).toBe('node');
    expect(el.getAttribute('aria-describedby')).toBe('lit-flow__node-desc-1');
    expect(el.shadowRoot).toBeNull();
  });

  it('merges the style string with the managed properties', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 30, 40, { style: 'background: red; width: 99px' })],
    });
    const el = nodeEl(flow, 'a');
    expect(el.style.background).toContain('red');
    expect(el.style.transform).toBe('translate(30px, 40px)');
    expect(el.style.visibility).toBe('visible');
    // an explicit size wins; a style width is replaced when the node has a width
    flow.updateNode('a', { width: 120 });
    await waitFor(() => el.style.width === '120px');
    expect(el.style.background).toContain('red');
    // changing the style keeps the managed transform
    flow.updateNode('a', { style: 'background: blue' });
    await waitFor(() => el.style.background.includes('blue'));
    expect(el.style.transform).toBe('translate(30px, 40px)');
    expect(el.style.width).toBe('120px');
  });

  it('is hidden until it has been measured', async () => {
    const holder = document.createElement('div');
    holder.style.display = 'none';
    document.body.append(holder);
    try {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const flow = document.createElement('xy-flow');
      flow.style.cssText = 'display:block;width:400px;height:300px';
      flow.nodes = [node('a')];
      holder.append(flow);
      await flow.updateComplete;
      await frames(3);
      expect(nodeEl(flow, 'a').style.visibility).toBe('hidden');
      expect(flow.getNode('a')?.measured?.width).toBeUndefined();
      holder.style.display = 'block';
      await waitFor(() => nodeEl(flow, 'a').style.visibility === 'visible');
      expect(flow.getNode('a')?.measured?.width).toBeGreaterThan(0);
    } finally {
      holder.remove();
    }
  });

  it('applies only allowed domAttributes and removes vanished ones', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0, {
          domAttributes: {
            'data-x': '1',
            'aria-foo': 'bar',
            title: 't',
            onclick: 'alert(1)',
            style: 'x',
          },
        }),
      ],
    });
    const el = nodeEl(flow, 'a');
    expect(el.getAttribute('data-x')).toBe('1');
    expect(el.getAttribute('aria-foo')).toBe('bar');
    expect(el.getAttribute('title')).toBe('t');
    expect(el.hasAttribute('onclick')).toBe(false);
    expect(warn).toHaveBeenCalled();
    flow.updateNode('a', { domAttributes: { 'data-x': '2' } });
    await waitFor(() => el.getAttribute('data-x') === '2');
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('is not focusable with focusable: false and has no tabindex', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0, { focusable: false })] });
    expect(nodeEl(flow, 'a').hasAttribute('tabindex')).toBe(false);
  });

  it('falls back to the default type and reports 003 once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = document.createElement('xy-flow');
    const codes: string[] = [];
    flow.addEventListener('flow-error', (e) => {
      codes.push(e.detail.code);
    });
    flow.style.cssText = 'display:block;width:400px;height:300px';
    flow.nodes = [node('a', 0, 0, { type: 'nope' })];
    document.body.append(flow);
    try {
      await flow.whenRendered();
      expect(codes.filter((c) => c === '003')).toHaveLength(1);
      expect(nodeEl(flow, 'a').classList.contains('lit-flow__node-default')).toBe(true);
    } finally {
      flow.remove();
    }
  });
});

describe('<xy-node> content', () => {
  it('renders handles and text labels as text', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { data: { label: '<img src=x onerror=window.__pwned=1>' } })],
    });
    const el = nodeEl(flow, 'a');
    expect(el.textContent).toContain('<img src=x onerror=window.__pwned=1>');
    expect(el.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(el.querySelectorAll('xy-handle')).toHaveLength(2);
  });

  it('a position-only update does not call the renderer; a data update does', async () => {
    const render = vi.fn(
      ({ data }: { data: { label?: string } }) => html`<span>${data.label}</span>`,
    );
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'spy' })],
      props: { nodeTypes: { spy: defineNodeType({ render }) } },
    });
    await waitFor(() => flow.getNode('a')?.measured?.width);
    await frames(2);
    const before = render.mock.calls.length;
    flow.updateNode('a', { position: { x: 100, y: 50 } });
    await waitFor(() => nodeEl(flow, 'a').style.transform === 'translate(100px, 50px)');
    await frames(2);
    expect(render.mock.calls.length).toBe(before);
    flow.updateNodeData('a', { label: 'changed' });
    await waitFor(() => nodeEl(flow, 'a').textContent === 'changed');
    expect(render.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-renders on a position change when the type says usesPosition', async () => {
    const render = vi.fn(
      (p: { positionAbsoluteX: number }) => html`<span>${p.positionAbsoluteX}</span>`,
    );
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'pos' })],
      props: { nodeTypes: { pos: defineNodeType({ render, usesPosition: true }) } },
    });
    flow.updateNode('a', { position: { x: 70, y: 0 } });
    await waitFor(() => nodeEl(flow, 'a').textContent === '70');
  });

  it('measures again when the type changes', async () => {
    const wide = defineNodeType({
      render: () => html`<div style="width:300px;height:20px"></div>`,
    });
    const narrow = defineNodeType({
      render: () => html`<div style="width:100px;height:20px"></div>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'narrow', style: 'width:auto' })],
      props: { nodeTypes: { wide, narrow } },
    });
    await waitFor(() => flow.getNode('a')?.measured?.width !== undefined);
    flow.updateNode('a', { type: 'wide' });
    await waitFor(
      () =>
        flow.getNode('a')?.measured?.width === 300 + 22 ||
        flow.getNode('a')?.measured?.width === 300,
    );
  });

  it('measured size follows content changes without setting node.width', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'box', data: { w: 40 } })],
      props: {
        nodeTypes: {
          box: defineNodeType({
            render: (p) =>
              html`<div style="width:${(p.data as { w: number }).w}px;height:30px"></div>`,
          }),
        },
      },
    });
    flow.updateNodeData('a', { w: 80 });
    await waitFor(
      () =>
        flow.getNode('a')?.measured?.width === 80 || flow.getNode('a')?.measured?.width === 80 + 22,
    );
    expect(flow.getNode('a')?.width).toBeUndefined();
  });

  it('renders element node types by constructor and by tag name', async () => {
    class ByCtor extends FlowNodeElement {
      override render() {
        return html`<b class="by-ctor">${this.props.id}</b>`;
      }
    }
    class ByTag extends FlowNodeElement {
      override render() {
        return html`<i class="by-tag">${String(this.props.data.label)}</i
          ><xy-handle type="source"></xy-handle>`;
      }
    }
    const tag = `by-tag-${Math.random().toString(36).slice(2, 8)}`;
    customElements.define(tag, ByTag);
    customElements.define(`by-ctor-${tag.slice(7)}`, ByCtor);
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'c' }), node('b', 200, 0, { type: 't' })],
      props: { nodeTypes: { c: ByCtor, t: tag } },
    });
    await waitFor(() => nodeEl(flow, 'a').querySelector('.by-ctor'));
    expect(nodeEl(flow, 'a').querySelector('.by-ctor')?.textContent).toBe('a');
    await waitFor(() => nodeEl(flow, 'b').querySelector('.by-tag'));
    expect(nodeEl(flow, 'b').querySelector('.by-tag')?.textContent).toBe('b');
    const content = nodeEl(flow, 'b').querySelector(tag) as FlowNodeElement;
    expect(content.shadowRoot).toBeNull();
    expect(content.flow).toBe(flow.instance);
    // the handle inside the element node is found by the engine
    await waitFor(() => flow.getInternalNode('b')?.internals.handleBounds?.source?.length === 1);
  });

  it('adopts static styles of node types into the flow root', async () => {
    const { css } = await import('lit');
    const styles = css`
      .styled-node {
        outline: 3px solid rgb(1, 2, 3);
      }
    `;
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 's' })],
      props: {
        nodeTypes: {
          s: defineNodeType({ styles, render: () => html`<div class="styled-node">x</div>` }),
        },
      },
    });
    const inner = nodeEl(flow, 'a').querySelector('.styled-node') as HTMLElement;
    expect(getComputedStyle(inner).outlineWidth).toBe('3px');
  });
});

describe('<xy-node> interaction', () => {
  it('emits node events only when listeners exist and selects on click', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 0)] });
    const clicks: string[] = [];
    flow.addEventListener('node-click', (e) => {
      clicks.push(e.detail.node.id);
    });
    await flow.updateComplete;
    await frames(1);
    nodeEl(flow, 'b').click();
    expect(clicks).toEqual(['b']);
    expect(flow.getNode('b')?.selected).toBe(true);
    await waitFor(() => nodeEl(flow, 'b').classList.contains('selected'));
  });

  it('drags with the mouse: moves the node, selects it, emits drag events', async () => {
    const flow = await mountFlow({ nodes: [node('a', 100, 100)] });
    const events: string[] = [];
    for (const t of ['node-drag-start', 'node-drag', 'node-drag-stop'] as const) {
      flow.addEventListener(t, () => events.push(t));
    }
    const el = nodeEl(flow, 'a');
    const c = centerOf(el);
    await dragMouse(el, c, { x: c.x + 60, y: c.y + 30 });
    const pos = flow.getNode('a')?.position;
    // the first step only arms the drag (threshold), as upstream
    expect(pos?.x).toBeGreaterThan(140);
    expect(pos?.x).toBeLessThanOrEqual(160);
    expect(pos?.y).toBeGreaterThan(110);
    expect(pos?.y).toBeLessThanOrEqual(130);
    expect(flow.getNode('a')?.selected).toBe(true);
    expect(flow.getNode('a')?.dragging).toBeFalsy();
    expect(events[0]).toBe('node-drag-start');
    expect(events.at(-1)).toBe('node-drag-stop');
    expect(events).toContain('node-drag');
  });

  it('does not drag when nodes-draggable is off or a nodrag element is hit', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100)],
      attributes: { 'nodes-draggable': 'false' },
    });
    const el = nodeEl(flow, 'a');
    const c = centerOf(el);
    await dragMouse(el, c, { x: c.x + 60, y: c.y + 30 });
    expect(flow.getNode('a')?.position).toEqual({ x: 100, y: 100 });
    expect(el.classList.contains('draggable')).toBe(false);
  });

  it('keyboard: Enter selects, arrows move (Shift x4), Escape deselects, aria-live message', async () => {
    const flow = await mountFlow({ nodes: [node('a', 100, 100)] });
    const el = nodeEl(flow, 'a');
    el.focus();
    const key = (k: string, init: KeyboardEventInit = {}) =>
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: k,
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    key('Enter');
    expect(flow.getNode('a')?.selected).toBe(true);
    key('ArrowRight');
    expect(flow.getNode('a')?.position).toEqual({ x: 105, y: 100 });
    await waitFor(() => nodeEl(flow, 'a').style.transform === 'translate(105px, 100px)');
    key('ArrowDown', { shiftKey: true });
    expect(flow.getNode('a')?.position).toEqual({ x: 105, y: 120 });
    const live = flow.renderRoot.querySelector('[aria-live]') as HTMLElement;
    // like upstream, the message names the direction and the position before the move
    await waitFor(() => live.textContent?.includes('Moved selected node down'));
    expect(live.textContent).toContain('x: 105, y: 100');
    key('Escape');
    expect(flow.getNode('a')?.selected).toBeFalsy();
  });

  it('keyboard interaction is off with disable-keyboard-a11y', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 100, 100)],
      attributes: { 'disable-keyboard-a11y': '' },
    });
    const el = nodeEl(flow, 'a');
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(flow.getNode('a')?.selected).toBeFalsy();
    expect(el.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('MeasureController', () => {
  it('batches requestMeasure calls into one updateNodeInternals per frame', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 200, 0)] });
    const spy = vi.spyOn(flow.store, 'updateNodeInternals');
    flow.updateNodeInternals('a');
    flow.updateNodeInternals(['a', 'b']);
    expect(spy).not.toHaveBeenCalled();
    await frames(2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect([...(spy.mock.calls[0]?.[0] ?? new Map()).keys()].sort()).toEqual(['a', 'b']);
  });

  it('ignores unknown ids', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const spy = vi.spyOn(flow.store, 'updateNodeInternals');
    flow.updateNodeInternals('missing');
    await frames(2);
    expect(spy).not.toHaveBeenCalled();
  });
});
