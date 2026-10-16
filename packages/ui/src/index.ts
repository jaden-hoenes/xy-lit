/**
 * `@xy-lit/ui`: ready-made components for `@xy-lit/flow`: a node card with status ring, labeled and
 * button handles, a database schema node, shapes, placeholder and group nodes, tooltip and appendix,
 * button/data/animated edges, zoom slider and select, node search and devtools.
 *
 * Importing this module registers no element; import `@xy-lit/ui/define.js` for that.
 *
 * @packageDocumentation
 */

export { XyBaseNodeElement } from './base-node.js';
export { statusIndicator } from './status.js';
export type { NodeStatus } from './status.js';
export { labeledHandle, buttonHandle } from './handles.js';
export type { LabeledHandleOptions, ButtonHandleOptions } from './handles.js';
export { databaseSchemaNode } from './database-schema-node.js';
export type { DatabaseSchemaData, SchemaField } from './database-schema-node.js';
export { ShapeRegistry, defaultShapes, createDefaultShapes } from './shapes/registry.js';
export type { ShapeDefinition, ShapeHandle } from './shapes/registry.js';
export { shapeNode } from './shapes/shape-node.js';
export type { ShapeNodeData } from './shapes/shape-node.js';
export { placeholderNode } from './placeholder-node.js';
export type { PlaceholderNodeData, PlaceholderClickDetail } from './placeholder-node.js';
export { labeledGroupNode } from './labeled-group-node.js';
export type { LabeledGroupData } from './labeled-group-node.js';
export { nodeTooltip } from './node-tooltip.js';
export type { NodeTooltipOptions } from './node-tooltip.js';
export { nodeAppendix } from './node-appendix.js';
export type { AppendixPosition } from './node-appendix.js';
export { buttonEdge, dataEdge, animatedSvgEdge } from './edges.js';
export type { ButtonEdgeData, DataEdgeData, AnimatedSvgEdgeData, EdgePathType } from './edges.js';
export { XyZoomSliderElement, XyZoomSelectElement } from './zoom-slider.js';
export { XyNodeSearchElement } from './node-search.js';
export type { NodeSearchSelectDetail, NodeLabelGetter } from './node-search.js';
export { XyDevtoolsElement, XyDevtoolsInspectorElement, CHANGE_LOG_LIMIT } from './devtools.js';
export type { ChangeLogEntry } from './devtools.js';
export { uiStyles } from './styles.js';
export { tokens } from './tokens.js';

/** Node types of this package, ready for `flow.nodeTypes = { ...uiNodeTypes }`. */
import { databaseSchemaNode } from './database-schema-node.js';
import { labeledGroupNode } from './labeled-group-node.js';
import { placeholderNode } from './placeholder-node.js';
import { shapeNode } from './shapes/shape-node.js';
import { animatedSvgEdge, buttonEdge, dataEdge } from './edges.js';

/** `{ databaseSchema, shape, placeholder, labeledGroup }`: the node types of this package. */
export const uiNodeTypes = {
  databaseSchema: databaseSchemaNode,
  shape: shapeNode,
  placeholder: placeholderNode,
  labeledGroup: labeledGroupNode,
};

/** `{ button, data, animatedSvg }`: the edge types of this package. */
export const uiEdgeTypes = {
  button: buttonEdge,
  data: dataEdge,
  animatedSvg: animatedSvgEdge,
};
