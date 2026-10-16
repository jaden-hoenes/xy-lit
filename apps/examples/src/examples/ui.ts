// Gallery of every @xy-lit/ui component on one live flow (route /examples/ui).
import '@xy-lit/ui/define.js';
import { css, html, nothing } from 'lit';
import {
  FlowNodeElement,
  NodeConnectionsController,
  defineNodeType,
  MarkerType,
  Position,
} from '@xy-lit/flow';
import type { ColorMode, Edge, Node, NodeProps, XyFlowElement } from '@xy-lit/flow';
import {
  buttonHandle,
  defaultShapes,
  labeledHandle,
  nodeAppendix,
  nodeTooltip,
  statusIndicator,
  uiEdgeTypes,
  uiNodeTypes,
  uiStyles,
} from '@xy-lit/ui';
import type { NodeStatus } from '@xy-lit/ui';
import type { Mount } from '../router';

// ---- page chrome (light DOM, themed with custom properties) ---------------------------------------

const pageCss = `
:root {
  --g-bg: #f4f5f8; --g-text: #151824; --g-muted: #6b7185; --g-chip: #ffffff;
  --g-line: rgba(21, 24, 36, 0.12); --g-accent: #6366f1;
  color-scheme: light;
}
:root[data-theme='dark'] {
  --g-bg: #141414; --g-text: #eceef4; --g-muted: #9aa0b4; --g-chip: #1e1e1e;
  --g-line: rgba(236, 238, 244, 0.16); --g-accent: #818cf8;
  color-scheme: dark;
}
html, body { margin: 0; height: 100%; background: var(--g-bg); color: var(--g-text);
  font-family: Inter, 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.g-title { display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; background: var(--g-chip);
  border: 1px solid var(--g-line); border-radius: 12px; box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 6px 18px rgba(15,23,42,.08);
  font-size: 13px; white-space: nowrap; }
.g-title strong { font-weight: 650; letter-spacing: -0.01em; }
.g-title span { color: var(--g-muted); }
.g-theme { appearance: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
  border: 1px solid var(--g-line); border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.g-theme:hover { background: color-mix(in srgb, currentColor 7%, transparent); }
.g-theme:focus-visible { outline: 2px solid var(--g-accent); outline-offset: 1px; }
`;

// ---- gallery node styles (adopted into the flow with the node types) --------------------------------

const galleryStyles = css`
  .g-task__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .g-task__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--g-dot, #9aa0b4);
    flex: none;
  }
  .g-task__desc {
    color: color-mix(in srgb, currentColor 62%, transparent);
  }
  .g-task__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .g-task__status {
    font-size: 11px;
    text-transform: capitalize;
  }
  .g-btn {
    appearance: none;
    height: 24px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    border-radius: 7px;
    background: transparent;
    color: inherit;
    font:
      500 11px system-ui,
      sans-serif;
    cursor: pointer;
  }
  .g-btn:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .g-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .g-step__title {
    font-weight: 600;
  }
  .g-step__sub {
    color: color-mix(in srgb, currentColor 58%, transparent);
    font-size: 12px;
  }
  .g-mixer-body {
    --xy-base-node-padding: 4px 14px;
  }
`;

// ---- node types --------------------------------------------------------------------------------

type TaskData = {
  title: string;
  description: string;
  status: NodeStatus;
  tip: string;
  appendix?: string;
};

const STATUS_DOT: Record<NodeStatus, string> = {
  initial: '#9aa0b4',
  loading: '#6366f1',
  success: '#22c55e',
  error: '#ef4444',
};

const taskNode = defineNodeType<Node<TaskData>>({
  styles: [uiStyles, galleryStyles],
  render: ({ id, data, selected }, flow) => {
    const run = (): void => {
      flow.updateNodeData(id, { status: 'loading' });
      setTimeout(() => {
        // the first failure is the demo of the error ring, every run after that succeeds
        flow.updateNodeData(id, { status: id === 'task-error' ? 'error' : 'success' });
      }, 1600);
    };
    return statusIndicator(
      data.status,
      html`<xy-base-node
        class="xy-ui-node"
        ?selected=${selected}
        style="--xy-base-node-min-width: 212px"
      >
        ${nodeTooltip({ position: 'top' }, data.tip)}
        <div slot="header" class="g-task__head">
          <span class="g-task__dot" style="--g-dot: ${STATUS_DOT[data.status]}"></span>${data.title}
        </div>
        <div class="g-task__desc">${data.description}</div>
        <div slot="footer" class="g-task__foot">
          <span class="g-task__status">${data.status}</span>
          <button
            type="button"
            class="g-btn nodrag"
            ?disabled=${data.status === 'loading'}
            @click=${run}
          >
            Run
          </button>
        </div>
        <xy-handle type="target" position="left"></xy-handle>
        <xy-handle type="source" position="right"></xy-handle>
        ${data.appendix ? nodeAppendix('bottom', data.appendix) : nothing}
      </xy-base-node>`,
    );
  },
});

