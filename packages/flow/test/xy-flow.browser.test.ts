import { afterEach, describe, expect, it, vi } from 'vitest';
import { css } from 'lit';
import { FlowStore } from '@xy-lit/store';
import type { FlowDataSource } from '@xy-lit/store';
import { XyFlowElement } from '../src/elements/xy-flow.js';
import { defaultSheets } from '../src/styles/sheets.js';
import { cleanup, edge, frames, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const viewportEl = (flow: XyFlowElement): HTMLElement =>
  flow.renderRoot.querySelector('.lit-flow__viewport') as HTMLElement;

describe('<xy-flow> attributes', () => {
  // [attribute, attribute value, store field, expected]
  const table: [string, string, string, unknown][] = [
    ['min-zoom', '0.2', 'minZoom', 0.2],
    ['max-zoom', '4', 'maxZoom', 4],
    ['snap-to-grid', '', 'snapToGrid', true],
    ['snap-grid', '20 25', 'snapGrid', [20, 25]],
    ['only-render-visible-elements', '', 'onlyRenderVisibleElements', true],
    ['nodes-draggable', 'false', 'nodesDraggable', false],
    ['nodes-connectable', 'false', 'nodesConnectable', false],
    ['nodes-focusable', 'false', 'nodesFocusable', false],
    ['edges-focusable', 'false', 'edgesFocusable', false],
    ['edges-reconnectable', '', 'edgesReconnectable', true],
    ['elements-selectable', 'false', 'elementsSelectable', false],
    ['select-nodes-on-drag', 'false', 'selectNodesOnDrag', false],
    ['elevate-nodes-on-select', 'false', 'elevateNodesOnSelect', false],
    ['elevate-edges-on-select', '', 'elevateEdgesOnSelect', true],
    ['auto-pan-on-node-focus', 'false', 'autoPanOnNodeFocus', false],
    ['auto-pan-on-node-drag', 'false', 'autoPanOnNodeDrag', false],
    ['auto-pan-on-connect', 'false', 'autoPanOnConnect', false],
    ['auto-pan-on-selection', 'false', 'autoPanOnSelection', false],
    ['auto-pan-speed', '30', 'autoPanSpeed', 30],
    ['selection-mode', 'partial', 'selectionMode', 'partial'],
    ['node-drag-threshold', '5', 'nodeDragThreshold', 5],
    ['connection-drag-threshold', '3', 'connectionDragThreshold', 3],
    ['connection-radius', '30', 'connectionRadius', 30],
    ['reconnect-radius', '12', 'reconnectRadius', 12],
    ['connection-mode', 'loose', 'connectionMode', 'loose'],
    ['connect-on-click', 'false', 'connectOnClick', false],
    ['default-marker-color', '#ff0000', 'defaultMarkerColor', '#ff0000'],
    ['no-drag-class-name', 'no-drag', 'noDragClassName', 'no-drag'],
    ['no-wheel-class-name', 'no-wheel', 'noWheelClassName', 'no-wheel'],
    ['no-pan-class-name', 'no-pan', 'noPanClassName', 'no-pan'],
    ['disable-keyboard-a11y', '', 'disableKeyboardA11y', true],
    ['z-index-mode', 'manual', 'zIndexMode', 'manual'],
    ['parallel-edges', 'spread', 'parallelEdges', 'spread'],
    ['parallel-edge-gap', '20', 'parallelEdgeGap', 20],
    ['debug', '', 'debug', true],
    ['id', 'my-flow', 'flowId', 'my-flow'],
  ];

  it.each(table)('%s="%s" sets store.%s', async (attribute, value, field, expected) => {
    const flow = await mountFlow({ attributes: { [attribute]: value } });
    expect((flow.store.getState() as unknown as Record<string, unknown>)[field]).toEqual(expected);
  });

  it('uses the documented defaults', async () => {
    const flow = await mountFlow();
    const s = flow.store.getState();
    expect(s.minZoom).toBe(0.5);
    expect(s.maxZoom).toBe(2);
    expect(s.nodesDraggable).toBe(true);
    expect(s.edgesReconnectable).toBe(false);
    expect(s.elevateEdgesOnSelect).toBe(false);
    expect(s.snapToGrid).toBe(false);
    expect(s.snapGrid).toEqual([15, 15]);
    expect(s.connectionRadius).toBe(20);
    expect(s.flowId).toBe('1');
    expect(flow.panOnDrag).toBe(true);
    expect(flow.zoomOnScroll).toBe(true);
    expect(flow.panOnScrollSpeed).toBe(0.5);
    expect(flow.paneClickDistance).toBe(1);
    expect(flow.nodeClickDistance).toBe(0);
    expect(flow.deleteKey).toBe('Backspace');
    expect(flow.selectionKey).toBe('Shift');
    expect(flow.panActivationKey).toBe('Space');
    expect(flow.colorMode).toBe('light');
    expect(flow.attributionPosition).toBe('bottom-right');
  });

  it('removing a default-true attribute value "false" goes back to the default', async () => {
    const flow = await mountFlow({ attributes: { 'nodes-draggable': 'false' } });
    expect(flow.nodesDraggable).toBe(false);
    flow.removeAttribute('nodes-draggable');
    await flow.updateComplete;
    expect(flow.nodesDraggable).toBe(true);
    expect(flow.store.getState().nodesDraggable).toBe(true);
  });

  it('parses pan-on-drag, key codes and numbers', async () => {
    const flow = await mountFlow({
      attributes: {
        'pan-on-drag': '1,2',
        'pan-on-scroll-mode': 'vertical',
        'delete-key': 'Delete,Backspace',
        'selection-key': 'null',
        'pan-activation-key': ' ',
        'multi-selection-key': 'Meta+k',
        'prevent-scrolling': 'false',
      },
    });
    expect(flow.panOnDrag).toEqual([1, 2]);
    expect(flow.panOnScrollMode).toBe('vertical');
    expect(flow.deleteKey).toEqual(['Delete', 'Backspace']);
    expect(flow.selectionKey).toBeNull();
    expect(flow.panActivationKey).toBe(' ');
    expect(flow.multiSelectionKey).toBe('Meta+k');
    expect(flow.preventScrolling).toBe(false);
    flow.setAttribute('pan-on-drag', 'false');
    expect(flow.panOnDrag).toBe(false);
  });

  it('falls back to the default and warns on an invalid enum value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = await mountFlow({ attributes: { 'connection-mode': 'bogus' } });
    expect(flow.store.getState().connectionMode).toBe('strict');
    expect(warn).toHaveBeenCalled();
  });

  it('pushes later property changes into the store', async () => {
    const flow = await mountFlow();
    flow.minZoom = 0.1;
    flow.snapGrid = [30, 30];
    flow.nodesDraggable = false;
    await flow.updateComplete;
    const s = flow.store.getState();
    expect(s.minZoom).toBe(0.1);
    expect(s.snapGrid).toEqual([30, 30]);
    expect(s.snapToGrid).toBe(false);
    expect(s.nodesDraggable).toBe(false);
  });

  it('uses a unique flow id per flow in light mode', async () => {
    const a = await mountFlow({ attributes: { 'render-root': 'light' } });
    const b = await mountFlow({ attributes: { 'render-root': 'light' } });
    expect(a.store.getState().flowId).toMatch(/^xy-flow-\d+$/);
    expect(a.store.getState().flowId).not.toBe(b.store.getState().flowId);
  });
});

