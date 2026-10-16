import { afterEach, describe, expect, it } from 'vitest';
import { uiNodeTypes } from '../src/index.js';
import { cleanup, mountFlow, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

const users = {
  label: 'users',
  schema: [
    { title: 'id', type: 'uuid', key: 'PK' as const },
    { title: 'email', type: 'varchar' },
  ],
};
const orders = {
  label: 'orders',
  schema: [
    { title: 'id', type: 'uuid', key: 'PK' as const },
    { title: 'user_id', type: 'uuid', key: 'FK' as const },
    { title: 'total', type: 'numeric' },
  ],
};

const mount = () =>
  mountFlow({
    nodes: [
      { id: 'orders', type: 'databaseSchema', position: { x: 0, y: 0 }, data: orders },
      { id: 'users', type: 'databaseSchema', position: { x: 360, y: 0 }, data: users },
    ],
    edges: [
      {
        id: 'fk',
        source: 'orders',
        sourceHandle: 'user_id',
        target: 'users',
        targetHandle: 'id',
        startLabel: 'N',
        endLabel: '1',
      },
    ],
    props: { nodeTypes: uiNodeTypes },
  });

describe('databaseSchemaNode', () => {
  it('renders the table name and one row per column with PK/FK badges', async () => {
    const flow = await mount();
    const el = nodeEl(flow, 'orders').querySelector('xy-base-node')!;
    expect(el.querySelector('.xy-ui-schema__title')?.textContent?.trim()).toBe('orders');
    const rows = [...el.querySelectorAll('tr')];
    expect(rows.map((r) => r.querySelector('.xy-ui-schema__name')?.textContent)).toEqual([
      'id',
      'user_id',
      'total',
    ]);
    expect(rows.map((r) => r.querySelector('.xy-ui-schema__key')?.textContent)).toEqual([
      'PK',
      'FK',
      '',
    ]);
    expect(rows[1]?.querySelector('.xy-ui-schema__type')?.textContent?.trim()).toBe('uuid');
  });

  it('is as wide as its content, not as the page', async () => {
    const flow = await mount();
    const w = nodeEl(flow, 'orders').getBoundingClientRect().width;
    expect(w).toBeGreaterThanOrEqual(228);
    expect(w).toBeLessThan(400);
  });

  it('has a target handle on the left and a source handle on the right per row, ids are the column names', async () => {
    const flow = await mount();
    const bounds = await waitFor(
      () =>
        flow.getInternalNode('orders')?.internals.handleBounds?.source?.length === 3 &&
        flow.getInternalNode('orders')?.internals.handleBounds,
    );
    expect(bounds.source?.map((h) => h.id)).toEqual(['id', 'user_id', 'total']);
    expect(bounds.target?.map((h) => h.id)).toEqual(['id', 'user_id', 'total']);
    expect(bounds.source?.every((h) => h.position === 'right')).toBe(true);
    expect(bounds.target?.every((h) => h.position === 'left')).toBe(true);
    // each pair sits at the height of its row (within a pixel: WebKit snaps the handle to whole pixels)
    const row = nodeEl(flow, 'orders').querySelectorAll('tr')[1]!.getBoundingClientRect();
    const handle = nodeEl(flow, 'orders')
      .querySelector('xy-handle[handle-id="user_id"]')!
      .getBoundingClientRect();
    expect(
      Math.abs(handle.top + handle.height / 2 - (row.top + row.height / 2)),
    ).toBeLessThanOrEqual(1);
  });

  it('connects column to column and draws cardinality labels', async () => {
    const flow = await mount();
    await waitFor(() => flow.renderRoot.querySelector('g[data-id="fk"] path'));
    expect(
      flow.getHandleConnections({ type: 'source', nodeId: 'orders', id: 'user_id' }),
    ).toHaveLength(1);
    expect(flow.getHandleConnections({ type: 'target', nodeId: 'users', id: 'id' })).toHaveLength(
      1,
    );
    const labels = await waitFor(() => {
      const all = [...flow.renderRoot.querySelectorAll('.lit-flow__edge-label')];
      return all.length === 2 ? all : undefined;
    });
    expect(labels.map((l) => l.textContent?.trim()).sort()).toEqual(['1', 'N']);
  });
});
