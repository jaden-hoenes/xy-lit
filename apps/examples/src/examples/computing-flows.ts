// reactflow.dev "Computing flows": number nodes feed operation nodes, operations feed each other,
// and every node shows the value computed from its connections. `StoreController` re-runs a
// selector over the flow state, so a node updates exactly when its inputs change.
import { css, html } from 'lit';
import { FlowNodeElement, StoreController } from '@xy-lit/flow';
import type { Edge, FlowState, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type CalcData = { kind: 'number' | 'sum' | 'product' | 'result'; label: string; value?: number };
type CalcNode = Node<CalcData>;

/** The value of a node: its own for numbers, the combination of its inputs otherwise. */
function evaluate(state: FlowState, id: string, seen = new Set<string>()): number | null {
  const node = state.nodeLookup.get(id);
  if (!node || seen.has(id)) return null;
  const data = node.data as CalcData;
  if (data.kind === 'number') return data.value ?? 0;
  seen.add(id);
  const inputs = [...(state.connectionLookup.get(`${id}-target`)?.values() ?? [])]
    .map((c) => evaluate(state, c.source, seen))
    .filter((v): v is number => v !== null);
  seen.delete(id);
  if (inputs.length === 0) return null;
  if (data.kind === 'product') return inputs.reduce((a, b) => a * b, 1);
  if (data.kind === 'sum') return inputs.reduce((a, b) => a + b, 0);
  return inputs[0] ?? null;
}

class CalcNodeElement extends FlowNodeElement<CalcNode> {
  static override styles = css`
    .ex-calc {
      padding: 10px 12px;
      border: 1px solid #1a192b;
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
      min-width: 120px;
    }
    .ex-calc strong {
      font-size: 16px;
    }
    .ex-calc.number {
      background: #e0f2fe;
    }
    .ex-calc.result {
      background: #dcfce7;
    }
    .ex-calc input {
      width: 100%;
    }
  `;

  // the selector runs for every state change, but the node renders only when the number changes
  private value = new StoreController<number | null>(this, (s) => evaluate(s, this.nodeId));

  override render() {
    const { kind, label } = this.data;
    const value = this.value.value;
    return html`<div class="ex-calc ${kind}">
      ${kind === 'number' ? '' : html`<xy-handle type="target" position="left"></xy-handle>`}
      <div class="ex-muted">${label}</div>
      ${
        kind === 'number'
          ? html`<input
              class="nodrag"
              type="range"
              min="0"
              max="20"
              aria-label=${label}
              .value=${String(this.data.value ?? 0)}
              @input=${(e: Event) =>
                this.flow.updateNodeData(this.nodeId, {
                  value: Number((e.target as HTMLInputElement).value),
                })}
            />`
          : ''
      }
      <strong data-testid="value-${this.nodeId}">${value ?? '-'}</strong>
      ${kind === 'result' ? '' : html`<xy-handle type="source" position="right"></xy-handle>`}
    </div>`;
  }
}
customElements.define('ex-calc-node', CalcNodeElement);

const nodes: CalcNode[] = [
  {
    id: 'a',
    type: 'calc',
    position: { x: 0, y: 0 },
    data: { kind: 'number', label: 'A', value: 3 },
  },
  {
    id: 'b',
    type: 'calc',
    position: { x: 0, y: 110 },
    data: { kind: 'number', label: 'B', value: 4 },
  },
  {
    id: 'c',
    type: 'calc',
    position: { x: 0, y: 220 },
    data: { kind: 'number', label: 'C', value: 2 },
  },
  { id: 'sum', type: 'calc', position: { x: 260, y: 40 }, data: { kind: 'sum', label: 'A + B' } },
  {
    id: 'product',
    type: 'calc',
    position: { x: 500, y: 130 },
    data: { kind: 'product', label: '(A + B) x C' },
  },
  {
    id: 'result',
    type: 'calc',
    position: { x: 740, y: 130 },
    data: { kind: 'result', label: 'Result' },
  },
];
const edges: Edge[] = [
  { id: 'a-sum', source: 'a', target: 'sum' },
  { id: 'b-sum', source: 'b', target: 'sum' },
  { id: 'sum-product', source: 'sum', target: 'product' },
  { id: 'c-product', source: 'c', target: 'product' },
  { id: 'product-result', source: 'product', target: 'result' },
];

class ComputingFlowsExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${{ calc: 'ex-calc-node' }}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Move the sliders, or reconnect the nodes.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-computing-flows', ComputingFlowsExample);