describe('<xy-flow> upgrade safety', () => {
  it('keeps properties set before the element was defined', async () => {
    const tag = `xy-flow-upgrade-${Math.random().toString(36).slice(2, 8)}`;
    const el = document.createElement(tag) as XyFlowElement;
    el.nodes = [node('a'), node('b', 200, 0)];
    el.edges = [edge('e', 'a', 'b')];
    el.minZoom = 0.25;
    (el as unknown as Record<string, unknown>).fitView = true;
    el.style.cssText = 'display:block;width:600px;height:400px';
    document.body.append(el);
    customElements.define(tag, class extends XyFlowElement {});
    expect(el).toBeInstanceOf(XyFlowElement);
    try {
      await el.updateComplete;
      expect(el.getNodes().map((n) => n.id)).toEqual(['a', 'b']);
      expect(el.getEdges()).toHaveLength(1);
      expect(el.store.getState().minZoom).toBe(0.25);
      expect(el.fitViewOnInit).toBe(true);
    } finally {
      el.remove();
    }
  });
});

describe('<xy-flow> data', () => {
  it('renders nodes and edges and measures the nodes', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 300, 100)],
      edges: [edge('e', 'a', 'b')],
    });
    for (const id of ['a', 'b']) {
      const el = nodeEl(flow, id);
      expect(getComputedStyle(el).visibility).toBe('visible');
      expect(flow.getNode(id)?.measured?.width).toBe(el.offsetWidth);
      expect(el.offsetWidth).toBeGreaterThan(0);
    }
    expect(flow.renderRoot.querySelectorAll('.lit-flow__edge')).toHaveLength(1);
    expect(flow.store.getState().nodesInitialized).toBe(true);
  });

  it('assigning nodes and edges later updates the flow (uncontrolled)', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    flow.nodes = [node('a'), node('b', 200, 0)];
    await flow.updateComplete;
    await waitFor(() => nodeEl(flow, 'b'));
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    flow.edges = [edge('e', 'a', 'b')];
    await waitFor(() => flow.renderRoot.querySelector('.lit-flow__edge'));
  });

  it('adds an edge on connect (default action) and emits a cancelable connect event', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 300, 0)] });
    const seen: unknown[] = [];
    flow.addEventListener('connect', (e) => {
      seen.push(e.detail);
    });
    flow.handleConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null });
    expect(flow.getEdges()).toHaveLength(1);
    expect(flow.getEdges()[0]).toMatchObject({ source: 'a', target: 'b' });
    expect(seen).toHaveLength(1);
    expect((seen[0] as { edge: { id: string } }).edge.id).toBeTruthy();
    // the same connection again is ignored by the default action
    flow.handleConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null });
    expect(flow.getEdges()).toHaveLength(1);
  });

  it('connect honours preventDefault, onBeforeConnect and defaultEdgeOptions', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 300, 0)],
      props: { defaultEdgeOptions: { animated: true } },
    });
    flow.addEventListener('connect', (e) => {
      e.preventDefault();
    });
    flow.handleConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null });
    expect(flow.getEdges()).toHaveLength(0);

    const flow2 = await mountFlow({
      nodes: [node('a'), node('b', 300, 0)],
      props: { defaultEdgeOptions: { animated: true } },
    });
    flow2.handleConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null });
    expect(flow2.getEdges()[0]?.animated).toBe(true);

    flow2.onBeforeConnect = () => false;
    await flow2.updateComplete;
    flow2.handleConnect({ source: 'b', target: 'a', sourceHandle: null, targetHandle: null });
    expect(flow2.getEdges()).toHaveLength(1);
  });

  it('controlled mode: a prevented nodes-change leaves nodes unchanged until reassigned', async () => {
    const flow = await mountFlow({ nodes: [node('a', 0, 0)] });
    flow.addEventListener('nodes-change', (e) => {
      e.preventDefault();
    });
    flow.store.triggerNodeChanges([{ type: 'position', id: 'a', position: { x: 50, y: 60 } }], {
      phase: 'discrete',
      origin: 'api',
    });
    expect(flow.getNode('a')?.position).toEqual({ x: 0, y: 0 });
    flow.nodes = [node('a', 50, 60)];
    await flow.updateComplete;
    expect(flow.getNode('a')?.position).toEqual({ x: 50, y: 60 });
    await waitFor(() => nodeEl(flow, 'a').style.transform.includes('50px'));
  });

  it('assigning a data source hands state to it', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const listeners = new Set<() => void>();
    const source: FlowDataSource = {
      nodes: [node('x'), node('y', 200, 0)],
      edges: [],
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      applyNodeChanges: () => {},
      applyEdgeChanges: () => {},
    };
    flow.source = source;
    expect(flow.source).toBe(source);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['x', 'y']);
    await waitFor(() => nodeEl(flow, 'y'));
    flow.source = null;
    expect(flow.source).toBeNull();
  });
});

