import { css, html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
import { cleanup, centerOf, dragMouse, edge, frames, mountFlow, node, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  document.adoptedStyleSheets = [];
});

const light = { 'render-root': 'light' };
const q = <T extends Element>(flow: XyFlowElement, selector: string): T | null =>
  flow.querySelector<T>(selector);

describe('render-root="light"', () => {
  it('renders into the document: no shadow root, the engine contract classes are queryable', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0), node('b', 300, 100)],
      attributes: light,
    });
    expect(flow.shadowRoot).toBeNull();
    expect(flow.renderRoot).toBe(flow);
    expect(document.querySelectorAll('.lit-flow__node')).toHaveLength(2);
    expect(q(flow, '.lit-flow__viewport')).not.toBeNull();
    expect(flow.store.getState().flowId).toMatch(/^xy-flow-\d+$/);
    // the base sheets went into the document, so the default node is styled
    const a = q<HTMLElement>(flow, 'xy-node[data-id="a"]')!;
    expect(getComputedStyle(a).borderTopWidth).toBe('1px');
    expect(getComputedStyle(flow).position).toBe('relative');
  });

  it('global CSS styles node content directly (Tailwind-like)', async () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.tw-red { color: rgb(255, 0, 0); } .tw-pad { padding: 7px; }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const styled = defineNodeType({
      render: () => html`<span class="tw-red tw-pad">styled</span>`,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'styled' })],
      props: { nodeTypes: { styled } },
      attributes: light,
    });
    const span = q<HTMLElement>(flow, '.tw-red')!;
    expect(getComputedStyle(span).color).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(span).paddingTop).toBe('7px');
  });

  it('projects default-slot children into the wrapper and viewport slots into the viewport', async () => {
    const flow = document.createElement('xy-flow');
    flow.setAttribute('render-root', 'light');
    flow.style.cssText = 'display:block;width:800px;height:500px';
    flow.nodes = [node('a')];
    const controls = document.createElement('xy-controls');
    const portal = document.createElement('xy-viewport-portal');
    portal.setAttribute('target', 'back');
    const front = document.createElement('div');
    front.setAttribute('slot', 'viewport-front');
    front.id = 'front';
    flow.append(controls, portal, front);
    document.body.append(flow);
    await flow.whenRendered();
    await frames(2);
    const wrapper = q(flow, '.lit-flow')!;
    expect(controls.parentElement).toBe(wrapper);
    expect(portal.parentElement).toBe(q(flow, '.lit-flow__viewport-back'));
    expect(front.parentElement).toBe(q(flow, '.lit-flow__viewport-front'));
    // the controls panel positions against the wrapper
    const panel = controls.shadowRoot!.querySelector('.lit-flow__panel')!;
    const box = flow.getBoundingClientRect();
    expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom);
    expect(panel.getBoundingClientRect().left).toBeGreaterThanOrEqual(box.left);

    // children added later are projected too
    const late = document.createElement('xy-minimap');
    flow.append(late);
    await waitFor(() => late.parentElement === wrapper);
    // plugins found the flow through context
    await waitFor(() => late.shadowRoot?.querySelector('.lit-flow__minimap'));
    flow.remove();
  });

  it('a slot="loading" child replaces the spinner', async () => {
    const flow = document.createElement('xy-flow');
    flow.setAttribute('render-root', 'light');
    flow.setAttribute('loading', '');
    flow.style.cssText = 'display:block;width:400px;height:300px';
    const custom = document.createElement('div');
    custom.slot = 'loading';
    custom.textContent = 'please wait';
    flow.append(custom);
    document.body.append(flow);
    await flow.updateComplete;
    await frames(2);
    const overlay = q<HTMLElement>(flow, '.lit-flow__loading')!;
    expect(custom.parentElement).toBe(overlay);
    expect(getComputedStyle(q(flow, '.lit-flow__spinner')!).display).toBe('none');
    flow.remove();
  });

  it('dragging a node and connecting handles work', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 50, 50), node('b', 350, 250)],
      attributes: light,
      width: 800,
      height: 600,
    });
    const a = q<HTMLElement>(flow, 'xy-node[data-id="a"]')!;
    const before = flow.getNode('a')!.position;
    const c = centerOf(a);
    await dragMouse(a, c, { x: c.x + 80, y: c.y + 40 });
    const after = flow.getNode('a')!.position;
    expect(after.x).toBeGreaterThan(before.x + 50);
    expect(after.y).toBeGreaterThan(before.y + 20);

    const source = q<HTMLElement>(flow, '.lit-flow__handle.source[data-nodeid="a"]')!;
    const target = q<HTMLElement>(flow, '.lit-flow__handle.target[data-nodeid="b"]')!;
    await dragMouse(source, centerOf(source), centerOf(target), 8);
    await waitFor(() => flow.getEdges().length === 1);
    expect(flow.getEdges()[0]).toMatchObject({ source: 'a', target: 'b' });
  });

  it('two light flows have distinct ids and independent state', async () => {
    const one = await mountFlow({ nodes: [node('a')], edges: [], attributes: light });
    const two = await mountFlow({ nodes: [node('a')], attributes: light });
    expect(one.store.getState().flowId).not.toBe(two.store.getState().flowId);
    one.store.addSelectedNodes(['a']);
    await frames(2);
    expect(one.getNode('a')?.selected).toBe(true);
    expect(two.getNode('a')?.selected).toBeFalsy();
  });

  it('renders edges and labels', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0), node('b', 300, 100)],
      edges: [edge('e', 'a', 'b', { label: 'hello' })],
      attributes: light,
    });
    expect(q(flow, 'g.lit-flow__edge[data-id="e"]')).not.toBeNull();
    expect(q(flow, '.lit-flow__edge-label')?.textContent).toBe('hello');
  });
});

