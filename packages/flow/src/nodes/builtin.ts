// Ported from xyflow (MIT) packages/svelte/src/lib/components/nodes/*.svelte@3d35b57
import { html, nothing } from 'lit';
import { Position } from '@xy-lit/store';
import type { BuiltInNode } from '@xy-lit/store';
import { defineNodeType } from './define-node-type.js';
import type { NodeTypes } from './define-node-type.js';

/** `default`: a target handle on top, the label, a source handle at the bottom. */
export const defaultNode = defineNodeType<BuiltInNode>({
  // prettier-ignore
  render: ({ data, sourcePosition = Position.Bottom, targetPosition = Position.Top }) => html`<xy-handle type="target" position=${targetPosition}></xy-handle>${data?.label ?? ''}<xy-handle type="source" position=${sourcePosition}></xy-handle>`,
});

/** `input`: the label and a source handle. */
export const inputNode = defineNodeType<BuiltInNode>({
  render: ({ data, sourcePosition = Position.Bottom }) =>
    html`${data?.label ?? ''}<xy-handle type="source" position=${sourcePosition}></xy-handle>`,
});

/** `output`: a target handle and the label. */
export const outputNode = defineNodeType<BuiltInNode>({
  render: ({ data, targetPosition = Position.Top }) =>
    html`<xy-handle type="target" position=${targetPosition}></xy-handle>${data?.label ?? ''}`,
});

/** `group`: an empty box that other nodes can be placed in. */
export const groupNode = defineNodeType<BuiltInNode>({ render: () => nothing });

/** The node types every flow has; user `nodeTypes` entries win over these. */
export const builtinNodeTypes: NodeTypes = {
  default: defaultNode,
  input: inputNode,
  output: outputNode,
  group: groupNode,
};
