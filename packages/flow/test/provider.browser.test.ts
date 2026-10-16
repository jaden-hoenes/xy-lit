import { LitElement, html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreController } from '../src/controllers/store-controller.js';
import { flowContext } from '../src/context.js';
import type { FlowContextValue } from '../src/context.js';
import { ContextConsumer } from '@lit/context';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import type { XyFlowProviderElement } from '../src/elements/xy-flow-provider.js';
import { cleanup, frames, node, waitFor } from './helpers.js';

/** A component next to the flow that reads the shared store. */
class SideCounter extends LitElement {
  count = new StoreController(this, (s) => s.nodes.length);
  context: FlowContextValue | undefined;
  constructor() {
    super();
    new ContextConsumer(this, {
      context: flowContext,
      subscribe: true,
      callback: (value) => {
        this.context = value;
      },
    });
  }
  override render() {
    return html`<span class="count">${this.count.value ?? '-'}</span>`;
  }
}
customElements.define('test-side-counter', SideCounter);

const roots: HTMLElement[] = [];
afterEach(() => {
  for (const el of roots.splice(0)) el.remove();
  cleanup();
  vi.restoreAllMocks();
});

function mount(): { provider: XyFlowProviderElement; side: SideCounter; flow: XyFlowElement } {
  const provider = document.createElement('xy-flow-provider');
  const side = document.createElement('test-side-counter') as SideCounter;
  const flow = document.createElement('xy-flow');
  flow.style.cssText = 'display:block;width:600px;height:400px';
  provider.append(side, flow);
  document.body.append(provider);
  roots.push(provider);
  return { provider, side, flow };
}

describe('<xy-flow-provider>', () => {
  it('renders no box of its own and has no shadow root', async () => {
    const { provider } = mount();
    await provider.updateComplete;
    expect(provider.shadowRoot).toBeNull();
    expect(getComputedStyle(provider).display).toBe('contents');
  });

  it('shares its store with the flow and with components outside the flow', async () => {
    const { provider, side, flow } = mount();
    flow.nodes = [node('a'), node('b', 200, 0)];
    flow.edges = [{ id: 'e', source: 'a', target: 'b' }];
    await flow.whenRendered();
    expect(flow.store).toBe(provider.store);
    expect(flow.instance).toBe(provider.instance);
    expect(provider.flow).toBe(flow);
    await waitFor(() => side.count.value === 2);
    await side.updateComplete;
    expect(side.renderRoot.querySelector('.count')?.textContent).toBe('2');

    // changes through the provider's instance show up in the flow and the side component
    provider.instance.addNodes([node('c', 0, 200)]);
    await waitFor(() => flow.renderRoot.querySelectorAll('xy-node').length === 3);
    await waitFor(() => side.count.value === 3);
  });

  it('works before a flow exists', async () => {
    const provider = document.createElement('xy-flow-provider');
    const side = document.createElement('test-side-counter') as SideCounter;
    provider.append(side);
    document.body.append(provider);
    roots.push(provider);
    await side.updateComplete;
    expect(side.count.value).toBe(0);
    expect(side.context?.flow).toBeNull();
    provider.instance.addNodes([node('x')]);
    await waitFor(() => side.count.value === 1);
  });

  it('tells the context about the flow, hub and measure once it attached, and clears them', async () => {
    const { provider, side, flow } = mount();
    await flow.whenRendered();
    await waitFor(() => side.context?.flow === flow);
    expect(side.context?.hub).toBe(flow.hub);
    expect(side.context?.measure).toBe(flow.measure);
    expect(side.context?.provider).toBe(provider);
    flow.remove();
    await waitFor(() => side.context?.flow === null);
    expect(provider.flow).toBeNull();
    expect(side.context?.hub).toBeNull();
  });

  it('data and options given to the flow reach the shared store', async () => {
    const provider = document.createElement('xy-flow-provider');
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:600px;height:400px';
    flow.nodes = [node('a', 10, 10)];
    flow.setAttribute('snap-to-grid', '');
    flow.setAttribute('fit-view', '');
    provider.append(flow);
    document.body.append(provider);
    roots.push(provider);
    await flow.whenRendered();
    expect(provider.store.getState().nodes.map((n) => n.id)).toEqual(['a']);
    expect(provider.store.getState().snapToGrid).toBe(true);
    // fit-view ran against the shared store
    expect(provider.store.getState().transform).not.toEqual([0, 0, 1]);
  });

  it('keeps the data of the provider when the flow is given nothing', async () => {
    const provider = document.createElement('xy-flow-provider');
    provider.instance.addNodes([node('kept')]);
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:600px;height:400px';
    flow.nodes = [];
    provider.append(flow);
    document.body.append(provider);
    roots.push(provider);
    await flow.whenRendered();
    expect(flow.getNodes().map((n) => n.id)).toEqual(['kept']);
  });

  it('serves one flow at a time: a second flow keeps its own store and a warning is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { provider, flow } = mount();
    await flow.whenRendered();
    const second = document.createElement('xy-flow');
    second.style.cssText = 'display:block;width:300px;height:200px';
    second.nodes = [node('s')];
    provider.append(second);
    await second.whenRendered();
    expect(second.store).not.toBe(provider.store);
    expect(provider.flow).toBe(flow);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('XYL03'))).toBe(true);
    expect(second.getNodes().map((n) => n.id)).toEqual(['s']);
  });

  it('a flow moved within the provider keeps the shared store', async () => {
    const { provider, flow } = mount();
    flow.nodes = [node('a')];
    await flow.whenRendered();
    const holder = document.createElement('div');
    provider.append(holder);
    holder.append(flow);
    await frames(3);
    expect(flow.store).toBe(provider.store);
    expect(provider.flow).toBe(flow);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });
});
