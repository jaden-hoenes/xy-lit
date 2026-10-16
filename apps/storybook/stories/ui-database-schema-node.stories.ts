import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { Edge, Node } from '@xy-lit/flow';
import { MarkerType } from '@xy-lit/flow';
import { uiNodeTypes } from '@xy-lit/ui';
import { defineStoryElement, describe } from './_lib/flow.ts';
import { UiStory } from './_lib/ui.ts';

const meta: Meta = { title: 'UI/Database Schema Node' };
export default meta;
type Story = StoryObj;

class SchemaStory extends UiStory<object> {
  constructor() {
    super();
    this.nodeTypes = { ...uiNodeTypes };
  }
  protected override nodes(): Node[] {
    return [
      {
        id: 'orders',
        type: 'databaseSchema',
        position: { x: 0, y: 0 },
        data: {
          label: 'orders',
          schema: [
            { title: 'id', type: 'uuid', key: 'PK' },
            { title: 'user_id', type: 'uuid', key: 'FK' },
            { title: 'total', type: 'numeric' },
            { title: 'status', type: 'varchar' },
            { title: 'placed_at', type: 'timestamp' },
          ],
        },
      },
      {
        id: 'users',
        type: 'databaseSchema',
        position: { x: 340, y: 20 },
        data: {
          label: 'users',
          schema: [
            { title: 'id', type: 'uuid', key: 'PK' },
            { title: 'email', type: 'varchar' },
            { title: 'name', type: 'varchar' },
            { title: 'created_at', type: 'timestamp' },
          ],
        },
      },
    ];
  }
  protected override edges(): Edge[] {
    return [
      {
        id: 'orders-users',
        source: 'orders',
        sourceHandle: 'user_id',
        target: 'users',
        targetHandle: 'id',
        type: 'smoothstep',
        startLabel: 'N',
        endLabel: '1',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      },
    ];
  }
}
defineStoryElement('sb-ui-schema', SchemaStory);

export const Default: Story = {
  render: () => html`<sb-ui-schema></sb-ui-schema>`,
  parameters: describe(
    '`databaseSchema` shows a table: `data: { label, schema: [{ title, type, key? }] }`. Every column has its own source and target handle (its `title` is the handle id), so an edge can run from one column to another and carry cardinality as start and end labels. `PK` and `FK` render as badges.',
  ),
};
