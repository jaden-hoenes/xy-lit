import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArraySource } from '@xy-lit/store';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import { cleanup, edge, frames, mountFlow, node, nodeEl, sleep, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// short animations keep the tests quick: the custom properties inherit into the shadow root
const nodes = [node('a', 0, 0), node('b', 250, 0), node('c', 500, 0)];
const edges = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')];

const mountMotion = async (
  attributes: Record<string, string>,
  data = { nodes, edges },
): Promise<XyFlowElement> => {
  const flow = await mountFlow({ ...data, attributes });
  flow.style.setProperty('--xy-enter-duration', '60ms');
  flow.style.setProperty('--xy-enter-stagger', '10ms');
  return flow;
};

const entering = (flow: XyFlowElement): string[] =>
  [...flow.renderRoot.querySelectorAll<HTMLElement>('xy-node.entering')].map(
    (el) => el.dataset.id ?? '',
  );

/** Record every class change of the nodes and edges until `stop`. */
function recordEntering(flow: XyFlowElement): {
  nodes: Set<string>;
  edges: Set<string>;
  stop: () => void;
} {
  const seen = { nodes: new Set<string>(), edges: new Set<string>() };
  const scan = (): void => {
    for (const id of entering(flow)) seen.nodes.add(id);
    for (const g of flow.renderRoot.querySelectorAll<SVGGElement>('g.lit-flow__edge.entering')) {
      seen.edges.add(g.dataset.id ?? '');
    }
  };
  const observer = new MutationObserver(scan);
  observer.observe(flow.renderRoot, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  scan();
  return { ...seen, stop: () => observer.disconnect() };
}

describe('motion', () => {
  it('is off by default: nothing ever enters', async () => {
    const flow = await mountFlow({ nodes, edges });
    expect(flow.store.getState().nodes).toHaveLength(3);
    expect(flow.renderRoot.querySelector('.entering')).toBeNull();
    expect(flow.motionCtl.state.enabled).toBe(false);
  });

  it('motion="enter": the initial nodes and edges get the entering class, then lose it again', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText =
      'display:block;width:800px;height:500px;--xy-enter-duration:60ms;--xy-enter-stagger:10ms';
    flow.setAttribute('motion', 'enter');
    flow.nodes = nodes;
    flow.edges = edges;
    const seenNodes = new Map<string, string>();
    const seenEdges = new Set<string>();
    const observer = new MutationObserver(() => {
      for (const el of flow.renderRoot.querySelectorAll<HTMLElement>('xy-node.entering')) {
        seenNodes.set(el.dataset.id ?? '', el.style.getPropertyValue('--xy-enter-index'));
      }
      for (const g of flow.renderRoot.querySelectorAll<SVGGElement>('g.lit-flow__edge.entering')) {
        seenEdges.add(g.dataset.id ?? '');
      }
    });
    document.body.append(flow);
    await flow.updateComplete;
    observer.observe(flow.renderRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
    });
    await flow.whenRendered();
    await waitFor(() => seenNodes.size === 3 && seenEdges.size === 2);
    // stagger index follows the order of the entering nodes
    expect([...seenNodes.entries()].sort()).toEqual([
      ['a', '0'],
      ['b', '1'],
      ['c', '2'],
    ]);
    // while an edge enters its path is dashed by its length
    await waitFor(
      () => entering(flow).length === 0 && !flow.renderRoot.querySelector('g.entering'),
    );
    const path = flow.renderRoot.querySelector<SVGPathElement>('.lit-flow__edge-path')!;
    expect(path.style.getPropertyValue('stroke-dasharray')).toBe('');
    expect(path.style.getPropertyValue('stroke-dashoffset')).toBe('');
    expect(nodeEl(flow, 'a').style.getPropertyValue('--xy-enter-index')).toBe('');
    observer.disconnect();
    flow.remove();
  });

  it('dashes entering edge paths by their length while the class is present', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:800px;height:500px;--xy-enter-duration:400ms';
    flow.setAttribute('motion', 'enter');
    flow.nodes = nodes;
    flow.edges = [edge('ab', 'a', 'b')];
    document.body.append(flow);
    const path = (): SVGPathElement | null =>
      flow.renderRoot.querySelector('g.lit-flow__edge.entering .lit-flow__edge-path');
    await waitFor(() => path());
    const length = parseFloat(path()!.style.getPropertyValue('stroke-dasharray'));
    expect(length).toBeGreaterThan(10);
    await waitFor(() => !flow.renderRoot.querySelector('g.entering'), 4000);
    expect(
      flow.renderRoot
        .querySelector<SVGPathElement>('.lit-flow__edge-path')
        ?.style.getPropertyValue('stroke-dasharray'),
    ).toBe('');
    flow.remove();
  });

  it('nodes added later do not enter in "enter" mode', async () => {
    const flow = await mountMotion({ motion: 'enter' });
    await waitFor(() => entering(flow).length === 0);
    const rec = recordEntering(flow);
    flow.addNodes(node('late', 100, 200));
    await waitFor(() => nodeEl(flow, 'late'));
    await sleep(150);
    expect(rec.nodes.has('late')).toBe(false);
    rec.stop();
  });

  it('"enter remote" animates nodes that arrive from a remote update, with a highlight', async () => {
    class RemoteSource extends ArraySource {
      lastUpdateRemote = false;
    }
    const source = new RemoteSource(nodes, edges);
    const flow = await mountMotion({ motion: 'enter remote' }, { nodes: [], edges: [] });
    flow.source = source;
    await flow.whenRendered();
    await waitFor(() => entering(flow).length === 0 && nodeEl(flow, 'c'));
    const rec = recordEntering(flow);
    // a local addition: no entrance
    flow.addNodes(node('local', 100, 200));
    await waitFor(() => nodeEl(flow, 'local'));
    await sleep(120);
    expect(rec.nodes.has('local')).toBe(false);
    // a remote addition: enters, and gets the remote highlight classes
    source.lastUpdateRemote = true;
    flow.addNodes({
      ...node('remote', 300, 200),
      remote: { addedBy: { clientId: 1, id: 'u', name: 'U', color: '#ff0066' } },
    });
    await waitFor(() => rec.nodes.has('remote'));
    const el = nodeEl(flow, 'remote');
    expect(el.classList.contains('remote-added')).toBe(true);
    await waitFor(() => el.classList.contains('settled'));
    expect(el.style.getPropertyValue('--xy-remote-color')).toBe('#ff0066');
    rec.stop();
  });

  it('honours reduced motion', async () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      query.includes('prefers-reduced-motion')
        ? ({ ...real('(min-width: 0px)'), matches: true, media: query } as MediaQueryList)
        : real(query),
    );
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:800px;height:500px';
    flow.setAttribute('motion', 'enter');
    flow.nodes = nodes;
    document.body.append(flow);
    const rec = recordEntering(flow);
    await flow.updateComplete;
    await flow.whenRendered();
    await frames(3);
    expect(rec.nodes.size).toBe(0);
    expect(flow.motionCtl.state.enabled).toBe(false);
    rec.stop();
    flow.remove();
  });

  it('skips motion above motion-max-nodes', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:800px;height:500px';
    flow.setAttribute('motion', 'enter');
    flow.setAttribute('motion-max-nodes', '2');
    flow.nodes = nodes;
    document.body.append(flow);
    const rec = recordEntering(flow);
    await flow.updateComplete;
    await flow.whenRendered();
    await frames(3);
    expect(rec.nodes.size).toBe(0);
    rec.stop();
    flow.remove();
  });

  it('a new source counts as a new initial population', async () => {
    const flow = await mountMotion({ motion: 'enter' });
    await waitFor(() => entering(flow).length === 0);
    const rec = recordEntering(flow);
    flow.source = new ArraySource([node('x', 0, 0), node('y', 200, 0)], []);
    await waitFor(() => rec.nodes.has('x') && rec.nodes.has('y'));
    rec.stop();
  });
});
