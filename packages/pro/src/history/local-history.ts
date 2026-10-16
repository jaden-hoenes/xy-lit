import { createId } from '@xy-lit/store';
import type {
  ChangeMeta,
  ChangeOrigin,
  EdgeChange,
  FlowHistory,
  FlowStore,
  NodeChange,
} from '@xy-lit/store';
import { withStore } from '../common.js';
import type { Disposer, FlowLike } from '../common.js';
import { applyEntry, invertEdgeChanges, invertEntry, invertNodeChanges } from './invert.js';
import type { Entry } from './invert.js';

/** Options of {@link LocalHistory}. */
export interface LocalHistoryOptions {
  /** Most steps kept on the undo stack. Default 100. */
  maxSteps?: number;
  /**
   * Change origins that are never recorded, in addition to `undo`, `measure`, `select` and
   * `remote` (collaborators' edits are not yours to undo).
   */
  ignoreOrigins?: ChangeOrigin[];
}

/** Ids of the selected nodes and edges, saved with a step. */
interface Selection {
  nodes: string[];
  edges: string[];
}

/** One undoable unit: batches in the order they were applied, newest last. */
interface Step {
  /** Entries that undo the step when applied newest-first. */
  entries: Entry[];
  /** Selection to restore after applying the step. */
  selection: Selection;
  /** Shared by all batches of a multi-trigger operation, so they merge into one step. */
  gestureId: string | undefined;
}

/** What a running gesture (drag, resize, animation) has seen so far. */
interface OpenGesture {
  selection: Selection;
  /** Inverse of the first change seen per element and kind (`p:id`, `d:id`). */
  inverse: Map<string, { change: NodeChange; after: unknown }>;
  /** Add/remove/replace batches that arrived during the gesture (inverted immediately). */
  extra: Entry[];
}

const NEVER_RECORDED = new Set<ChangeOrigin>(['undo', 'measure', 'select', 'remote']);

/**
 * Local undo/redo built on the change pipeline. It records the inverse of every document change
 * (position, size, add, remove, replace) from the state before the change is applied, and plays
 * them back through `triggerNodeChanges` / `triggerEdgeChanges` with
 * `{ phase: 'discrete', origin: 'undo' }`, so controlled apps see ordinary `nodes-change`
 * events they can apply.
 *
 * - A gesture (`start` / `live` / `end` sharing a `gestureId`: drag, resize, animation) is one
 *   step, pushed at `end`; steps that end where they started are dropped.
 * - Batches that share a `gestureId` (`deleteElements`, paste, layout) are one step.
 * - Selection, measurement and `dragging`-only changes are not recorded; the selection is saved
 *   with each step and restored by undo and redo.
 * - It registers itself with `store.setHistory(this)`. A data source that has its own history
 *   (`YjsFlowSource`) wins: `store.history` is then the source's, this object turns inert
 *   ({@link LocalHistory.active} is false, nothing is recorded, `canUndo()` is false).
 *
 * Redo steps are computed from the live state when you undo, so the recorded steps do not depend
 * on the order in which other change middlewares (helper lines) were installed.
 */
export class LocalHistory implements FlowHistory {
  readonly #maxSteps: number;
  readonly #ignored: Set<ChangeOrigin>;
  readonly #listeners = new Set<() => void>();
  #undoStack: Step[] = [];
  #redoStack: Step[] = [];
  readonly #open = new Map<string, OpenGesture>();
  #store: FlowStore | null = null;
  #detach: Disposer | null = null;
  #source: unknown = null;
  #disposed = false;
  #paused = 0;
  #batchId: string | null = null;

  /**
   * @param flow - The `<xy-flow>` (may not be connected yet) or its instance.
   * @param options - See {@link LocalHistoryOptions}.
   */
  constructor(flow: FlowLike, options: LocalHistoryOptions = {}) {
    this.#maxSteps = Math.max(1, options.maxSteps ?? 100);
    this.#ignored = new Set([...NEVER_RECORDED, ...(options.ignoreOrigins ?? [])]);
    this.#detach = withStore(flow, (store) => this.#attach(store));
  }

