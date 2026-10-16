import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { defineNodeType } from '../src/nodes/define-node-type.js';
import { cleanup, frames, mountFlow, node, nodeEl } from './helpers.js';

afterEach(cleanup);

const scrolling = defineNodeType({
  render: () =>
    html`<div class="scroller" style="width:120px;height:60px;overflow:auto">
      <div style="height:300px">tall</div>
    </div>`,
});

const setup = async (attributes: Record<string, string> = {}): Promise<XyFlowElement> =>
  mountFlow({
    nodes: [node('a', 100, 100, { type: 'scrolling' })],
    props: { nodeTypes: { scrolling } },
    attributes,
  });

const scroller = (flow: XyFlowElement): HTMLElement =>
  nodeEl(flow, 'a').querySelector('.scroller') as HTMLElement;

function wheel(target: Element, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('wheel-scroll detection', () => {
  it('leaves the viewport alone while the content can scroll, then zooms at the limit', async () => {
    const flow = await setup();
    const el = scroller(flow);
    const z = flow.getZoom();
    // scrollable down: the event is not handled by d3-zoom (so the browser would scroll)
    const event = wheel(el, { deltaY: 50 });
    expect(event.defaultPrevented).toBe(false);
    await frames(2);
    expect(flow.getZoom()).toBe(z);

    // at the bottom the wheel zooms the canvas again
    el.scrollTop = el.scrollHeight;
    const atEnd = wheel(el, { deltaY: 50 });
    await frames(2);
    expect(atEnd.defaultPrevented).toBe(true);
    expect(flow.getZoom()).not.toBe(z);
  });

  it('scrolling up from the bottom is detected too, and the top zooms for up-scrolls', async () => {
    const flow = await setup();
    const el = scroller(flow);
    el.scrollTop = el.scrollHeight;
    const z = flow.getZoom();
    expect(wheel(el, { deltaY: -50 }).defaultPrevented).toBe(false);
    await frames(2);
    expect(flow.getZoom()).toBe(z);
    el.scrollTop = 0;
    expect(wheel(el, { deltaY: -50 }).defaultPrevented).toBe(true);
  });

  it('wheel-scroll-detection="off" restores upstream behaviour', async () => {
    const flow = await setup({ 'wheel-scroll-detection': 'off' });
    const z = flow.getZoom();
    expect(wheel(scroller(flow), { deltaY: 50 }).defaultPrevented).toBe(true);
    await frames(2);
    expect(flow.getZoom()).not.toBe(z);
  });

  it('can be switched at runtime', async () => {
    const flow = await setup();
    flow.wheelScrollDetection = 'off';
    await flow.updateComplete;
    expect(wheel(scroller(flow), { deltaY: 50 }).defaultPrevented).toBe(true);
    flow.wheelScrollDetection = 'auto';
    await flow.updateComplete;
    expect(wheel(scroller(flow), { deltaY: 50 }).defaultPrevented).toBe(false);
  });

  it('ctrl+wheel (pinch zoom) still zooms', async () => {
    const flow = await setup();
    const z = flow.getZoom();
    expect(wheel(scroller(flow), { deltaY: -50, ctrlKey: true }).defaultPrevented).toBe(true);
    await frames(2);
    expect(flow.getZoom()).not.toBe(z);
  });

  it('stops at the node boundary: a scrollable ancestor outside the node does not count', async () => {
    const plain = defineNodeType({ render: () => html`<div class="plain">x</div>` });
    const flow = await mountFlow({
      nodes: [node('a', 100, 100, { type: 'plain' })],
      props: { nodeTypes: { plain } },
    });
    const z = flow.getZoom();
    wheel(nodeEl(flow, 'a'), { deltaY: 50 });
    await frames(2);
    expect(flow.getZoom()).not.toBe(z);
  });
});
