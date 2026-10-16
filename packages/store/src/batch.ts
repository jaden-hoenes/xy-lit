// Ported from xyflow (MIT) packages/react/src/components/BatchProvider/{index.tsx,useQueue.ts}@3d35b57

/** An update to a list: the next list, or a function from the current list to the next one. */
export type QueueItem<T> = T[] | ((items: T[]) => T[]);

/**
 * Collects `setNodes` / `setEdges` payloads and runs them once per microtask, so several calls
 * in the same tick are folded into one change batch (React's `BatchProvider`).
 */
export class SetQueue<T> {
  private queue: QueueItem<T>[] = [];
  private scheduled = false;

  /**
   * @param run - Called with every payload collected since the last run, in call order.
   */
  constructor(private readonly run: (items: QueueItem<T>[]) => void) {}

  /** Number of payloads waiting. */
  get size(): number {
    return this.queue.length;
  }

  /** Add a payload; the queue runs in a microtask. */
  push(item: QueueItem<T>): void {
    this.queue.push(item);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => {
        this.flush();
      });
    }
  }

  /** Run the queue now (used to keep call order with operations that do not use the queue). */
  flush(): void {
    this.scheduled = false;
    const items = this.queue;
    if (items.length === 0) return;
    this.queue = [];
    this.run(items);
  }
}

/**
 * Fold queued payloads into the next list: like `Array.reduce`, where a function payload gets the
 * result so far and an array payload replaces it.
 *
 * @param current - The list before the payloads.
 * @param items - Payloads in call order.
 */
export function foldQueue<T>(current: T[], items: readonly QueueItem<T>[]): T[] {
  let next = current;
  for (const payload of items) {
    next = typeof payload === 'function' ? payload(next) : payload;
  }
  return next;
}
