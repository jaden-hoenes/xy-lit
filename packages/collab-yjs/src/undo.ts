import * as Y from 'yjs';
import type { FlowHistory } from '@xy-lit/store';
import { LOCAL } from './origins.js';

/** The local selection saved with every undo step (spec/11 §Undo). */
export type SelectionSnapshot = { nodes: string[]; edges: string[] };

/** What {@link YjsHistory} needs from the source: read and restore the local selection. */
export type SelectionAccess = {
  get(): SelectionSnapshot;
  restore(snapshot: SelectionSnapshot): void;
};

/**
 * `FlowHistory` on top of `Y.UndoManager`. Only `LOCAL` transactions are tracked, so undo never
 * touches what other users did; live drags only touch the local overlay, so one drag is one step.
 */
export class YjsHistory implements FlowHistory {
  /** The underlying `Y.UndoManager`, for tracked origins and custom capture rules. */
  readonly undoManager: Y.UndoManager;
  readonly #listeners = new Set<() => void>();
  readonly #notify = (): void => {
    for (const listener of [...this.#listeners]) listener();
  };
  readonly #added = (e: { stackItem: { meta: Map<unknown, unknown> } }): void => {
    e.stackItem.meta.set('selection', this.#selection.get());
  };
  readonly #popped = (e: { stackItem: { meta: Map<unknown, unknown> } }): void => {
    const snapshot = e.stackItem.meta.get('selection') as SelectionSnapshot | undefined;
    if (snapshot) this.#selection.restore(snapshot);
  };
  readonly #selection: SelectionAccess;

  /**
   * @param scope - The maps whose changes can be undone (nodes and edges).
   * @param selection - Local selection access.
   * @param captureTimeout - Edits closer together than this (ms) merge into one step.
   */
  constructor(scope: Y.Map<Y.Map<unknown>>[], selection: SelectionAccess, captureTimeout = 400) {
    this.#selection = selection;
    this.undoManager = new Y.UndoManager(scope, {
      trackedOrigins: new Set([LOCAL]),
      captureTimeout,
    });
    const um = this.undoManager;
    um.on('stack-item-added', this.#added);
    um.on('stack-item-added', this.#notify);
    um.on('stack-item-updated', this.#notify);
    um.on('stack-item-popped', this.#popped);
    um.on('stack-item-popped', this.#notify);
    um.on('stack-cleared', this.#notify);
  }

  undo(): void {
    this.undoManager.undo();
  }

  redo(): void {
    this.undoManager.redo();
  }

  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** End the current step: the next local edit starts a new one. */
  stopCapturing(): void {
    this.undoManager.stopCapturing();
  }

  /** Forget all steps. */
  clear(): void {
    this.undoManager.clear();
  }

  /** Stop tracking. */
  destroy(): void {
    this.undoManager.destroy();
    this.#listeners.clear();
  }
}
