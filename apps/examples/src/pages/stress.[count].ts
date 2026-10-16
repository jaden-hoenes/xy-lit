import type { Mount } from '../router';
import { createStressFlow } from '../lib/stress';

export const links = ['/stress/1000', '/stress/5000', '/stress/10000'];

/**
 * `/stress/:count`: a grid of `count` default nodes and `count - 1` edges with `fit-view`
 * (spec/13 §Performance). `?visible=1` renders only what is in the viewport, `?minimap=1` adds
 * the minimap. The perf specs read `window.__stress`.
 */
const mount: Mount = (root, params) => {
  const count = Number(params.count);
  if (!Number.isInteger(count) || count < 1 || count > 100_000) {
    root.textContent = `Invalid node count: ${params.count ?? ''}`;
    return;
  }
  root.replaceChildren();
  const query = new URLSearchParams(location.search);
  createStressFlow(count, { onlyVisible: query.has('visible'), minimap: query.has('minimap') });
};
export default mount;
