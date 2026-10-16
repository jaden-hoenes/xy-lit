import type { ReactiveController } from 'lit';
import type { FlowEventMap, FlowStore } from '@xy-lit/store';
import type { XyFlowElement } from '../xy-flow.js';

type RenderCompleteDetail = FlowEventMap['render-complete'];

/**
 * Decides when a flow has rendered everything it knows about, once per structure revision.
 *
 * A *revision* is `store.structureRevision`: it changes when the set of node or edge ids
 * changes, or when a data source is attached. When it changes the controller records a start
 * time and arms. It is ready when every rendered node is measured (`nodesInitialized`, or every
 * visible node when only visible elements are rendered), every laid-out edge has an `<xy-edge>`
 * that rendered, and no `fitView` is waiting. Two animation frames later, if the revision did
 * not change meanwhile, it emits `render-complete`, resolves `whenRendered()` promises and
 * hides the loading overlay. A newer revision cancels a pending emit. A flow without nodes is
 * ready as soon as it rendered.
 */
export class RenderCompleteController implements ReactiveController {
  readonly #renderedEdges = new Set<string>();
  #waiters: ((detail: RenderCompleteDetail) => void)[] = [];
  #store: FlowStore | null = null;
  #unsubscribe: (() => void) | null = null;
  /** The revision being waited for (or last completed). -1 before the first look. */
  #revision = -1;
  #startedAt = 0;
  #complete = false;
  #last: RenderCompleteDetail | null = null;
  /** Bumped to invalidate frames that are already scheduled. */
  #generation = 0;
  #pending = false;

  constructor(private readonly host: XyFlowElement) {
    host.addController(this);
  }

  hostConnected(): void {
    // the store is attached by the host once it exists (`attach`)
  }

  hostUpdated(): void {
    this.#evaluate();
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#generation++;
    this.#pending = false;
  }

  /**
   * Start watching a store (called by the host whenever it (re)connects).
   *
   * @param store - The flow's store.
   */
  attach(store: FlowStore): void {
    if (this.#store !== store) {
      this.#store = store;
      this.#revision = -1;
      this.#complete = false;
      this.#last = null;
      this.#renderedEdges.clear();
      this.#generation++;
      this.#pending = false;
    }
    this.#unsubscribe?.();
    this.#unsubscribe = store.subscribe(() => {
      this.#evaluate();
    });
  }

  /** The flow got another data source: wait for a first render again. */
  reset(): void {
    this.#complete = false;
    this.#generation++;
    this.#pending = false;
  }

  /** An `<xy-edge>` finished rendering. */
  edgeRendered(id: string): void {
    this.#renderedEdges.add(id);
    this.#evaluate();
  }

  /** An `<xy-edge>` went away. */
  edgeRemoved(id: string): void {
    this.#renderedEdges.delete(id);
  }

  /**
   * Resolves with the detail of the next `render-complete`, or immediately with the last one when
   * the current revision has already completed.
   */
  whenRendered(): Promise<RenderCompleteDetail> {
    if (this.#complete && this.#last) return Promise.resolve(this.#last);
    return new Promise((resolve) => {
      this.#waiters.push(resolve);
      this.#evaluate();
    });
  }

  #isReady(store: FlowStore): boolean {
    const s = store.getState();
    if (s.fitViewQueued) return false;
    if (s.nodes.length > 0 && !s.nodesInitialized) {
      if (!s.onlyRenderVisibleElements) return false;
      for (const node of store.getVisibleNodes()) {
        if (node.measured.width === undefined || node.measured.height === undefined) return false;
      }
    }
    for (const id of store.getLayoutedEdges().keys()) {
      if (!this.#renderedEdges.has(id)) return false;
    }
    return true;
  }

  #evaluate(): void {
    const { host } = this;
    const store = this.#store;
    if (!store || !host.isConnected || !host.hasUpdated) return;
    const revision = store.getState().structureRevision;
    if (revision !== this.#revision) {
      // a new structure: start over (a pending emit of the old revision is dropped)
      this.#revision = revision;
      this.#startedAt = performance.now();
      this.#complete = false;
      this.#generation++;
      this.#pending = false;
    }
    if (this.#complete || this.#pending || !this.#isReady(store)) return;

    this.#pending = true;
    const generation = this.#generation;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (generation !== this.#generation) return;
        this.#pending = false;
        if (!host.isConnected) return;
        if (store.getState().structureRevision !== this.#revision || !this.#isReady(store)) {
          this.#evaluate();
          return;
        }
        this.#emit(store);
      });
    });
  }

  #emit(store: FlowStore): void {
    const detail: RenderCompleteDetail = {
      revision: this.#revision,
      nodeCount: store.getState().nodes.length,
      edgeCount: store.getLayoutedEdges().size,
      durationMs: performance.now() - this.#startedAt,
    };
    this.#complete = true;
    this.#last = detail;
    this.host.setFirstRenderComplete();
    this.host.emit('render-complete', detail);
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const resolve of waiters) resolve(detail);
  }
}
