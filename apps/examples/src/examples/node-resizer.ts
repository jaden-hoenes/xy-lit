// reactflow.dev "Node resizer": `<xy-node-resizer>` in every flavour. `NodeTypeDefinition.resizer`
// adds it to a node type, `<xy-node-resizer>` can also be placed by hand, and `<xy-resize-control>`
// makes custom controls (here: one-direction resizers). Resizing a child can grow its parent.
import { css, html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { ExampleElement, initial, mountExample } from '../lib/demo';

const styles = css`
  .ex-resizable {
    height: 100%;
    background: #fff;
    border: 1px solid #1a192b;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    padding: 8px;
    box-sizing: border-box;
  }
`;

const label = (data: unknown) => String((data as { label: string }).label);
const body = (text: string) =>
  html`<xy-handle type="target" position="left"></xy-handle>
    <div class="ex-resizable">${text}</div>
    <xy-handle type="source" position="right"></xy-handle>`;

const nodeTypes = {
  // the resizer rendered by <xy-node> from the type definition
  resizable: defineNodeType({
    styles,
    render: ({ data }) => body(label(data)),
    resizer: { minWidth: 100, minHeight: 50 },
  }),
  aspect: defineNodeType({
    styles,
    render: ({ data }) => body(label(data)),
    resizer: { keepAspectRatio: true, minWidth: 80, minHeight: 40 },
  }),
  hover: defineNodeType({
    styles,
    render: ({ data }) => body(label(data)),
    resizer: { variant: 'hover-corner' },
  }),
  lines: defineNodeType({
    styles,
    render: ({ data }) => body(label(data)),
    resizer: { variant: 'lines' },
  }),
  // the element placed by hand inside the node content, with a custom colour
  manual: defineNodeType({
    styles,
    render: ({ data }) =>
      html`<xy-node-resizer min-width="80" min-height="40" color="#e11d48"></xy-node-resizer
        >${body(label(data))}`,
  }),
  // two controls that each resize in one direction only
  directional: defineNodeType({
    styles,
    render: ({ id, data }) =>
      html`<xy-resize-control
          node-id=${id}
          position="right"
          variant="line"
          resize-direction="horizontal"
          min-width="100"
        ></xy-resize-control>
        <xy-resize-control
          node-id=${id}
          position="bottom"
          variant="line"
          resize-direction="vertical"
          min-height="40"
        ></xy-resize-control>
        ${body(label(data))}`,
  }),
};

const nodes: Node[] = [
  {
    id: 'a',
    type: 'resizable',
    position: { x: 0, y: 0 },
    width: 180,
    height: 80,
    data: { label: 'handles, min 100 x 50' },
  },
  {
    id: 'b',
    type: 'aspect',
    position: { x: 300, y: 0 },
    width: 160,
    height: 80,
    data: { label: 'keeps aspect ratio' },
  },
  {
    id: 'c',
    type: 'hover',
    position: { x: 580, y: 0 },
    width: 160,
    height: 80,
    data: { label: 'hover-corner' },
  },
  {
    id: 'd',
    type: 'lines',
    position: { x: 0, y: 200 },
    width: 180,
    height: 80,
    data: { label: 'lines' },
  },
  {
    id: 'e',
    type: 'manual',
    position: { x: 300, y: 200 },
    width: 160,
    height: 80,
    data: { label: 'placed by hand' },
  },
  {
    id: 'f',
    type: 'directional',
    position: { x: 580, y: 200 },
    width: 160,
    height: 80,
    data: { label: 'one direction each' },
  },
  {
    id: 'group',
    type: 'group',
    position: { x: 0, y: 360 },
    width: 340,
    height: 200,
    data: { label: '' },
    style: 'background: rgba(99, 102, 241, 0.08); border: 1px dashed #6366f1;',
  },
  {
    id: 'child',
    type: 'resizable',
    parentId: 'group',
    extent: 'parent',
    position: { x: 30, y: 40 },
    width: 160,
    height: 70,
    data: { label: 'child: grows the group' },
  },
];
const edges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

class NodeResizerExample extends ExampleElement {
  override render() {
    return html`<xy-flow
      .nodes=${initial(nodes)}
      .edges=${initial(edges)}
      .nodeTypes=${nodeTypes}
      fit-view
    >
      <xy-controls></xy-controls>
      <xy-background></xy-background>
      <xy-panel position="top-left"
        ><div class="ex-box">Select a node to see its resizer.</div></xy-panel
      >
    </xy-flow>`;
  }
}

export default mountExample('ex-node-resizer', NodeResizerExample);