describe('<xy-flow> viewport', () => {
  it('writes the transform straight to the viewport element', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    await flow.setViewport({ x: 40, y: 30, zoom: 1.5 });
    expect(viewportEl(flow).style.transform).toBe('translate(40px, 30px) scale(1.5)');
    expect(flow.getViewport()).toEqual({ x: 40, y: 30, zoom: 1.5 });
    expect(flow.viewport).toEqual({ x: 40, y: 30, zoom: 1.5 });
    expect(flow.viewportInitialized).toBe(true);
  });

  it('uses defaultViewport and clamps to the zoom limits', async () => {
    const flow = await mountFlow({
      props: { defaultViewport: { x: 10, y: 20, zoom: 5 }, maxZoom: 2 },
    });
    expect(flow.getViewport()).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it('emits move events and viewport-change', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const events: string[] = [];
    for (const type of ['move-start', 'move', 'move-end', 'viewport-change'] as const) {
      flow.addEventListener(type, () => events.push(type));
    }
    await flow.setViewport({ x: 100, y: 0, zoom: 1 });
    expect(events).toContain('viewport-change');
  });

  it('controlled viewport: assigning it moves the viewport', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    flow.viewport = { x: 15, y: 25, zoom: 1.25 };
    await flow.updateComplete;
    expect(viewportEl(flow).style.transform).toBe('translate(15px, 25px) scale(1.25)');
    expect(flow.store.getState().transform).toEqual([15, 25, 1.25]);
    expect(flow.controlledViewport).toEqual({ x: 15, y: 25, zoom: 1.25 });
    flow.viewport = undefined;
    expect(flow.controlledViewport).toBeUndefined();
  });

  it('fitView is a property and a method', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 400, 300)],
      attributes: { 'fit-view': '' },
    });
    expect(flow.fitViewOnInit).toBe(true);
    await waitFor(() => flow.getZoom() !== 1);
    const fitted = await flow.fitView({ padding: 0.5, duration: 0 });
    expect(fitted).toBe(true);
    flow.fitView = false;
    expect(flow.fitViewOnInit).toBe(false);
    expect(typeof flow.fitView).toBe('function');
  });

  it('the initial fit-view includes group nodes that declare a width and height', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0),
        node('g', 100, 300, { type: 'group', width: 340, height: 200, data: {} }),
      ],
      attributes: { 'fit-view': '' },
    });
    const initial = flow.getViewport();
    await flow.fitView({ duration: 0 });
    const refit = flow.getViewport();
    expect(initial.zoom).toBeCloseTo(refit.zoom, 5);
    expect(initial.x).toBeCloseTo(refit.x, 3);
    expect(initial.y).toBeCloseTo(refit.y, 3);
    // both nodes are inside the visible area
    const [x, y, zoom] = flow.store.getState().transform;
    expect(y + 500 * zoom).toBeLessThanOrEqual(500 + 0.5);
    expect(x).toBeLessThan(800);
  });
});