const mixerNode = defineNodeType<Node<{ title: string }>>({
  styles: [uiStyles, galleryStyles],
  render: ({ data, selected }) =>
    html`<xy-base-node
      class="xy-ui-node"
      ?selected=${selected}
      style="--xy-base-node-padding: 6px 14px; --xy-base-node-min-width: 200px"
    >
      <div slot="header">${data.title}</div>
      ${labeledHandle({ type: 'target', position: 'left', id: 'a', label: 'Signal A' })}
      ${labeledHandle({ type: 'target', position: 'left', id: 'b', label: 'Signal B' })}
      ${labeledHandle({ type: 'source', position: 'right', id: 'out', label: 'Mix' })}
    </xy-base-node>`,
});

let stepCounter = 0;

/** A step with a "+" button on its output handle while nothing is connected to it. */
class GalleryStepNode extends FlowNodeElement<Node<{ title: string; sub?: string }>> {
  static override styles = [uiStyles, galleryStyles];
  readonly #outgoing = new NodeConnectionsController(this, { handleType: 'source' });

  #addNext(): void {
    const { flow, props } = this;
    const id = `step-added-${++stepCounter}`;
    flow.addNodes({
      id,
      type: 'step',
      position: { x: props.positionAbsoluteX + 250, y: props.positionAbsoluteY },
      parentId: props.parentId,
      data: { title: `Step ${stepCounter + 3}`, sub: 'Added with the button handle' },
    });
    flow.addEdges({ id: `e-${props.id}-${id}`, source: props.id, target: id, type: 'smoothstep' });
  }

  protected override render() {
    const hasOutgoing = (this.#outgoing.value?.length ?? 0) > 0;
    return html`<xy-base-node
      class="xy-ui-node"
      ?selected=${this.props.selected}
      style="--xy-base-node-min-width: 150px"
    >
      <div class="g-step__title">${this.data.title}</div>
      <div class="g-step__sub">${this.data.sub ?? ''}</div>
      <xy-handle type="target" position="left"></xy-handle>
      ${buttonHandle({
        type: 'source',
        position: 'right',
        showButton: !hasOutgoing,
        label: 'Add next step',
        onClick: () => this.#addNext(),
      })}
    </xy-base-node>`;
  }
}
if (!customElements.get('gallery-step-node'))
  customElements.define('gallery-step-node', GalleryStepNode);

const smallNode = defineNodeType<Node<{ label: string }>>({
  styles: [uiStyles, galleryStyles],
  render: ({
    data,
    selected,
    sourcePosition = Position.Right,
    targetPosition = Position.Left,
  }: NodeProps<Node<{ label: string }>>) =>
    html`<xy-base-node
      class="xy-ui-node"
      ?selected=${selected}
      style="--xy-base-node-padding: 8px 14px; --xy-base-node-min-width: 96px"
    >
      ${data.label}
      <xy-handle type="target" position=${targetPosition}></xy-handle>
      <xy-handle type="source" position=${sourcePosition}></xy-handle>
    </xy-base-node>`,
});

// ---- data ----------------------------------------------------------------------------------------

const SHAPE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

