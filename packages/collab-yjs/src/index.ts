/**
 * `@xy-lit/collab-yjs`: collaboration as a `FlowDataSource`. The flow does not know about Yjs; the
 * app does `flow.source = new YjsFlowSource(doc, { awareness, user })`.
 *
 * Importing this module does not register elements; import `@xy-lit/collab-yjs/define.js` for that.
 *
 * @packageDocumentation
 */

export { YjsFlowSource, applyTextDiff } from './yjs-flow-source.js';
export type { YjsFlowSourceOptions } from './yjs-flow-source.js';
export { LOCAL, HEAL, MIGRATION, SERVER } from './origins.js';
export {
  SCHEMA_VERSION,
  DEFAULT_KEYS,
  NODE_LOCAL_KEYS,
  EDGE_LOCAL_KEYS,
  SchemaError,
  toYNode,
  toYEdge,
  fromYNode,
  fromYEdge,
  getMaps,
} from './schema.js';
export type { DocKeys, DocMaps } from './schema.js';
export { PresenceChannel, PRESENCE_FIELD } from './awareness.js';
export type { PresenceState } from './awareness.js';
export { orderAndRepair, validateDoc, healDoc } from './repair.js';
export type { RepairIssue, RepairResult } from './repair.js';
export { runMigrations } from './migrations.js';
export type { Migration, MigrationResult } from './migrations.js';
export { YjsHistory } from './undo.js';
export type { SelectionSnapshot } from './undo.js';
export type { NodeOverlay, EdgeOverlay } from './overlay.js';

// elements and controllers ---------------------------------------------------------------------
export { XyRemoteCursorsElement, readableOn } from './elements/xy-remote-cursors.js';
export { XyPresenceAvatarsElement } from './elements/xy-presence-avatars.js';
export type { FollowChangeDetail } from './elements/xy-presence-avatars.js';
export { PresenceController } from './controllers/presence-controller.js';
export type { PresenceControllerCallbacks } from './controllers/presence-controller.js';