describe('<xy-flow> render and lifecycle', () => {
  it('renders every layer with the documented classes', async () => {
    const flow = await mountFlow({ nodes: [node('a')] });
    const root = flow.renderRoot;
    for (const selector of [
      '.lit-flow.lit-flow__container',
      '.lit-flow__renderer.lit-flow__zoom',
      '.lit-flow__pane',
      '.lit-flow__viewport.xyflow__viewport',
      '.lit-flow__viewport-back',
      '.lit-flow__edges',
      '.lit-flow__edgelabel-renderer',
      '.lit-flow__nodes',
      '.lit-flow__viewport-front',
      '.lit-flow__attribution',
      '.lit-flow__loading',
      '[id^="lit-flow__node-desc-"]',
      '[id^="lit-flow__edge-desc-"]',
      '[aria-live="assertive"]',
    ]) {
      expect(root.querySelector(selector), selector).not.toBeNull();
    }
    expect(flow.shadowRoot?.adoptedStyleSheets.length).toBeGreaterThanOrEqual(2);
    expect(flow.store.getState().domNode).toBe(root.querySelector('.lit-flow.lit-flow__container'));
  });

  it('hides the attribution and the loading overlay', async () => {
    const flow = await mountFlow({ attributes: { 'hide-attribution': '' } });
    expect(flow.renderRoot.querySelector('.lit-flow__attribution')).toBeNull();
    const overlay = flow.renderRoot.querySelector('.lit-flow__loading') as HTMLElement;
    expect(overlay.hidden).toBe(true);
    flow.loading = true;
    await flow.updateComplete;
    expect(overlay.hidden).toBe(false);
    flow.noLoadingOverlay = true;
    await flow.updateComplete;
    expect(overlay.hidden).toBe(true);
  });

  it('shows the loading overlay until the first render completed', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:400px;height:300px';
    flow.nodes = [node('a')];
    document.body.append(flow);
    try {
      await flow.updateComplete;
      expect((flow.renderRoot.querySelector('.lit-flow__loading') as HTMLElement).hidden).toBe(
        false,
      );
      await flow.whenRendered();
      await flow.updateComplete;
      expect((flow.renderRoot.querySelector('.lit-flow__loading') as HTMLElement).hidden).toBe(
        true,
      );
    } finally {
      flow.remove();
    }
  });

  it('whenRendered resolves with the counts of the flow', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 200, 0)],
      edges: [edge('e', 'a', 'b')],
    });
    const detail = await flow.whenRendered();
    expect(detail.nodeCount).toBe(2);
    expect(detail.edgeCount).toBe(1);
  });

  it('keeps working when moved to a new parent', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    try {
      const flow = await mountFlow({
        nodes: [node('n1'), node('n2', 200, 100)],
        edges: [edge('e', 'n1', 'n2')],
        parent: a,
      });
      await flow.setViewport({ x: 33, y: 44, zoom: 1 });
      b.append(flow);
      await flow.updateComplete;
      await frames(3);
      expect(flow.viewportInitialized).toBe(true);
      expect(flow.getViewport()).toEqual({ x: 33, y: 44, zoom: 1 });
      expect(viewportEl(flow).style.transform).toBe('translate(33px, 44px) scale(1)');
      expect(getComputedStyle(nodeEl(flow, 'n1')).visibility).toBe('visible');
      await flow.setViewport({ x: 5, y: 6, zoom: 1.2 });
      expect(viewportEl(flow).style.transform).toBe('translate(5px, 6px) scale(1.2)');
      flow.addNodes(node('n3', 400, 0));
      await waitFor(() => flow.getNode('n3')?.measured?.width);
    } finally {
      a.remove();
      b.remove();
    }
  });

  it('two flows on one page are independent', async () => {
    const one = await mountFlow({ nodes: [node('a')], attributes: { id: 'one' } });
    const two = await mountFlow({ nodes: [node('a')], attributes: { id: 'two' } });
    one.store.addSelectedNodes(['a']);
    await one.updateComplete;
    expect(one.getNode('a')?.selected).toBe(true);
    expect(two.getNode('a')?.selected).toBeFalsy();
    expect(one.renderRoot.querySelector('[id^="lit-flow__node-desc-one"]')).not.toBeNull();
    expect(two.renderRoot.querySelector('[id^="lit-flow__node-desc-two"]')).not.toBeNull();
  });

  it('forwards the instance methods to the store instance', async () => {
    const flow = await mountFlow({ nodes: [node('a'), node('b', 200, 0)] });
    expect(flow.getNodes()).toHaveLength(2);
    expect(flow.getNode('a')?.id).toBe('a');
    flow.addEdges({ id: 'e', source: 'a', target: 'b' });
    expect(flow.getEdge('e')?.target).toBe('b');
    expect(flow.toObject().edges).toHaveLength(1);
    flow.updateNodeData('a', { label: 'renamed' });
    await waitFor(() => flow.getNode('a')?.data.label === 'renamed');
    expect(flow.getNodesBounds(['a', 'b']).width).toBeGreaterThan(0);
    expect(flow.screenToFlowPosition({ x: 0, y: 0 })).toBeDefined();
    const res = await flow.deleteElements({ edges: [{ id: 'e' }] });
    expect(res.deletedEdges).toHaveLength(1);
  });

  it('adoptStyles adds sheets once, after the base sheets', async () => {
    const flow = await mountFlow();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.x { color: red }');
    flow.adoptStyles(
      sheet,
      sheet,
      css`
        .y {
          color: blue;
        }
      `,
    );
    const adopted = [...(flow.shadowRoot as ShadowRoot).adoptedStyleSheets];
    expect(adopted.slice(0, 2)).toEqual(defaultSheets);
    expect(adopted.filter((s) => s === sheet)).toHaveLength(1);
    expect(adopted).toHaveLength(4);
  });

  it('counts listeners per event type', async () => {
    const flow = await mountFlow();
    expect(flow.hasListener('node-click')).toBe(false);
    const handler = () => {};
    flow.addEventListener('node-click', handler);
    expect(flow.hasListener('node-click')).toBe(true);
    flow.removeEventListener('node-click', handler);
    expect(flow.hasListener('node-click')).toBe(false);
    const controller = new AbortController();
    flow.addEventListener('edge-click', handler, { signal: controller.signal });
    expect(flow.hasListener('edge-click')).toBe(true);
    controller.abort();
    expect(flow.hasListener('edge-click')).toBe(false);
  });

  it('emits init once with the instance', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:400px;height:300px';
    const inits: unknown[] = [];
    flow.addEventListener('init', (e) => inits.push(e.detail.instance));
    document.body.append(flow);
    try {
      await flow.updateComplete;
      expect(inits).toHaveLength(1);
      expect(inits[0]).toBe(flow.instance);
    } finally {
      flow.remove();
    }
  });

  it('reports a missing height through flow-error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:400px;height:0';
    const errors: string[] = [];
    flow.addEventListener('flow-error', (e) => {
      errors.push(e.detail.code);
    });
    document.body.append(flow);
    try {
      await flow.updateComplete;
      expect(errors).toContain('004');
    } finally {
      flow.remove();
    }
  });
});

