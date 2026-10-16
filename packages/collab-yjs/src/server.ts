/**
 * `@xy-lit/collab-yjs/server`: document validation and healing for Node (no Lit, no DOM). Used by
 * `apps/collab-server` in a debounced `onChange` hook.
 */
export { validateDoc, healDoc, orderAndRepair } from './repair.js';
export type { RepairIssue, RepairResult } from './repair.js';
export { SERVER, HEAL, LOCAL, MIGRATION } from './origins.js';
export { SCHEMA_VERSION } from './schema.js';
