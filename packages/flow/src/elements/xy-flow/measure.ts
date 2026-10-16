import type { FlowStore, InternalNodeUpdate } from '@xy-lit/store';

/** The part of `<xy-node>` the measure controller needs. */
export interface MeasurableNode extends HTMLElement {
  /** The id of the node this element renders. */
  readonly nodeId: string | undefined;
}

/**
 * Measures the `<xy-node>`s of one flow. One shared `ResizeObserver` reports size changes; handles
 * and the instance API ask for explicit re-measures (`requestMeasure`), which are batched into one
 * `store.updateNodeInternals()` call per animation frame.
 *
 * Resize observer batches are flushed synchronously inside the callback: it already runs once per
 * frame after layout, so nodes never spend an extra frame hidden.
 */
export class MeasureController {
  private store: FlowStore | null = null;
  private observer: ResizeObserver | null = null;
  private readonly elements = new Map<string, MeasurableNode>();
  private readonly ids = new WeakMap<Element, string>();
  private readonly pending = new Map<string, InternalNodeUpdate>();
  private frame = 0;

  /**
   * Start measuring for a store: creates the observer and installs `store.requestNodeMeasure`
   * (used by `instance.updateNodeInternals()`).
   *
   * @param store - The flow's store.
   */
  start(store: FlowStore): void {
    this.stop();
    this.store = store;
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = this.ids.get(entry.target);
          const element = id === undefined ? undefined : this.elements.get(id);
          if (id !== undefined && element) {
            this.pending.set(id, {
              id,
              nodeElement: element as unknown as HTMLDivElement,
              force: true,
            });
          }
        }
        this.flush();
      });
    }
    store.requestNodeMeasure = (ids) => {
      this.requestMeasure(ids);
    };
    // elements registered before the store was known
    for (const element of this.elements.values()) this.observer?.observe(element);
  }

  /** Stop observing and drop pending work (the elements stay registered for `start`). */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending.clear();
    if (this.store?.requestNodeMeasure) this.store.requestNodeMeasure = null;
    this.store = null;
  }

  /**
   * Observe a node element. The element must have `nodeId` set.
   *
   * @param element - The `<xy-node>`.
   */
  observe(element: MeasurableNode): void {
    const id = element.nodeId;
    if (id === undefined) return;
    const known = this.elements.get(id);
    if (known === element) return;
    if (known) this.observer?.unobserve(known);
    this.elements.set(id, element);
    this.ids.set(element, id);
    this.observer?.observe(element);
  }

  /**
   * Make the observer report the element again, even though its size did not change (an observer
   * always delivers an initial observation). Used when the engine forgot the node's measurement,
   * for example after the node object was replaced.
   *
   * @param element - The `<xy-node>`.
   */
  remeasure(element: MeasurableNode): void {
    if (!this.observer || this.elements.get(element.nodeId ?? '') !== element) return;
    this.observer.unobserve(element);
    this.observer.observe(element);
  }

  /**
   * Stop observing a node element.
   *
   * @param element - The `<xy-node>`.
   */
  unobserve(element: MeasurableNode): void {
    const id = this.ids.get(element);
    if (id !== undefined && this.elements.get(id) === element) this.elements.delete(id);
    this.ids.delete(element);
    this.observer?.unobserve(element);
    if (id !== undefined) this.pending.delete(id);
  }

  /**
   * Re-measure nodes (size and handle bounds) in the next animation frame. Unknown ids are
   * ignored.
   *
   * @param ids - Node ids.
   * @param force - Update even when the size did not change (default true).
   */
  requestMeasure(ids: string[], force = true): void {
    for (const id of ids) {
      const element = this.elements.get(id);
      if (!element) continue;
      const previous = this.pending.get(id);
      this.pending.set(id, {
        id,
        nodeElement: element as unknown as HTMLDivElement,
        force: force || previous?.force === true,
      });
    }
    if (this.pending.size > 0 && !this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.flush(false);
      });
    }
  }

  /**
   * Send everything pending to the store now.
   *
   * @param triggerFitView - Resolve a queued `fitView` after this batch (default true). The
   * frame-driven batch of `requestMeasure` passes false: it can run before the resize observer
   * delivered the first measurement of every node (a handle asks for its own node first), and a
   * fit resolved from a partial batch would leave out the nodes that are measured a moment later
   * (a `group` node with a declared size). The observer batch always follows and resolves the fit.
   */
  flush(triggerFitView = true): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    if (!this.store || this.pending.size === 0) return;
    const updates = new Map(this.pending);
    this.pending.clear();
    this.store.updateNodeInternals(updates, { triggerFitView });
  }
}
