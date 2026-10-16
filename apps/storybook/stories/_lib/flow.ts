/**
 * Helpers shared by the stories: one-time data binding, property and listener directives for
 * `<xy-flow>`, the standard argTypes and a few demo graphs.
 */
import { LitElement, css, html, noChange, nothing } from 'lit';
import { Directive, PartType, directive } from 'lit/directive.js';
import type { ElementPart, PartInfo } from 'lit/directive.js';
import { guard } from 'lit/directives/guard.js';
import { action } from 'storybook/actions';
import type { ArgTypes } from '@storybook/web-components-vite';
import { Position, defineNodeType } from '@xy-lit/flow';
import type { Edge, Node as FlowNode, XyFlowElement } from '@xy-lit/flow';

/**
 * Binds the value built by `factory` on the first render only. Lit sets a property binding to an
 * object or array on every render, which would reset a flow that owns its nodes. A fresh copy per
 * mount also keeps stories from sharing (and mutating) module-level data.
 */
export const once = <T>(factory: () => T) => guard([], factory);

/** Deep copy for node and edge arrays. */
export const clone = <T>(value: T): T => structuredClone(value);

class PropsDirective extends Directive {
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT) throw new Error('props() works on elements only');
  }
  render(values: Record<string, unknown>) {
    void values; // consumed in update()
    return nothing;
  }
  override update(part: ElementPart, [values]: [Record<string, unknown>]) {
    const el = part.element as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && el[key] !== value) el[key] = value;
    }
    return noChange;
  }
}
/**
 * Assigns the given values as properties of the element (skipping `undefined`). Used to turn story
 * args into `<xy-flow>` properties without a binding per property.
 */
export const props = directive(PropsDirective);

class OnDirective extends Directive {
  #element: Element | null = null;
  #bound = new Map<string, EventListener>();
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT) throw new Error('on() works on elements only');
  }
  render(handlers: Record<string, EventListener>) {
    void handlers; // consumed in update()
    return nothing;
  }
  override update(part: ElementPart, [handlers]: [Record<string, EventListener>]) {
    this.#element = part.element;
    for (const [name, fn] of this.#bound) {
      if (handlers[name] !== fn) {
        this.#element.removeEventListener(name, fn);
        this.#bound.delete(name);
      }
    }
    for (const [name, fn] of Object.entries(handlers)) {
      if (!this.#bound.has(name)) {
        this.#element.addEventListener(name, fn);
        this.#bound.set(name, fn);
      }
    }
    return noChange;
  }
}
/** Adds the given listeners to the element (`<xy-flow ${on({ 'node-click': fn })}>`). */
export const on = directive(OnDirective);

/** A JSON-safe, short rendering of an event detail for the actions panel. */
export function brief(value: unknown, depth = 3): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? '[function]' : value;
  }
  if (value instanceof Event) return `[${value.type}]`;
  if (typeof (value as { nodeType?: number }).nodeType === 'number') return '[element]';
  if (depth <= 0) return Array.isArray(value) ? `[${value.length} items]` : '[object]';
  if (Array.isArray(value)) return value.slice(0, 8).map((v) => brief(v, depth - 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'internals' || k === 'instance' || k === 'measured' || k === 'remote') continue;
    out[k] = brief(v, depth - 1);
  }
  return out;
}

/** Listeners that log the given flow events to the actions panel (`on(logEvents('connect', ...))`). */
export function logEvents(...names: string[]): Record<string, EventListener> {
  return Object.fromEntries(
    names.map((name) => {
      const log = action(name);
      const fn: EventListener = (e) => log(brief((e as CustomEvent).detail));
      return [name, fn];
    }),
  );
}

class FitWhenRenderedDirective extends Directive {
  #done = false;
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT) throw new Error('fitWhenRendered() works on elements only');
  }
  render() {
    return nothing;
  }
  override update(part: ElementPart) {
    if (!this.#done) {
      this.#done = true;
      const flow = part.element as XyFlowElement;
      // the initial `fit-view` leaves out group nodes that have an explicit size (they are not
      // measured yet when it runs): fit once more when everything is rendered
      void flow.whenRendered().then(() => flow.fitView());
    }
    return noChange;
  }
}
/** `<xy-flow ${fitWhenRendered()}>`: fit the view once after the first render-complete. */
export const fitWhenRendered = directive(FitWhenRenderedDirective);

/** Base class of the stories' own elements: renders into the light DOM so the story CSS applies. */
export abstract class StoryElement extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    this.classList.add('sb-story');
    return this;
  }
}

/** Register a story element once (Storybook may evaluate a story module again on hot reload). */
export function defineStoryElement(tag: string, ctor: CustomElementConstructor): string {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
  return tag;
}

// ---- argTypes ------------------------------------------------------------------------------------

const bool = (description: string, category = 'Interaction', defaultValue?: boolean) => ({
  control: 'boolean' as const,
  description,
  table: {
    category,
    ...(defaultValue === undefined ? {} : { defaultValue: { summary: String(defaultValue) } }),
  },
});