describe('unstyled and adoptStyles', () => {
  const borderOf = (flow: XyFlowElement, id: string): string =>
    getComputedStyle(flow.renderRoot.querySelector(`xy-node[data-id="${id}"]`)!).borderTopWidth;

  const radiusOf = (flow: XyFlowElement, id: string): string =>
    getComputedStyle(flow.renderRoot.querySelector(`xy-node[data-id="${id}"]`)!)
      .borderTopLeftRadius;

  it('unstyled uses the base stylesheet: no default node look', async () => {
    const styled = await mountFlow({ nodes: [node('a')] });
    const bare = await mountFlow({ nodes: [node('a')], attributes: { unstyled: '' } });
    // style.css rounds the node's corners, base.css does not
    expect(radiusOf(styled, 'a')).toBe('3px');
    expect(radiusOf(bare, 'a')).toBe('0px');
    // the structural rules of the base sheet still apply
    expect(getComputedStyle(bare.renderRoot.querySelector('xy-node')!).position).toBe('absolute');
  });

  it('unstyled can be toggled after the first render', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    flow.unstyled = true;
    await flow.updateComplete;
    expect(radiusOf(flow, 'a')).toBe('0px');
    flow.unstyled = false;
    await flow.updateComplete;
    expect(radiusOf(flow, 'a')).toBe('3px');
  });

  it('adoptStyles appends app stylesheets after the built-in ones, deduplicated', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const app = css`
      .lit-flow__node {
        border-top-width: 5px;
      }
    `;
    flow.adoptStyles(app);
    flow.adoptStyles(app);
    const sheets = [...(flow.renderRoot as ShadowRoot).adoptedStyleSheets];
    expect(borderOf(flow, 'a')).toBe('5px');
    const raw = new CSSStyleSheet();
    raw.replaceSync('.lit-flow__node { border-top-width: 9px; }');
    flow.adoptStyles(raw);
    flow.adoptStyles(raw);
    const after = [...(flow.renderRoot as ShadowRoot).adoptedStyleSheets];
    expect(after.length).toBe(sheets.length + 1);
    expect(after.at(-1)).toBe(raw);
    expect(borderOf(flow, 'a')).toBe('9px');
  });

  it('adoptStyles in light mode adopts into the document', async () => {
    const flow = await mountFlow({ nodes: [node('a')], attributes: light });
    const raw = new CSSStyleSheet();
    raw.replaceSync('.lit-flow__node { border-top-width: 4px; }');
    flow.adoptStyles(raw);
    expect(document.adoptedStyleSheets).toContain(raw);
    expect(getComputedStyle(flow.querySelector('xy-node[data-id="a"]')!).borderTopWidth).toBe(
      '4px',
    );
  });

  it('node type styles are adopted automatically', async () => {
    const withStyles = defineNodeType({
      render: () => html`<i class="t-mark">x</i>`,
      styles: css`
        .t-mark {
          margin-left: 11px;
        }
      `,
    });
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'withStyles' })],
      props: { nodeTypes: { withStyles } },
    });
    expect(getComputedStyle(flow.renderRoot.querySelector('.t-mark')!).marginLeft).toBe('11px');
  });
});
