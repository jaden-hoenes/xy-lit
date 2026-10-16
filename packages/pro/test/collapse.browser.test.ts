import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalHistory,
  collapseAll,
  expandAll,
  getCollapsibleDescendants,
  isCollapsed,
  toggleCollapsed,
} from '../src/index.js';
import { cleanup, edge, frames, mountFlow, node } from './helpers.js';

afterEach(cleanup);

/*
 *   root -> a -> a1 -> a2
 *   root -> b -> shared
 *   other -> shared          (other is a second root)
 *   a1 -> shared2 <- b       (shared2 is also reachable from b)
 */
const make = () =>
  mountFlow({
    nodes: ['root', 'a', 'a1', 'a2', 'b', 'shared', 'other', 'shared2'].map((id, i) =>
      node(id, i * 10, i * 10),
    ),
    edges: [
      edge('root-a', 'root', 'a'),
      edge('a-a1', 'a', 'a1'),
      edge('a1-a2', 'a1', 'a2'),
      edge('root-b', 'root', 'b'),
      edge('b-shared', 'b', 'shared'),
      edge('other-shared', 'other', 'shared'),
      edge('a1-shared2', 'a1', 'shared2'),
      edge('b-shared2', 'b', 'shared2'),
    ],
  });

const hidden = (flow: Awaited<ReturnType<typeof make>>): string[] =>
  flow.nodes.filter((n) => n.hidden).map((n) => n.id);

describe('collapse', () => {
  it('descendants are reachable through outgoing edges, minus what other roots reach', async () => {
    const flow = await make();
    expect([...getCollapsibleDescendants(flow, 'a')].sort()).toEqual(['a1', 'a2']);
    // shared is also reachable from `other`, shared2 from b which is not under a
    expect([...getCollapsibleDescendants(flow, 'root')].sort()).toEqual([
      'a',
      'a1',
      'a2',
      'b',
      'shared2',
    ]);
    expect([...getCollapsibleDescendants(flow, 'a2')]).toEqual([]);
  });

  it('collapsing hides the descendants and their edges; expanding shows them again', async () => {
    const flow = await make();
    expect(toggleCollapsed(flow, 'a')).toBe(true);
    expect(isCollapsed(flow, 'a')).toBe(true);
    expect(hidden(flow).sort()).toEqual(['a1', 'a2']);
    await frames(2);
    const edgeIds = [...flow.store.getLayoutedEdges().keys()];
    expect(edgeIds).not.toContain('a-a1');
    expect(edgeIds).toContain('root-a');

    expect(toggleCollapsed(flow, 'a')).toBe(false);
    expect(isCollapsed(flow, 'a')).toBe(false);
    expect(hidden(flow)).toEqual([]);
  });

  it('expanding keeps nodes that another collapsed node still hides', async () => {
    const flow = await make();
    toggleCollapsed(flow, 'a1'); // hides a2 (and shared2? no: b reaches it)
    expect(hidden(flow)).toEqual(['a2']);
    toggleCollapsed(flow, 'a'); // hides a1 and a2
    expect(hidden(flow).sort()).toEqual(['a1', 'a2']);
    toggleCollapsed(flow, 'a'); // a1 is still collapsed, so a2 stays hidden
    expect(hidden(flow)).toEqual(['a2']);
    expect(isCollapsed(flow, 'a1')).toBe(true);
  });

  it('can force a state, ignores unknown nodes, handles cycles', async () => {
    const flow = await mountFlow({
      nodes: [node('x'), node('y'), node('z')],
      edges: [edge('xy', 'x', 'y'), edge('yz', 'y', 'z'), edge('zx', 'z', 'x')],
    });
    expect(toggleCollapsed(flow, 'x', true)).toBe(true);
    expect(toggleCollapsed(flow, 'x', true)).toBe(true);
    expect(
      flow.nodes
        .filter((n) => n.hidden)
        .map((n) => n.id)
        .sort(),
    ).toEqual(['y', 'z']);
    expect(toggleCollapsed(flow, 'nope')).toBe(false);
    toggleCollapsed(flow, 'x', false);
    expect(flow.nodes.some((n) => n.hidden)).toBe(false);
  });

  it('is one history step per toggle', async () => {
    const flow = await make();
    const history = new LocalHistory(flow);
    toggleCollapsed(flow, 'root');
    expect(history.undoSize).toBe(1);
    expect(hidden(flow).length).toBeGreaterThan(3);
    history.undo();
    expect(hidden(flow)).toEqual([]);
    expect(isCollapsed(flow, 'root')).toBe(false);
    history.redo();
    expect(isCollapsed(flow, 'root')).toBe(true);
  });

  it('collapseAll leaves the roots (and nodes under two roots) visible; expandAll restores everything', async () => {
    const flow = await make();
    const history = new LocalHistory(flow);
    const collapsed = collapseAll(flow);
    expect(collapsed).toContain('root');
    expect(
      flow.nodes
        .filter((n) => !n.hidden)
        .map((n) => n.id)
        .sort(),
    ).toEqual(['other', 'root', 'shared']);
    expect(history.undoSize).toBe(1);
    const expanded = expandAll(flow);
    expect(expanded.sort()).toEqual([...collapsed].sort());
    expect(hidden(flow)).toEqual([]);
    expect(flow.nodes.some((n) => n.data.collapsed === true)).toBe(false);
    expect(history.undoSize).toBe(2);
  });

  it('keeps unrelated hidden nodes hidden', async () => {
    const flow = await mountFlow({
      nodes: [node('r'), node('c'), node('h', 0, 0, { hidden: true })],
      edges: [edge('rc', 'r', 'c')],
    });
    toggleCollapsed(flow, 'r');
    toggleCollapsed(flow, 'r');
    expect(flow.nodes.find((n) => n.id === 'h')!.hidden).toBe(true);
  });
});
