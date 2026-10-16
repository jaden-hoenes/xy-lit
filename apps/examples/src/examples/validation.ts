// reactflow.dev "Validation": connections are only valid between nodes of the same colour. The
// flow's `isValidConnection` decides; the handles show the result while a connection is dragged.
import { css, html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Connection, Edge, Node, XyFlowElement } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type Tone = { tone: 'red' | 'green' | 'blue'; label: string };
const colors = { red: '#fca5a5', green: '#86efac', blue: '#93c5fd' };

// handles turn green or red while a connection is dragged over them
const validationStyles = css`
  .ex-tone-node {
    padding: 10px 14px;
    border: 1px solid #1a192b;
    border-radius: 6px;
    font-size: 12px;
  }
  .ex-tone-node .lit-flow__handle.connectingto {
    background: #ef4444;
  }
  .ex-tone-node .lit-flow__handle.connectingto.valid {
    background: #22c55e;
  }
`;

const toneNode = (kind: 'source' | 'target') =>
  defineNodeType<Node<Tone>>({
    styles: validationStyles,
    render: ({ data }) =>
      html`<div class="ex-tone-node" style="background: ${colors[data.tone]}">
        ${kind === 'target' ? html`<xy-handle type="target" position="left"></xy-handle>` : ''}
        ${data.label}
        ${kind === 'source' ? html`<xy-handle type="source" position="right"></xy-handle>` : ''}
      </div>`,
  });

const nodeTypes = { toneSource: toneNode('source'), toneTarget: toneNode('target') };

const tones = ['red', 'green', 'blue'] as const;
const nodes: Node[] = [
  ...tones.map((tone, i) => ({
    id: `src-${tone}`,
    type: 'toneSource',
    position: { x: 0, y: i * 110 },
    data: { tone, label: `${tone} source` },
  })),
  ...tones.map((tone, i) => ({
    id: `dst-${tone}`,
    type: 'toneTarget',
    position: { x: 360, y: ((i + 1) % 3) * 110 },
    data: { tone, label: `${tone} target` },
  })),
];
const edges: Edge[] = [];

class ValidationExample extends ExampleElement {
  static override properties = { last: { state: true } };
  declare last: string;
  constructor() {
    super();
    this.last = 'Connect a source to a target of the same colour.';
  }

  // the validator reads the nodes at the time of the drag, so it needs no state of its own
  #isValid = (c: Connection | Edge): boolean => {
    const flow = this.querySelector('xy-flow') as XyFlowElement;
    const from = flow.getNode(c.source)?.data as Tone | undefined;
    const to = flow.getNode(c.target)?.data as Tone | undefined;
    return !!from && !!to && from.tone === to.tone;
  };

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${nodeTypes}
      .isValidConnection=${this.#isValid}
      fit-view
      @connect=${(e: CustomEvent<{ connection: Connection }>) =>
        (this.last = `connected ${e.detail.connection.source} to ${e.detail.connection.target}`)}
      @connect-end=${(
        e: CustomEvent<{ connectionState: { isValid: boolean | null; toNode: unknown } }>,
      ) => {
        const s = e.detail.connectionState;
        if (s.toNode && !s.isValid) this.last = 'rejected: the colours differ';
      }}
    >
      <xy-controls></xy-controls>
      <xy-background variant="dots"></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box" data-testid="validation-status">${this.last}</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-validation', ValidationExample);