/** The `<xy-flow>` properties the stories expose as controls. */
export const flowArgTypes: ArgTypes = {
  fitViewOnInit: bool('Fit the viewport to the nodes on load (`fit-view`).', 'Viewport', false),
  minZoom: {
    control: { type: 'number', min: 0.05, max: 2, step: 0.05 },
    table: { category: 'Viewport' },
  },
  maxZoom: {
    control: { type: 'number', min: 1, max: 8, step: 0.5 },
    table: { category: 'Viewport' },
  },
  nodesDraggable: bool('Nodes can be dragged (`nodes-draggable`).', 'Interaction', true),
  nodesConnectable: bool('Handles accept connections (`nodes-connectable`).', 'Interaction', true),
  elementsSelectable: bool(
    'Nodes and edges can be selected (`elements-selectable`).',
    'Interaction',
    true,
  ),
  edgesReconnectable: bool(
    'Edge ends can be dragged to other handles (`edges-reconnectable`).',
    'Interaction',
    false,
  ),
  panOnDrag: bool('Drag the pane to pan (`pan-on-drag`).', 'Interaction', true),
  panOnScroll: bool('Scroll pans instead of zooming (`pan-on-scroll`).', 'Interaction', false),
  zoomOnScroll: bool('Scroll zooms (`zoom-on-scroll`).', 'Interaction', true),
  zoomOnDoubleClick: bool('Double click zooms in (`zoom-on-double-click`).', 'Interaction', true),
  selectionOnDrag: bool(
    'Dragging the pane draws a selection box (`selection-on-drag`).',
    'Interaction',
    false,
  ),
  snapToGrid: bool('Snap dragged nodes to the grid (`snap-to-grid`).', 'Interaction', false),
  connectOnClick: bool(
    'Click a handle, then another, to connect (`connect-on-click`).',
    'Interaction',
    true,
  ),
  colorMode: {
    control: 'inline-radio',
    options: ['light', 'dark', 'system'],
    description: 'Follows the toolbar unless a story pins it.',
    table: { category: 'Appearance' },
  },
  hideAttribution: bool('Hide the attribution link (`hide-attribution`).', 'Appearance', false),
  parallelEdges: {
    control: 'inline-radio',
    options: ['off', 'spread'],
    table: { category: 'Edges' },
  },
  motion: {
    control: 'inline-radio',
    options: ['off', 'enter', 'enter remote'],
    table: { category: 'Appearance' },
  },
};

/** Args the standard flow templates read. */
export interface FlowArgs {
  fitViewOnInit?: boolean;
  minZoom?: number;
  maxZoom?: number;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  edgesReconnectable?: boolean;
  panOnDrag?: boolean;
  panOnScroll?: boolean;
  zoomOnScroll?: boolean;
  zoomOnDoubleClick?: boolean;
  selectionOnDrag?: boolean;
  snapToGrid?: boolean;
  connectOnClick?: boolean;
  colorMode?: 'light' | 'dark' | 'system';
  hideAttribution?: boolean;
  parallelEdges?: 'off' | 'spread';
  motion?: 'off' | 'enter' | 'enter remote';
}

/** Control names for `parameters.controls.include`. */
export const flowControls = Object.keys(flowArgTypes);

/** Pick the flow properties out of a story's args. */
export function flowPropsOf(args: FlowArgs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of flowControls) {
    const value = (args as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ---- demo data -----------------------------------------------------------------------------------

/** A small graph with every built-in node type; used where the data is not the point. */
export const starterNodes = (): FlowNode[] => {
  const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
  return [
    { id: 'in', type: 'input', position: { x: 0, y: 110 }, data: { label: 'Input' }, ...lr },
    { id: 'a', position: { x: 240, y: 10 }, data: { label: 'Node A' }, ...lr },
    { id: 'b', position: { x: 240, y: 210 }, data: { label: 'Node B' }, ...lr },
    { id: 'c', position: { x: 480, y: 110 }, data: { label: 'Node C' }, ...lr },
    { id: 'out', type: 'output', position: { x: 720, y: 110 }, data: { label: 'Output' }, ...lr },
  ];
};
export const starterEdges = (): Edge[] => [
  { id: 'in-a', source: 'in', target: 'a' },
  { id: 'in-b', source: 'in', target: 'b' },
  { id: 'a-c', source: 'a', target: 'c' },
  { id: 'b-c', source: 'b', target: 'c', animated: true },
  { id: 'c-out', source: 'c', target: 'out' },
];

/** `meta.parameters` shorthand: a description shown on the story's docs page. */
export const describe = (text: string) => ({ docs: { description: { story: text } } });

/** The usual plugin trio. Import `html` from lit in the story and spread this into the flow. */
export const chrome = (
  o: { minimap?: boolean; controls?: boolean; background?: string } = {},
) => html`
  ${o.controls === false ? nothing : html`<xy-controls></xy-controls>`}
  ${o.minimap === false ? nothing : html`<xy-minimap pannable zoomable></xy-minimap>`}
  <xy-background variant=${o.background ?? 'dots'}></xy-background>
`;

/** Card styling for custom node types, drawn from the flow's own tokens so it follows the colour mode. */
export const nodeCardCss = css`
  .sb-node {
    box-sizing: border-box;
    padding: 10px 14px;
    background: var(--xy-node-background-color, var(--xy-node-background-color-default));
    color: var(--xy-node-color, var(--xy-node-color-default));
    border: var(--xy-node-border, var(--xy-node-border-default));
    border-radius: var(--xy-node-border-radius, var(--xy-node-border-radius-default, 6px));
    font-size: 12px;
  }
  .sb-node.sb-fill {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

/** A group node with a visible title: custom node types have no box of their own, so it draws one. */
export const groupNode = defineNodeType<FlowNode<{ label: string; rgb: string }>>({
  styles: css`
    .sb-group {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border-radius: 10px;
      border: 1px dashed rgba(var(--rgb), 0.75);
      background: rgba(var(--rgb), 0.1);
    }
    .sb-group-title {
      position: absolute;
      top: 6px;
      left: 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgb(var(--rgb));
    }
  `,
  render: ({ data }) =>
    html`<div class="sb-group" style="--rgb: ${data.rgb}">
      <span class="sb-group-title">${data.label}</span>
    </div>`,
});
export const groupTypes = { titled: groupNode };
export const titled = (id: string, label: string, rgb: string, rest: Partial<FlowNode>): FlowNode =>
  ({ id, type: 'titled', data: { label, rgb }, ...rest }) as FlowNode;
