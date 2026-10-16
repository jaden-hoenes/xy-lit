import { ContextProvider } from '@lit/context';
import { LitElement, html } from 'lit';
import { FlowStore, shallow } from '@xy-lit/store';
import type { Node } from '@xy-lit/store';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreController } from '../src/controllers/store-controller.js';
import { flowContext } from '../src/context.js';

const node = (id: string, x = 0): Node => ({ id, position: { x, y: 0 }, data: {} });

class SelectorHost extends LitElement {
  static override properties = {};
  updates = 0;
  count = new StoreController(this, (s) => s.nodes.length);
  firstId = new StoreController(this, (s) => s.nodes[0]?.id);
  override updated(): void {
    this.updates++;
  }
  override render() {
    return html`${this.count.value}`;
  }
}
customElements.define('test-selector-host', SelectorHost);

class ExplicitHost extends LitElement {
  updates = 0;
  ids: StoreController<string[]>;
  constructor(store: FlowStore) {
    super();
    this.ids = new StoreController(this, (s) => s.nodes.map((n) => n.id), shallow, { store });
  }
  override updated(): void {
    this.updates++;
  }
  override render() {
    return html`${this.ids.value.join(',')}`;
  }
}
customElements.define('test-explicit-host', ExplicitHost);

const cleanup: Element[] = [];
afterEach(() => {
  for (const el of cleanup.splice(0)) el.remove();
});

function provide(store: FlowStore): HTMLElement {
  const provider = document.createElement('div');
  new ContextProvider(provider, {
    context: flowContext,
    initialValue: { store, instance: store.instance, flow: null, hub: null, measure: null },
  });
  document.body.append(provider);
  cleanup.push(provider);
  return provider;
}

describe('StoreController', () => {
  it('reads the store from context and updates the host only when the value changes', async () => {
    const store = new FlowStore({ nodes: [node('a')] });
    const provider = provide(store);
    const host = document.createElement('test-selector-host') as SelectorHost;
    provider.append(host);
    await host.updateComplete;
    expect(host.count.value).toBe(1);
    expect(host.shadowRoot?.textContent).toContain('1');
    const before = host.updates;

    // a change the selectors do not care about: no update
    store.setState({ ariaLiveMessage: 'hello' });
    store.flush();
    await Promise.resolve();
    expect(host.updates).toBe(before);

    store.instance.addNodes([node('b', 100)]);
    store.flush();
    await host.updateComplete;
    expect(host.count.value).toBe(2);
    expect(host.updates).toBeGreaterThan(before);
  });

  it('detaches on disconnect and re-attaches on reconnect', async () => {
    const store = new FlowStore({ nodes: [node('a')] });
    const provider = provide(store);
    const host = document.createElement('test-selector-host') as SelectorHost;
    provider.append(host);
    await host.updateComplete;

    host.remove();
    store.instance.addNodes([node('b', 100)]);
    store.flush();
    expect(host.count.value).toBe(1); // not subscribed while disconnected

    provider.append(host);
    await host.updateComplete;
    expect(host.count.value).toBe(2); // recomputed on reconnect
  });

  it('works with an explicit store and a custom equality outside any flow', async () => {
    const store = new FlowStore({ nodes: [node('a')] });
    const host = new ExplicitHost(store);
    document.body.append(host);
    cleanup.push(host);
    await host.updateComplete;
    expect(host.ids.value).toEqual(['a']);
    const before = host.updates;

    // a new array with the same ids: shallow equality keeps the host quiet
    store.instance.updateNode('a', { position: { x: 5, y: 5 } });
    store.flush();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.updates).toBe(before);

    store.instance.addNodes([node('b', 100)]);
    store.flush();
    await host.updateComplete;
    expect(host.ids.value).toEqual(['a', 'b']);
  });

  it('switches stores when the provided store changes', async () => {
    const first = new FlowStore({ nodes: [node('a')] });
    const second = new FlowStore({ nodes: [node('x'), node('y')] });
    const provider = document.createElement('div');
    const ctx = new ContextProvider(provider, {
      context: flowContext,
      initialValue: {
        store: first,
        instance: first.instance,
        flow: null,
        hub: null,
        measure: null,
      },
    });
    document.body.append(provider);
    cleanup.push(provider);
    const host = document.createElement('test-selector-host') as SelectorHost;
    provider.append(host);
    await host.updateComplete;
    expect(host.count.value).toBe(1);

    ctx.setValue({
      store: second,
      instance: second.instance,
      flow: null,
      hub: null,
      measure: null,
    });
    await host.updateComplete;
    expect(host.count.value).toBe(2);
    expect(host.firstId.value).toBe('x');
  });
});

describe('shallow', () => {
  it('compares arrays, objects, maps and sets by entries', () => {
    expect(shallow([1, 2], [1, 2])).toBe(true);
    expect(shallow([1, 2], [1, 3])).toBe(false);
    expect(shallow({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallow(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(shallow(new Set([1]), new Set([2]))).toBe(false);
  });
});
