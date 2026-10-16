// reactflow.dev "Context menu": right-click a node to get a menu next to the pointer. The menu is
// plain HTML positioned over the flow; `node-context-menu` carries the node and the mouse event.
import { html, nothing } from 'lit';
import type { Edge, FlowEventMap, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const nodes: Node[] = [
  { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Right-click me' } },
  { id: '2', position: { x: 250, y: 80 }, data: { label: 'Or me' } },
  { id: '3', type: 'output', position: { x: 0, y: 160 }, data: { label: 'Or me too' } },
];
const edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

type Menu = { id: string; left: number; top: number };

class ContextMenuExample extends ExampleElement {
  static override properties = { menu: { state: true } };
  declare menu: Menu | null;
  #copies = 0;
  constructor() {
    super();
    this.menu = null;
  }

  #open = (e: CustomEvent<FlowEventMap['node-context-menu']>): void => {
    const { event, node } = e.detail;
    event.preventDefault();
    // the menu is positioned relative to the page container, which is the flow's offset parent
    const box = this.getBoundingClientRect();
    this.menu = { id: node.id, left: event.clientX - box.left, top: event.clientY - box.top };
  };

  #close = (): void => {
    this.menu = null;
  };

  #duplicate(): void {
    const node = this.flow.getNode(this.menu!.id);
    if (node) {
      this.flow.addNodes({
        ...node,
        id: `${node.id}-copy-${++this.#copies}`,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
        data: { ...node.data },
      });
    }
    this.#close();
  }

  #delete(): void {
    void this.flow.deleteElements({ nodes: [{ id: this.menu!.id }] });
    this.#close();
  }

  override render() {
    const menu = this.menu;
    return html`<xy-flow
        .nodes=${initial(nodes)}
        .edges=${initial(edges)}
        fit-view
        @node-context-menu=${this.#open}
        @pane-click=${this.#close}
        @pane-context-menu=${this.#close}
        @move-start=${this.#close}
        @node-click=${this.#close}
      >
        <xy-controls></xy-controls>
        <xy-background></xy-background>
      </xy-flow>
      ${
        menu
          ? html`<div class="ex-menu" role="menu" style="left: ${menu.left}px; top: ${menu.top}px">
              <span class="ex-muted" style="padding: 2px 8px">Node ${menu.id}</span>
              <button role="menuitem" data-action="duplicate" @click=${() => this.#duplicate()}>
                duplicate
              </button>
              <button role="menuitem" data-action="delete" @click=${() => this.#delete()}>
                delete
              </button>
            </div>`
          : nothing
      }`;
  }
}

export default mountExample('ex-context-menu', ContextMenuExample);
