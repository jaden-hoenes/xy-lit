/**
 * Transaction origins of every write this package makes (spec/11 §Origins).
 *
 * Every write goes through `doc.transact(fn, origin)`. Local user edits use {@link LOCAL}, which
 * is the only origin the `Y.UndoManager` tracks. An undo/redo runs with the UndoManager itself as
 * origin.
 */

/** Local user edits. Tracked by the `Y.UndoManager`. */
export const LOCAL = Symbol('xy-lit/local');
/** Repair writes (dangling edges, broken parents). Not undoable. */
export const HEAL = 'xy-lit/heal';
/** Schema migrations and initial population. Not undoable. */
export const MIGRATION = 'xy-lit/migration';
/** Server-side repair (`apps/collab-server`). */
export const SERVER = 'server';
