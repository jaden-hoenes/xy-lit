import '@xy-lit/flow/define.js';
import '../src/define.js';
import type { Edge, Node } from '@xy-lit/store';
import type { XyFlowElement } from '@xy-lit/flow';

/** Wait for `n` animation frames. */
export const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** Poll until `fn` returns a truthy value (never a fixed sleep for the assertion itself). */
export async function waitFor<T>(
  fn: () => T | undefined | null | false,
  timeout = 4000,
): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (performance.now() - start > timeout) throw new Error(`waitFor timed out: ${fn.toString()}`);
    await frames(1);
  }
}

/** A node with a label. */
export const node = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: { label: id },
  ...extra,
});

/** An edge. */
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
  props?: Record<string, unknown>;
  width?: number;
  height?: number;
};

const mounted: HTMLElement[] = [];

/** Create a flow, add it to the document and wait until it rendered. */
export async function mountFlow(o: MountOptions = {}): Promise<XyFlowElement> {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = `display:block;width:${o.width ?? 800}px;height:${o.height ?? 500}px`;
  for (const [key, value] of Object.entries(o.attributes ?? {})) flow.setAttribute(key, value);
  Object.assign(flow, o.props ?? {});
  flow.nodes = o.nodes ?? [];
  flow.edges = o.edges ?? [];
  document.body.append(flow);
  mounted.push(flow);
  await flow.updateComplete;
  await flow.whenRendered();
  return flow;
}

/** Remove everything `mountFlow` added (call from `afterEach`). */
export function cleanup(): void {
  for (const el of mounted.splice(0)) el.remove();
}

/** Node position by id (user position, relative to the parent). */
export const pos = (flow: XyFlowElement, id: string): { x: number; y: number } | undefined =>
  flow.store.getState().nodeLookup.get(id)?.position;

/** Ids of the nodes in model order. */
export const ids = (flow: XyFlowElement): string[] => flow.nodes.map((n) => n.id);

/** Centre of an element in client coordinates. */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The `<xy-node>` element of a node. */
export const nodeEl = (flow: XyFlowElement, id: string): HTMLElement =>
  flow.renderRoot.querySelector<HTMLElement>(`xy-node[data-id="${id}"]`) as HTMLElement;

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
 * Drag with synthetic mouse events (what d3-drag listens for): mousedown on `target`, moves,
 * mouseup. Returns after the last frame.
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
    target.dispatchEvent(new MouseEvent('mousemove', mouseInit(x, y, { buttons: 1 })));
    await frames(1);
  }
  target.dispatchEvent(new MouseEvent('mouseup', mouseInit(to.x, to.y)));
  await frames(1);
}

/** Drag a node by `dx`, `dy` screen pixels. */
export async function dragNode(
  flow: XyFlowElement,
  id: string,
  dx: number,
  dy: number,
  steps = 6,
): Promise<void> {
  const el = nodeEl(flow, id);
  const from = centerOf(el);
  await dragMouse(el, from, { x: from.x + dx, y: from.y + dy }, steps);
}
