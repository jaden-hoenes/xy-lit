// reactflow.dev "Add node on edge drop": release a connection on the empty pane and a new node
// is created at the pointer, already connected to the node the drag started from.
import { html } from 'lit';
import type { Edge, FlowEventMap, Node, XyFlowElement } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type ConnectEnd = CustomEvent<FlowEventMap['connect-end']>;

const nodes: Node[] = [
  { id: '0', type: 'input', position: { x: 0, y: 50 }, data: { label: 'Node 0' } },
];
const edges: Edge[] = [];

class AddNodeOnEdgeDropExample extends ExampleElement {
  #id = 1;

  #onConnectEnd(e: ConnectEnd): void {
    const { event, connectionState } = e.detail;
    // a completed connection is handled by the default `connect` action
    if (connectionState.isValid || !connectionState.fromNode || !connectionState.fromHandle) return;
    // only when the pointer was released over the pane (not over a node or a control)
    const onPane = event
      .composedPath()
      .some((el) => el instanceof Element && el.classList.contains('lit-flow__pane'));
    if (!onPane) return;

    const flow = this.flow as XyFlowElement;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    if (!point) return;
    const id = String(this.#id++);
    const position = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY });
    const { fromNode, fromHandle } = connectionState;
    const fromSource = fromHandle.type === 'source';
    flow.addNodes({
      id,
      // centre the new node under the pointer (the default node is about 150 x 40 px)
      position: { x: position.x - 75, y: position.y - 20 },
      data: { label: `Node ${id}` },
    });
    flow.addEdges({
      id: `e${fromNode.id}-${id}`,
      source: fromSource ? fromNode.id : id,
      target: fromSource ? id : fromNode.id,
      sourceHandle: fromSource ? (fromHandle.id ?? null) : null,
      targetHandle: fromSource ? null : (fromHandle.id ?? null),
    });
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      fit-view
      .fitViewOptions=${{ padding: 2 }}
      @connect-end=${this.#onConnectEnd}
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Drag from a handle and release on the empty pane.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-add-node-on-edge-drop', AddNodeOnEdgeDropExample);
