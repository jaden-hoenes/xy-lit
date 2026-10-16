import '../src/define.js';
import type { Edge, Node } from '@xy-lit/store';
import type { XyFlowElement } from '../src/elements/xy-flow.js';
import type { XyNodeElement } from '../src/elements/xy-node.js';

/** Sleep for `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for two animation frames. */
export const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** Poll until `fn` returns a truthy value (never a fixed sleep for the assertion itself). */
export async function waitFor<T>(
  fn: () => T | undefined | null | false,
  timeout = 3000,
): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (performance.now() - start > timeout) throw new Error(`waitFor timed out: ${fn.toString()}`);
    await frames(1);
  }
}

/** A node at a position with a label (default type, 150 px wide by the stylesheet). */
export const node = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: { label: id },
  ...extra,
});

/** An edge between two nodes. */
export const edge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<Edge> = {},
): Edge => ({
  id,
  source,
  target,
  ...extra,
});

export type MountOptions = {
  nodes?: Node[];
  edges?: Edge[];
  attributes?: Record<string, string>;
  props?: Partial<XyFlowElement> & Record<string, unknown>;
  /** Parent to mount into (default `document.body`). */
  parent?: HTMLElement;
  /** Size of the flow element. */
  width?: number;
  height?: number;
};

const mounted: HTMLElement[] = [];

/** Create a flow, configure it, add it to the document and wait until it rendered. */
export async function mountFlow(o: MountOptions = {}): Promise<XyFlowElement> {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = `display:block;width:${o.width ?? 800}px;height:${o.height ?? 500}px`;
  for (const [key, value] of Object.entries(o.attributes ?? {})) flow.setAttribute(key, value);
  Object.assign(flow, o.props ?? {});
  flow.nodes = o.nodes ?? [];
  flow.edges = o.edges ?? [];
  (o.parent ?? document.body).append(flow);
  mounted.push(flow);
  await flow.updateComplete;
  await flow.whenRendered();
  return flow;
}

/** Remove everything `mountFlow` added (call from `afterEach`). */
export function cleanup(): void {
  for (const el of mounted.splice(0)) el.remove();
}

/** The `.lit-flow__node` element of a node. */
export const nodeEl = (flow: XyFlowElement, id: string): XyNodeElement =>
  flow.renderRoot.querySelector<XyNodeElement>(`xy-node[data-id="${id}"]`) as XyNodeElement;

/** Centre of an element in client coordinates. */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const mouseInit = (x: number, y: number, extra: MouseEventInit = {}): MouseEventInit => ({
  clientX: x,
  clientY: y,
  bubbles: true,
  composed: true,
  cancelable: true,
  button: 0,
  view: window,
  ...extra,
});

/**
 * Drag with synthetic mouse events: mousedown on `target`, moves on the window, mouseup.
 * d3-drag and XYHandle both listen for exactly these events.
 */
export async function dragMouse(
  target: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 6,
): Promise<void> {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      ...mouseInit(from.x, from.y),
      pointerId: 1,
      pointerType: 'mouse',
    }),
  );
  target.dispatchEvent(new MouseEvent('mousedown', mouseInit(from.x, from.y)));
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    const init = mouseInit(x, y, { buttons: 1 });
    // gesture listeners are on the shadow root (XYHandle) or the window (d3-drag)
    target.dispatchEvent(new MouseEvent('mousemove', init));
    await frames(1);
  }
  const end = mouseInit(to.x, to.y);
  target.dispatchEvent(new MouseEvent('mouseup', end));
  await frames(1);
}

/** Dispatch a bubbling, composed pointer event (mouse type, primary, button 0 unless overridden). */
export function firePointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    composed: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** The pane element of a flow. */
export const paneOf = (flow: XyFlowElement): HTMLElement =>
  flow.renderRoot.querySelector<HTMLElement>('.lit-flow__pane') as HTMLElement;