describe('<xy-flow> color mode', () => {
  it('sets the light/dark class', async () => {
    const flow = await mountFlow({ attributes: { 'color-mode': 'dark' } });
    const wrapper = flow.renderRoot.querySelector('.lit-flow') as HTMLElement;
    expect(wrapper.classList.contains('dark')).toBe(true);
    flow.colorMode = 'light';
    await flow.updateComplete;
    expect(wrapper.classList.contains('dark')).toBe(false);
    expect(wrapper.classList.contains('light')).toBe(true);
  });

  it('system follows prefers-color-scheme', async () => {
    let listener: ((e: MediaQueryListEvent) => void) | null = null;
    const mql = {
      matches: false,
      addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
        listener = l;
      },
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
    const flow = await mountFlow({ attributes: { 'color-mode': 'system' } });
    const wrapper = flow.renderRoot.querySelector('.lit-flow') as HTMLElement;
    expect(wrapper.classList.contains('light')).toBe(true);
    listener!({ matches: true } as MediaQueryListEvent);
    await flow.updateComplete;
    expect(wrapper.classList.contains('dark')).toBe(true);
    flow.remove();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});

describe('<xy-flow> render-root="light"', () => {
  it('renders nodes into the document tree', async () => {
    const flow = await mountFlow({
      nodes: [node('a'), node('b', 200, 0)],
      edges: [edge('e', 'a', 'b')],
      attributes: { 'render-root': 'light' },
    });
    expect(flow.shadowRoot).toBeNull();
    expect(flow.querySelector('xy-node[data-id="a"]')).not.toBeNull();
    expect(flow.querySelector('.lit-flow__edge')).not.toBeNull();
    await waitFor(() => flow.getNode('a')?.measured?.width);
  });
});

describe('FlowStore sharing', () => {
  it('uses the store of a provider ancestor', async () => {
    const { ContextProvider } = await import('@lit/context');
    const { flowContext } = await import('../src/context.js');
    const store = new FlowStore({ nodes: [node('shared')] });
    const wrapper = document.createElement('div');
    new ContextProvider(wrapper, {
      context: flowContext,
      initialValue: { store, instance: store.instance, flow: null, hub: null, measure: null },
    });
    document.body.append(wrapper);
    try {
      const flow = await mountFlow({ parent: wrapper });
      expect(flow.store).toBe(store);
      expect(flow.getNodes().map((n) => n.id)).toEqual(['shared']);
    } finally {
      wrapper.remove();
    }
  });
});
