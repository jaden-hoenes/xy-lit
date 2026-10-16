import '../src/define.js';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';

/** Wait for `n` animation frames. */
export const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** Poll until `fn` returns something truthy. */
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

export const node = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: { label: id },
  ...extra,
});

export type MountOptions = {
  nodes?: Node[];
  edges?: Edge[];
  props?: Record<string, unknown>;
  attributes?: Record<string, string>;
  /** Plugins appended after the flow is created. */
  children?: HTMLElement[];
  width?: number;
  height?: number;
};

const mounted: HTMLElement[] = [];

/** Create a flow, add it to the document and wait until it rendered. */
export async function mountFlow(o: MountOptions = {}): Promise<XyFlowElement> {
  const flow = document.createElement('xy-flow');
  flow.style.cssText = `display:block;width:${o.width ?? 900}px;height:${o.height ?? 560}px`;
  for (const [k, v] of Object.entries(o.attributes ?? {})) flow.setAttribute(k, v);
  Object.assign(flow, o.props ?? {});
  flow.nodes = o.nodes ?? [];
  flow.edges = o.edges ?? [];
  if (o.children) flow.append(...o.children);
  document.body.append(flow);
  mounted.push(flow);
  await flow.updateComplete;
  await flow.whenRendered();
  await frames(2);
  return flow;
}

/** Remove everything `mountFlow` added. */
export function cleanup(): void {
  for (const el of mounted.splice(0)) el.remove();
}

/** The `<xy-node>` of a node. */
export const nodeEl = (flow: XyFlowElement, id: string): HTMLElement =>
  flow.renderRoot.querySelector<HTMLElement>(`xy-node[data-id="${id}"]`) as HTMLElement;

/** Wait for a plugin element to render. */
export async function rendered<T extends HTMLElement>(el: T): Promise<T> {
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await frames(2);
  return el;
}
