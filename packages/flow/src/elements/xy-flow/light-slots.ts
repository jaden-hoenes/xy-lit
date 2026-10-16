import type { XyFlowElement } from '../xy-flow.js';

/** The `slot` names `<xy-flow>` knows, mapped to the class of the element that receives them. */
const TARGETS: Record<string, string> = {
  'viewport-back': '.lit-flow__viewport-back',
  'viewport-front': '.lit-flow__viewport-front',
  loading: '.lit-flow__loading',
};

/**
 * Slot projection for `render-root="light"` (spec/04, spec/10). Without a shadow root there are no
 * `<slot>` elements, so the flow's own light-DOM children (plugins such as `<xy-controls>`,
 * `<xy-viewport-portal>`, a `slot="loading"` element) would sit next to the rendered wrapper
 * instead of inside it. This moves them to where the shadow-root version puts them:
 *
 * - no `slot` attribute: the end of the `.lit-flow` wrapper (so plugin panels position against it);
 * - `slot="viewport-back"` / `"viewport-front"`: the matching viewport layer (flow coordinates);
 * - `slot="loading"`: the loading overlay, which then hides the default spinner.
 *
 * A `MutationObserver` on the host (child list only, not a document listener) projects children
 * that are added later. Projected elements keep working as descendants of the flow: context
 * requests, events and `flow.querySelector` all still reach them.
 */
export class LightSlotProjector {
  #observer: MutationObserver | null = null;

  constructor(private readonly host: XyFlowElement) {}

  /** Start observing the host's children. */
  connect(): void {
    this.#observer ??= new MutationObserver(() => {
      this.project();
    });
    this.#observer.observe(this.host, { childList: true });
  }

  /** Stop observing. */
  disconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /** Move every foreign child element of the host to its slot target (idempotent). */
  project(): void {
    const { host } = this;
    const wrapper = host.wrapperRef.value;
    if (!wrapper) return;
    for (const child of [...host.children]) {
      if (child === wrapper) continue;
      const slot = child.getAttribute('slot') ?? '';
      const selector = TARGETS[slot];
      const target = selector ? wrapper.querySelector<HTMLElement>(selector) : wrapper;
      if (!target) continue;
      target.append(child);
      if (slot === 'loading') target.dataset.slotted = '';
    }
  }
}
