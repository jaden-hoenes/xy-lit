// reactflow.dev "Node toolbar": the `nodeToolbar` directive renders a toolbar beside a node that is
// not scaled with the viewport. Position, alignment and visibility are options; the panel changes
// them for every node.
import { html } from 'lit';
import { defineNodeType, nodeToolbar } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

type Position = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

const positions: Position[] = ['top', 'right', 'bottom', 'left'];
const aligns: Align[] = ['start', 'center', 'end'];

// shared by the node renderer below, which reads it when it renders
const settings = { position: 'top' as Position, align: 'center' as Align, always: false };

const toolbarNode = defineNodeType({
  render: ({ id, data }) =>
    html`${nodeToolbar(
        {
          position: settings.position,
          align: settings.align,
          isVisible: settings.always ? true : undefined,
        },
        html`<div class="ex-box ex-btns" role="toolbar" aria-label="Node ${id}">
          <button class="ex-btn" @click=${() => console.log('delete', id)}>delete</button>
          <button class="ex-btn" @click=${() => console.log('copy', id)}>copy</button>
          <button class="ex-btn" @click=${() => console.log('expand', id)}>expand</button>
        </div>`,
      )}
      <xy-handle type="target" position="left"></xy-handle>
      <div
        style="padding: 12px 20px; border: 1px solid #1a192b; border-radius: 3px; background: #fff; font-size: 12px"
      >
        ${(data as { label: string }).label}
      </div>
      <xy-handle type="source" position="right"></xy-handle>`,
});

const nodes: Node[] = [
  { id: 'a', type: 'toolbar', position: { x: 0, y: 60 }, data: { label: 'Select me' } },
  { id: 'b', type: 'toolbar', position: { x: 300, y: 0 }, data: { label: 'Or me' } },
  { id: 'c', type: 'toolbar', position: { x: 300, y: 130 }, data: { label: 'Or me too' } },
];
const edges: Edge[] = [
  { id: 'a-b', source: 'a', target: 'b' },
  { id: 'a-c', source: 'a', target: 'c' },
];

class NodeToolbarExample extends ExampleElement {
  static override properties = {
    position: { state: true },
    align: { state: true },
    always: { state: true },
  };
  declare position: Position;
  declare align: Align;
  declare always: boolean;
  constructor() {
    super();
    this.position = settings.position;
    this.align = settings.align;
    this.always = settings.always;
  }

  #update(patch: Partial<typeof settings>): void {
    Object.assign(settings, patch);
    Object.assign(this, patch);
    // the toolbars are part of the node templates: re-render the nodes by touching their data
    for (const node of this.flow.getNodes())
      this.flow.updateNodeData(node.id, { rev: Math.random() });
  }

  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${{ toolbar: toolbarNode }}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left">
        <div class="ex-box">
          <div class="ex-btns" role="group" aria-label="Toolbar position">
            ${positions.map((p) => html`<button class="ex-btn" data-position=${p} aria-pressed=${this.position === p} @click=${() => this.#update({ position: p })}>${p}</button>`)}
          </div>
          <div class="ex-btns" role="group" aria-label="Toolbar alignment" style="margin-top: 6px">
            ${aligns.map((a) => html`<button class="ex-btn" data-align=${a} aria-pressed=${this.align === a} @click=${() => this.#update({ align: a })}>${a}</button>`)}
          </div>
          <label style="display: block; margin-top: 6px"
            ><input
              type="checkbox"
              .checked=${this.always}
              @change=${(e: Event) => this.#update({ always: (e.target as HTMLInputElement).checked })}
            />
            always visible</label
          >
        </div>
      </xy-panel>
    </xy-flow>`;
  }
}

export default mountExample('ex-node-toolbar', NodeToolbarExample);
