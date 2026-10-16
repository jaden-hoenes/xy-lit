/**
 * Wheel-scroll detection (spec/10 §Wheel-scroll detection): a wheel event over scrollable node
 * content scrolls that content instead of panning or zooming the flow, until the content reaches
 * its limit.
 */

/** Whether `el` can scroll in the direction of a wheel delta (it is scrollable and not at the limit). */
export function canScroll(el: HTMLElement, dx: number, dy: number): boolean {
  const s = getComputedStyle(el);
  const y =
    /(auto|scroll|overlay)/.test(s.overflowY) &&
    el.scrollHeight > el.clientHeight &&
    ((dy < 0 && el.scrollTop > 0) ||
      (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1));
  const x =
    /(auto|scroll|overlay)/.test(s.overflowX) &&
    el.scrollWidth > el.clientWidth &&
    ((dx < 0 && el.scrollLeft > 0) ||
      (dx > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1));
  return y || x;
}

/**
 * The handler: walks the event path up to the node boundary and, when an element there can scroll,
 * stops the event from reaching d3-zoom (which would call `preventDefault` and zoom), so the
 * browser scrolls the element natively.
 *
 * @param e - The wheel event.
 */
export function onNodesWheel(e: WheelEvent): void {
  if (e.ctrlKey) return; // pinch-zoom gesture: let XYPanZoom handle it
  for (const el of e.composedPath()) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.classList.contains('lit-flow__node')) break; // stop at the node boundary
    if (canScroll(el, e.deltaX, e.deltaY)) {
      e.stopPropagation();
      return;
    }
  }
}

/**
 * Listen for wheel events on a flow's `.lit-flow__nodes` container, which is a descendant of the
 * XYPanZoom element, so this runs before d3-zoom's listener.
 *
 * @param nodes - The nodes container.
 * @returns A function that removes the listener.
 */
export function attachWheelDetection(nodes: HTMLElement): () => void {
  nodes.addEventListener('wheel', onNodesWheel, { passive: true });
  return () => {
    nodes.removeEventListener('wheel', onNodesWheel);
  };
}
