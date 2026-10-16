import type { FlowStore } from '@xy-lit/store';

/**
 * Keeps `state.width` / `state.height` equal to the wrapper's client size (a second
 * `ResizeObserver`; the pan/zoom engine has its own). When a `fitView` is queued and the size
 * becomes non-zero it is resolved.
 */
export class ContainerSizeController {
  private observer: ResizeObserver | null = null;
  private element: HTMLElement | null = null;

  /**
   * Start observing.
   *
   * @param store - The flow's store.
   * @param element - The wrapper element (`store.domNode`).
   */
  observe(store: FlowStore, element: HTMLElement): void {
    this.disconnect();
    this.element = element;
    const apply = (): void => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const state = store.getState();
      if (state.width === width && state.height === height) return;
      store.setState({ width, height });
      if (width > 0 && height > 0 && store.getState().fitViewQueued) {
        void store.resolveFitView();
      }
    };
    apply();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(apply);
      this.observer.observe(element);
    }
  }

  /** Stop observing. */
  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.element = null;
  }

  /** The observed element, if any. */
  get target(): HTMLElement | null {
    return this.element;
  }
}
