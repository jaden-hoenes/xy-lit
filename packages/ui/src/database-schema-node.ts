import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { uiStyles } from './styles.js';

/** A column of a {@link databaseSchemaNode}. */
export type SchemaField = {
  /** Column name; also the id of the column's handles. */
  title: string;
  /** Column type, shown on the right. */
  type: string;
  /** Primary or foreign key badge. */
  key?: 'PK' | 'FK';
};

/** `data` of a {@link databaseSchemaNode}. */
export type DatabaseSchemaData = {
  /** Table name. */
  label: string;
  /** Columns, top to bottom. */
  schema: SchemaField[];
  [key: string]: unknown;
};

const tableIcon = html`<svg
  class="xy-ui-schema__icon"
  viewBox="0 0 16 16"
  width="14"
  height="14"
  fill="none"
  stroke="currentColor"
  stroke-width="1.4"
  aria-hidden="true"
>
  <rect x="1.7" y="2.7" width="12.6" height="10.6" rx="2" />
  <path d="M1.7 6.4h12.6M6.2 6.4v6.9" />
</svg>`;

/**
 * A database table: a header with the table name and one row per column. Every row has a
 * `target` handle on the left and a `source` handle on the right, both with the column name as
 * `handle-id`, so edges connect column to column (`sourceHandle: 'user_id'`). Pair it with edges
 * that use `startLabel` / `endLabel` for the cardinality (`1`, `N`).
 */
export const databaseSchemaNode = defineNodeType<Node<DatabaseSchemaData, 'databaseSchema'>>({
  styles: uiStyles,
  render: ({ data, selected }): TemplateResult =>
    html`<xy-base-node
      class="xy-ui-node xy-ui-schema"
      ?selected=${selected}
      style="--xy-base-node-padding: 0; --xy-base-node-min-width: 230px"
    >
      <div slot="header" class="xy-ui-schema__title">${tableIcon}<span>${data.label}</span></div>
      <table class="xy-ui-schema__table">
        <tbody>
          ${data.schema.map(
            (field) =>
              html`<tr class="xy-ui-schema__row">
                <td class="xy-ui-schema__cell xy-ui-schema__cell--start">
                  <xy-handle
                    type="target"
                    position="left"
                    handle-id=${field.title}
                    class="xy-ui-handle"
                  ></xy-handle>
                  <span
                    class="xy-ui-schema__key"
                    data-key=${field.key ?? ''}
                    title=${
                      field.key === 'PK' ? 'Primary key' : field.key === 'FK' ? 'Foreign key' : ''
                    }
                    >${field.key ?? ''}</span
                  >
                </td>
                <td class="xy-ui-schema__cell xy-ui-schema__name">${field.title}</td>
                <td class="xy-ui-schema__cell xy-ui-schema__cell--end xy-ui-schema__type">
                  ${field.type}
                  <xy-handle
                    type="source"
                    position="right"
                    handle-id=${field.title}
                    class="xy-ui-handle"
                  ></xy-handle>
                </td>
              </tr>`,
          )}
        </tbody>
      </table>
    </xy-base-node>`,
});
