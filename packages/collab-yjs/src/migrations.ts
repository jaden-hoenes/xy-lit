import type * as Y from 'yjs';
import { MIGRATION } from './origins.js';
import { SCHEMA_VERSION } from './schema.js';
import type { DocMaps } from './schema.js';

/** One step of a schema migration (spec/11 §Migrations). Runs inside a `MIGRATION` transaction. */
export type Migration = {
  from: number;
  to: number;
  run(
    doc: Y.Doc,
    maps: { nodes: Y.Map<any>; edges: Y.Map<any>; meta: Y.Map<any> }, // eslint-disable-line @typescript-eslint/no-explicit-any -- migrations see arbitrary legacy shapes
  ): void;
};

/** Outcome of {@link runMigrations}. */
export type MigrationResult =
  /** Schema written or already current. */
  | { status: 'current' }
  /** The chain ran; `from` and `to` are the versions before and after. */
  | { status: 'migrated'; from: number; to: number }
  /** The document is newer than this client understands: treat it as read-only (`XYL21`). */
  | { status: 'too-new'; found: number }
  /** No migration path from `found` to the current schema. */
  | { status: 'no-path'; found: number };

/**
 * Bring the document to {@link SCHEMA_VERSION}.
 *
 * - `meta.schema` missing and the document empty: write the current version.
 * - `meta.schema` missing on a document with content: treated as version 0 when a migration
 *   starts there, else as current.
 * - lower: run the matching chain in one `MIGRATION` transaction and write the new version.
 * - higher: report `too-new`, write nothing.
 *
 * Call it only after the provider synced, or an empty local document may overwrite the real one.
 */
export function runMigrations(
  doc: Y.Doc,
  maps: DocMaps,
  migrations: readonly Migration[] = [],
): MigrationResult {
  const stored = maps.meta.get('schema');
  const empty = maps.nodes.size === 0 && maps.edges.size === 0;
  let version: number;
  if (typeof stored === 'number') version = stored;
  else if (empty || !migrations.some((m) => m.from === 0)) version = SCHEMA_VERSION;
  else version = 0;

  if (version > SCHEMA_VERSION) return { status: 'too-new', found: version };
  if (version === SCHEMA_VERSION) {
    if (stored !== SCHEMA_VERSION) {
      doc.transact(() => {
        maps.meta.set('schema', SCHEMA_VERSION);
        if (!maps.meta.has('createdAt')) maps.meta.set('createdAt', Date.now());
      }, MIGRATION);
    }
    return { status: 'current' };
  }

  const chain: Migration[] = [];
  let at = version;
  while (at < SCHEMA_VERSION) {
    const step = migrations.find((m) => m.from === at && m.to > at);
    if (!step) return { status: 'no-path', found: version };
    chain.push(step);
    at = step.to;
  }
  doc.transact(() => {
    for (const step of chain) step.run(doc, maps);
    maps.meta.set('schema', at);
  }, MIGRATION);
  return { status: 'migrated', from: version, to: at };
}