  #attach(store: FlowStore): Disposer {
    this.#store = store;
    this.#source = store.source;
    store.setHistory(this);
    const offNodes = store.addNodeChangeMiddleware((changes, meta) => {
      this.#record('node', changes, meta);
      return changes;
    });
    const offEdges = store.addEdgeChangeMiddleware((changes, meta) => {
      this.#record('edge', changes, meta);
      return changes;
    });
    // a new data source is a new document: nothing recorded so far applies to it
    const offStore = store.subscribe(() => {
      if (store.source !== this.#source) {
        this.#source = store.source;
        this.clear();
      }
    });
    return () => {
      offNodes();
      offEdges();
      offStore();
      // also when a source's history won: our registration would resurface when it detaches
      if (store.history === this || store.source.history) store.setHistory(null);
      this.#store = null;
    };
  }

  /** Whether this history is the one the flow uses (false while a source's own history wins). */
  get active(): boolean {
    const store = this.#store;
    return !!store && !this.#disposed && store.history === this;
  }

  /** Steps that can be undone. */
  get undoSize(): number {
    return this.active ? this.#undoStack.length : 0;
  }

  /** Steps that can be redone. */
  get redoSize(): number {
    return this.active ? this.#redoStack.length : 0;
  }

  canUndo(): boolean {
    return this.undoSize > 0;
  }

  canRedo(): boolean {
    return this.redoSize > 0;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Undo the newest step. Does nothing when there is none. */
  undo(): void {
    this.#run(this.#undoStack, this.#redoStack);
  }

  /** Redo the newest undone step. Does nothing when there is none. */
  redo(): void {
    this.#run(this.#redoStack, this.#undoStack);
  }

  /** Forget every step. */
  clear(): void {
    if (!this.#undoStack.length && !this.#redoStack.length && !this.#open.size) return;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#open.clear();
    this.#notify();
  }

  /**
   * Run `fn` and record everything it changes as one step (even when it makes several
   * `deleteElements`, `addNodes` or `updateNodeData` calls). Gestures started inside keep their
   * own step.
   */
  batch<T>(fn: () => T): T {
    const outer = this.#batchId;
    this.#batchId ??= createId();
    try {
      return fn();
    } finally {
      this.#batchId = outer;
    }
  }

  /** Run `fn` without recording what it changes (programmatic loads, remote-like updates). */
  withoutRecording<T>(fn: () => T): T {
    this.#paused++;
    try {
      return fn();
    } finally {
      this.#paused--;
    }
  }

  /** Detach from the flow: remove the middlewares and unregister as `store.history`. */
  dispose(): void {
    if (this.#disposed) return;
    this.#detach?.();
    this.#disposed = true;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#open.clear();
    this.#listeners.clear();
  }

  // ---------------------------------------------------------------------------------------------

  #notify(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch (error) {
        console.error(error);
      }
    }
  }

  #selection(store: FlowStore): Selection {
    const { nodes, edges } = store.getState();
    return {
      nodes: nodes.filter((n) => n.selected).map((n) => n.id),
      edges: edges.filter((e) => e.selected).map((e) => e.id),
    };
  }

  #record(kind: 'node' | 'edge', changes: NodeChange[] | EdgeChange[], meta: ChangeMeta): void {
    const store = this.#store;
    if (!store || this.#disposed || this.#paused) return;
    if (this.#ignored.has(meta.origin)) return;
    if (store.history !== this) {
      // a source with its own history won: stay out of the way
      if (this.#undoStack.length || this.#redoStack.length) this.clear();
      return;
    }

    if (meta.gestureId && meta.phase !== 'discrete') {
      this.#recordGesture(store, kind, changes, meta, meta.gestureId);
      return;
    }

    const entry: Entry =
      kind === 'node'
        ? { kind, changes: invertNodeChanges(changes as NodeChange[], store) }
        : { kind, changes: invertEdgeChanges(changes as EdgeChange[], store) };
    if (!entry.changes.length) return;
    this.#push({
      entries: [entry],
      selection: this.#selection(store),
      gestureId: meta.gestureId ?? this.#batchId ?? undefined,
    });
  }

  #recordGesture(
    store: FlowStore,
    kind: 'node' | 'edge',
    changes: NodeChange[] | EdgeChange[],
    meta: ChangeMeta,
    id: string,
  ): void {
    if (meta.phase === 'start') {
      // a gesture that never ended (cancelled) must not leak into this one
      for (const other of [...this.#open.keys()]) if (other !== id) this.#finish(other);
    }
    let gesture = this.#open.get(id);
    if (!gesture) {
      gesture = { selection: this.#selection(store), inverse: new Map(), extra: [] };
      this.#open.set(id, gesture);
    }
    for (const change of changes) {
      if (kind === 'node' && (change.type === 'position' || change.type === 'dimensions')) {
        const node = change;
        const key = `${change.type === 'position' ? 'p' : 'd'}:${node.id}`;
        const value = change.type === 'position' ? change.position : change.dimensions;
        const seen = gesture.inverse.get(key);
        if (seen) {
          if (value) seen.after = value;
          continue;
        }
        const [inverse] = invertNodeChanges([change], store);
        if (inverse) gesture.inverse.set(key, { change: inverse, after: value });
      } else if (change.type === 'add' || change.type === 'remove' || change.type === 'replace') {
        const entry: Entry =
          kind === 'node'
            ? { kind, changes: invertNodeChanges([change as NodeChange], store) }
            : { kind, changes: invertEdgeChanges([change as EdgeChange], store) };
        if (entry.changes.length) gesture.extra.push(entry);
      }
    }
    if (meta.phase === 'end') {
      // the end batch of the other kind (edges) may still follow in the same tick; finish now
      this.#finish(id);
    }
  }

  #finish(id: string): void {
    const gesture = this.#open.get(id);
    this.#open.delete(id);
    if (!gesture) return;
    const changes: NodeChange[] = [];
    for (const { change, after } of gesture.inverse.values()) {
      if (change.type === 'position' && change.position) {
        const to = after as { x: number; y: number } | undefined;
        if (to && to.x === change.position.x && to.y === change.position.y) continue;
      } else if (change.type === 'dimensions' && change.dimensions) {
        const to = after as { width: number; height: number } | undefined;
        if (to && to.width === change.dimensions.width && to.height === change.dimensions.height) {
          continue;
        }
      }
      changes.push(change);
    }
    const entries: Entry[] = [...gesture.extra];
    if (changes.length) entries.push({ kind: 'node', changes });
    if (!entries.length) return;
    this.#push({ entries, selection: gesture.selection, gestureId: id });
  }

  #push(step: Step): void {
    const top = this.#undoStack[this.#undoStack.length - 1];
    if (top && step.gestureId && top.gestureId === step.gestureId) {
      top.entries.push(...step.entries);
    } else {
      this.#undoStack.push(step);
      if (this.#undoStack.length > this.#maxSteps) this.#undoStack.shift();
    }
    this.#redoStack = [];
    this.#notify();
  }

  #run(from: Step[], to: Step[]): void {
    const store = this.#store;
    if (!store || !this.active) return;
    // a gesture still open (undo pressed mid-drag) is finished first
    for (const id of [...this.#open.keys()]) this.#finish(id);
    const step = from.pop();
    if (!step) return;

    const meta: ChangeMeta = { phase: 'discrete', origin: 'undo', gestureId: createId() };
    const counter: Step = {
      entries: [],
      selection: this.#selection(store),
      gestureId: undefined,
    };
    this.#paused++;
    try {
      for (let i = step.entries.length - 1; i >= 0; i--) {
        const entry = step.entries[i]!;
        // invert against the state this entry is about to change: that is the counter step
        const inverse = invertEntry(entry, store);
        if (inverse.changes.length) counter.entries.push(inverse);
        applyEntry(entry, store, meta);
      }
      this.#restoreSelection(store, step.selection, meta);
    } finally {
      this.#paused--;
    }
    if (counter.entries.length) to.push(counter);
    this.#notify();
  }

  #restoreSelection(store: FlowStore, selection: Selection, meta: ChangeMeta): void {
    const wantNodes = new Set(selection.nodes);
    const wantEdges = new Set(selection.edges);
    const { nodes, edges } = store.getState();
    const nodeChanges: NodeChange[] = [];
    for (const node of nodes) {
      if (!!node.selected !== wantNodes.has(node.id)) {
        nodeChanges.push({ id: node.id, type: 'select', selected: wantNodes.has(node.id) });
      }
    }
    const edgeChanges: EdgeChange[] = [];
    for (const edge of edges) {
      if (!!edge.selected !== wantEdges.has(edge.id)) {
        edgeChanges.push({ id: edge.id, type: 'select', selected: wantEdges.has(edge.id) });
      }
    }
    const selectMeta: ChangeMeta = { ...meta, origin: 'undo' };
    store.triggerNodeChanges(nodeChanges, selectMeta);
    store.triggerEdgeChanges(edgeChanges, selectMeta);
  }
}