function buildNodes(): Node[] {
  const nodes: Node[] = [];
  const group = (
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void => {
    nodes.push({
      id,
      type: 'labeledGroup',
      position: { x, y },
      width,
      height,
      data: { label },
      zIndex: -1,
    });
  };
  const child = (n: Node, parentId: string): void => {
    nodes.push({ ...n, parentId });
  };

  // column 1 ---------------------------------------------------------------------------------------
  group('g-status', 'Base node · status indicator · tooltip · appendix', 0, 0, 560, 340);
  child(
    {
      id: 'task-initial',
      type: 'task',
      position: { x: 28, y: 44 },
      data: {
        title: 'Fetch data',
        description: 'Pulls the latest rows.',
        status: 'initial',
        tip: 'Hover tooltip: runs nightly at 02:00',
        appendix: 'Last run 3 min ago',
      } satisfies TaskData,
    },
    'g-status',
  );
  child(
    {
      id: 'task-loading',
      type: 'task',
      position: { x: 300, y: 44 },
      data: {
        title: 'Transform',
        description: 'Cleans and joins.',
        status: 'loading',
        tip: 'Spinner ring while loading',
      } satisfies TaskData,
    },
    'g-status',
  );
  child(
    {
      id: 'task-success',
      type: 'task',
      position: { x: 28, y: 204 },
      data: {
        title: 'Validate',
        description: 'Schema checks passed.',
        status: 'success',
        tip: 'Green ring on success',
      } satisfies TaskData,
    },
    'g-status',
  );
  child(
    {
      id: 'task-error',
      type: 'task',
      position: { x: 300, y: 204 },
      data: {
        title: 'Publish',
        description: 'Press Run to see an error.',
        status: 'error',
        tip: 'Red ring on error',
      } satisfies TaskData,
    },
    'g-status',
  );

  group('g-schema', 'Database schema node', 0, 380, 560, 330);
  child(
    {
      id: 'users',
      type: 'databaseSchema',
      position: { x: 306, y: 44 },
      data: {
        label: 'users',
        schema: [
          { title: 'id', type: 'uuid', key: 'PK' },
          { title: 'email', type: 'varchar' },
          { title: 'name', type: 'varchar' },
          { title: 'created_at', type: 'timestamp' },
        ],
      },
    },
    'g-schema',
  );
  child(
    {
      id: 'orders',
      type: 'databaseSchema',
      position: { x: 24, y: 44 },
      data: {
        label: 'orders',
        schema: [
          { title: 'id', type: 'uuid', key: 'PK' },
          { title: 'user_id', type: 'uuid', key: 'FK' },
          { title: 'total', type: 'numeric' },
          { title: 'status', type: 'varchar' },
          { title: 'placed_at', type: 'timestamp' },
        ],
      },
    },
    'g-schema',
  );

  // column 2 ---------------------------------------------------------------------------------------
  group('g-handles', 'Labeled handle · button handle · placeholder', 600, 0, 610, 340);
  child(
    { id: 'source-a', type: 'small', position: { x: 24, y: 64 }, data: { label: 'Source A' } },
    'g-handles',
  );
  child(
    { id: 'source-b', type: 'small', position: { x: 24, y: 124 }, data: { label: 'Source B' } },
    'g-handles',
  );
  child(
    { id: 'mixer', type: 'mixer', position: { x: 180, y: 50 }, data: { title: 'Mixer' } },
    'g-handles',
  );
  child(
    {
      id: 'step-1',
      type: 'step',
      position: { x: 420, y: 70 },
      data: { title: 'Step 1', sub: 'Click + to add' },
    },
    'g-handles',
  );
  child(
    {
      id: 'step-2',
      type: 'step',
      position: { x: 24, y: 244 },
      data: { title: 'Step 2', sub: 'Ends in a placeholder' },
    },
    'g-handles',
  );
  child(
    {
      id: 'placeholder',
      type: 'placeholder',
      position: { x: 300, y: 234 },
      data: { label: 'Add node' },
    },
    'g-handles',
  );

  group('g-edges', 'Button edge · data edge · animated SVG edge', 600, 380, 610, 330);
  child(
    { id: 'e1-a', type: 'small', position: { x: 28, y: 54 }, data: { label: 'Alpha' } },
    'g-edges',
  );
  child(
    { id: 'e1-b', type: 'small', position: { x: 470, y: 54 }, data: { label: 'Beta' } },
    'g-edges',
  );
  child(
    {
      id: 'e2-a',
      type: 'small',
      position: { x: 28, y: 150 },
      data: { label: 'Gamma', rate: '120 req/s' },
    },
    'g-edges',
  );
  child(
    { id: 'e2-b', type: 'small', position: { x: 470, y: 150 }, data: { label: 'Delta' } },
    'g-edges',
  );
  child(
    { id: 'e3-a', type: 'small', position: { x: 28, y: 246 }, data: { label: 'Epsilon' } },
    'g-edges',
  );
  child(
    { id: 'e3-b', type: 'small', position: { x: 470, y: 246 }, data: { label: 'Zeta' } },
    'g-edges',
  );

  // column 3 ---------------------------------------------------------------------------------------
  group('g-shapes', 'Shapes (resize with the handles)', 1250, 0, 560, 710);
  defaultShapes.names().forEach((name, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    child(
      {
        id: `shape-${name}`,
        type: 'shape',
        position: { x: 28 + col * 176, y: 42 + row * 168 },
        width: 148,
        height: 112,
        data: { shape: name, label: name, color: SHAPE_COLORS[i % SHAPE_COLORS.length] },
      },
      'g-shapes',
    );
  });
  return nodes;
}

function buildEdges(): Edge[] {
  const arrow = { type: MarkerType.ArrowClosed, width: 16, height: 16 };
  return [
    // status
    {
      id: 'st-1',
      source: 'task-initial',
      target: 'task-loading',
      type: 'animatedSvg',
      data: { duration: '2.4s' },
    },
    { id: 'st-2', source: 'task-success', target: 'task-error', type: 'smoothstep' },
    // schema: column to column, cardinality at the ends
    {
      id: 'orders-users',
      source: 'orders',
      sourceHandle: 'user_id',
      target: 'users',
      targetHandle: 'id',
      type: 'smoothstep',
      startLabel: 'N',
      endLabel: '1',
      markerEnd: arrow,
    },
    // handles
    { id: 'm-a', source: 'source-a', target: 'mixer', targetHandle: 'a', type: 'smoothstep' },
    { id: 'm-b', source: 'source-b', target: 'mixer', targetHandle: 'b', type: 'smoothstep' },
    { id: 'm-1', source: 'mixer', sourceHandle: 'out', target: 'step-1', type: 'smoothstep' },
    { id: 's2-p', source: 'step-2', target: 'placeholder', type: 'smoothstep' },
    // edges
    { id: 'x-button', source: 'e1-a', target: 'e1-b', type: 'button' },
    {
      id: 'x-data',
      source: 'e2-a',
      target: 'e2-b',
      type: 'data',
      data: { key: 'rate', rate: '120 req/s' },
      markerEnd: arrow,
    },
    {
      id: 'x-svg',
      source: 'e3-a',
      target: 'e3-b',
      type: 'animatedSvg',
      data: { duration: '1.8s' },
    },
  ];
}

// ---- mount ----------------------------------------------------------------------------------------

const mount: Mount = (root) => {
  if (!document.getElementById('g-ui-style')) {
    const style = document.createElement('style');
    style.id = 'g-ui-style';
    style.textContent = pageCss;
    document.head.append(style);
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let mode: Exclude<ColorMode, 'system'> = prefersDark ? 'dark' : 'light';
  const apply = (flow: XyFlowElement, button: HTMLButtonElement): void => {
    document.documentElement.dataset.theme = mode;
    flow.colorMode = mode;
    flow.style.setProperty('--xy-edge-stroke', mode === 'dark' ? '#7a8196' : '#8b92a8');
    flow.style.setProperty('--xy-edge-stroke-selected', mode === 'dark' ? '#c7cbe0' : '#4f46e5');
    button.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
  };

  const flow = document.createElement('xy-flow') as XyFlowElement;
  flow.style.cssText = 'display:block;width:100vw;height:100vh';
  flow.setAttribute('fit-view', '');
  flow.setAttribute('min-zoom', '0.2');
  flow.setAttribute('max-zoom', '2.5');
  flow.setAttribute('no-loading-overlay', '');
  flow.setAttribute('connection-mode', 'loose');
  flow.fitViewOptions = { padding: 0.12 };
  flow.nodeTypes = {
    ...uiNodeTypes,
    task: taskNode,
    mixer: mixerNode,
    small: smallNode,
    step: 'gallery-step-node',
  };
  flow.edgeTypes = uiEdgeTypes;
  flow.defaultEdgeOptions = { interactionWidth: 20 };
  flow.nodes = buildNodes();
  flow.edges = buildEdges();

  // the placeholder becomes a step when it is clicked
  flow.addEventListener(
    'placeholder-click' as never,
    ((e: CustomEvent<{ id: string }>) => {
      flow.updateNode(e.detail.id, {
        type: 'step',
        data: { title: 'New step', sub: 'Was a placeholder' },
      });
    }) as EventListener,
  );

  const background = document.createElement('xy-background');
  background.setAttribute('variant', 'dots');
  background.setAttribute('gap', '22');
  background.setAttribute('size', '1.4');

  const controls = document.createElement('xy-controls');
  controls.setAttribute('position', 'bottom-left');
  const minimap = document.createElement('xy-minimap');
  minimap.setAttribute('pannable', '');
  minimap.setAttribute('zoomable', '');
  const slider = document.createElement('xy-zoom-slider');
  const select = document.createElement('xy-zoom-select');
  select.setAttribute('position', 'center-left');
  const search = document.createElement('xy-node-search');
  search.setAttribute('position', 'top-left');
  const devtools = document.createElement('xy-devtools');
  devtools.setAttribute('position', 'top-right');

  const titlePanel = document.createElement('xy-panel');
  titlePanel.setAttribute('position', 'top-center');
  const title = document.createElement('div');
  title.className = 'g-title';
  title.innerHTML = '<strong>@xy-lit/ui</strong><span>component gallery</span>';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'g-theme';
  toggle.dataset.testid = 'theme-toggle';
  toggle.addEventListener('click', () => {
    mode = mode === 'dark' ? 'light' : 'dark';
    apply(flow, toggle);
  });
  title.append(toggle);
  titlePanel.append(title);

  flow.append(background, controls, minimap, slider, select, search, devtools, titlePanel);
  apply(flow, toggle);
  root.replaceChildren(flow);
  Object.assign(window, { flow });
};
export default mount;
