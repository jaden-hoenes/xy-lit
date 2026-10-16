import type { TemplateResult } from 'lit';
import type { AriaLabelConfig, FlowInstance, FlowStore } from '@xy-lit/store';
import type { XyFlowElement } from './elements/xy-flow.js';
import type { MeasureController } from './elements/xy-flow/measure.js';
import type { EdgeTypes } from './edges/define-edge-type.js';
import type { NodeTypes } from './nodes/define-node-type.js';

/**
 * Entrance motion state (spec/10 §Motion). Filled in by the motion task; until then the flow
 * always passes {@link MOTION_OFF}.
 */
export type MotionState = {
  /** The configured `motion` mode. */
  mode: 'off' | 'enter' | 'enter remote';
  /** Whether entrance animations are active right now. */
  enabled: boolean;
  /** Node ids that should animate in now. */
  entering: ReadonlySet<string>;
  /** Edge ids that should animate in now. */
  enteringEdges: ReadonlySet<string>;
};

/** Motion disabled. */
export const MOTION_OFF: MotionState = Object.freeze({
  mode: 'off',
  enabled: false,
  entering: new Set<string>(),
  enteringEdges: new Set<string>(),
});

/**
 * Everything a `<xy-node>` needs from its flow. Built by `<xy-flow>` and passed as `.ctx`; the
 * identity changes only when a field changes (shallow equality).
 */
export type NodeRenderContext = {
  /** The flow's store. */
  store: FlowStore;
  /** The flow's imperative API. */
  instance: FlowInstance;
  /** The flow element. */
  flow: XyFlowElement;
  /** Id of the flow. */
  flowId: string;
  /** Built-in node types merged with the user's. */
  nodeTypes: NodeTypes;
  /** Default for nodes without their own `draggable`. */
  nodesDraggable: boolean;
  /** Default for nodes without their own `connectable`. */
  nodesConnectable: boolean;
  /** Default for nodes without their own `focusable`. */
  nodesFocusable: boolean;
  /** Default for nodes without their own `selectable`. */
  elementsSelectable: boolean;
  /** Select a node when its drag starts. */
  selectNodesOnDrag: boolean;
  /** Pixels before a node drag starts. */
  nodeDragThreshold: number;
  /** Pixels a pointer may move for a press to still count as a click. */
  nodeClickDistance: number;
  /** Class that stops a drag from starting. */
  noDragClassName: string;
  /** Class that stops panning. */
  noPanClassName: string;
  /** Keyboard interaction with nodes is off. */
  disableKeyboardA11y: boolean;
  /** Pan to a focused node outside the viewport. */
  autoPanOnNodeFocus: boolean;
  /** ARIA label strings. */
  ariaLabelConfig: AriaLabelConfig;
  /** The flow's measure controller. */
  measure: MeasureController;
  /** Entrance motion. */
  motion: MotionState;
  /** Event types that have at least one listener on the flow. */
  listeners: ReadonlySet<string>;
};

/** Everything a `<xy-edge>` needs from its flow. Same rules as {@link NodeRenderContext}. */
export type EdgeRenderContext = {
  /** The flow's store. */
  store: FlowStore;
  /** The flow's imperative API. */
  instance: FlowInstance;
  /** Id of the flow. */
  flowId: string;
  /** The flow element. */
  flow: XyFlowElement;
  /** Built-in edge types merged with the user's. */
  edgeTypes: EdgeTypes;
  /** Default for edges without their own `selectable`. */
  elementsSelectable: boolean;
  /** Default for edges without their own `focusable`. */
  edgesFocusable: boolean;
  /** Default for edges without their own `reconnectable`. */
  edgesReconnectable: boolean;
  /** Radius of the reconnect anchors. */
  reconnectRadius: number;
  /** Keyboard interaction with edges is off. */
  disableKeyboardA11y: boolean;
  /** ARIA label strings. */
  ariaLabelConfig: AriaLabelConfig;
  /** Class that stops panning. */
  noPanClassName: string;
  /** Event types that have at least one listener on the flow. */
  listeners: ReadonlySet<string>;
  /** Entrance motion. */
  motion: MotionState;
};

/** One HTML label an edge publishes to the flow's label layer. */
export type LabelEntry = {
  /** `${edgeId}:center`, `:start` or `:end`. */
  key: string;
  /** The label template (see `edgeLabel()`). */
  template: TemplateResult;
};
