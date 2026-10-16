// Custom edges: a button edge (interactive HTML label), labels at both ends, markers and
// parallel edges that fan out.
import { css, html } from 'lit';
import { Position, baseEdge, defineEdgeType, edgeLabel, getBezierPath } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { flowOf, mountTemplate, type Mount } from './_shared';

const buttonEdge = defineEdgeType({
  styles: css`
    .doc-edge-btn {
      width: 20px;
      height: 20px;
      border: 1px solid var(--demo-node-border);
      border-radius: 50%;
      background: var(--demo-node-bg);
      color: var(--demo-node-fg);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
    }
    .doc-edge-btn:hover {
      border-color: #ef4444;
      color: #ef4444;
    }
  `,
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style, interactionWidth: p.interactionWidth }),
      label: edgeLabel(
        flow,
        { edgeId: p.id, x, y, transparent: true },
        html`<button
          class="nodrag nopan doc-edge-btn"
          aria-label="Delete edge ${p.id}"
          @click=${() => void flow.deleteElements({ edges: [{ id: p.id }] })}
        >
          &times;
        </button>`,
      ),
    };
  },
});

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const nodes: Node[] = [
  { id: 'a', type: 'input', position: { x: 0, y: 60 }, data: { label: 'Source' }, ...lr },
  { id: 'b', position: { x: 300, y: 0 }, data: { label: 'Target' }, ...lr },
  { id: 'c', type: 'output', position: { x: 300, y: 150 }, data: { label: 'Sink' }, ...lr },
  { id: 'd', position: { x: 520, y: 0 }, data: { label: 'Parallel A' } },
  { id: 'e', type: 'output', position: { x: 520, y: 190 }, data: { label: 'Parallel B' } },
];
const edges: Edge[] = [
  { id: 'a-b', source: 'a', target: 'b', type: 'button' },
  {
    id: 'a-c',
    source: 'a',
    target: 'c',
    label: 'centre',
    startLabel: 'start',
    endLabel: 'end',
    markerEnd: { type: 'arrowclosed' },
  },
  {
    id: 'b-d',
    source: 'b',
    target: 'd',
    type: 'smoothstep',
    markerEnd: { type: 'custom', path: 'M-5 -5 L5 0 L-5 5 L-2 0 Z', color: '#10b981' },
    style: 'stroke: #10b981; stroke-width: 2',
  },
  { id: 'd-e-1', source: 'd', target: 'e', label: 'one' },
  { id: 'd-e-2', source: 'd', target: 'e', label: 'two' },
  { id: 'd-e-3', source: 'd', target: 'e', label: 'three' },
];

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <label><input type="checkbox" id="spread" checked /> <code>parallel-edges="spread"</code></label>
        <span class="spacer"></span>
        <span>Click the &times; on the first edge to delete it.</span>
      </div>
      <xy-flow
        .nodes=${nodes}
        .edges=${edges}
        .edgeTypes=${{ button: buttonEdge }}
        parallel-edges="spread"
        parallel-edge-gap="22"
        fit-view
        prevent-scrolling="false"
        zoom-on-scroll="false"
      >
        <xy-background></xy-background>
      </xy-flow>`,
  );
  const flow = flowOf(el);
  el.querySelector('#spread')!.addEventListener('change', (e) => {
    flow.parallelEdges = (e.target as HTMLInputElement).checked ? 'spread' : 'off';
  });
  return dispose;
};
