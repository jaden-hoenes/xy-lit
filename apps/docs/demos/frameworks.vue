<script setup lang="ts">
// The Vue usage from the frameworks guide, running: a controlled flow bound with
// `:nodes`, `:edges` and `@nodes-change` on the custom element (isCustomElement is configured
// for the `xy-` prefix in the docs' VitePress config; in your app set it in the Vue plugin options).
import { shallowRef } from 'vue';
import { applyEdgeChanges, applyNodeChanges } from '@xy-lit/flow';
import type { Edge, EdgeChange, Node, NodeChange } from '@xy-lit/flow';

const nodes = shallowRef<Node[]>([
  { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Vue owns' } },
  { id: '2', position: { x: 200, y: 90 }, data: { label: 'these nodes' } },
]);
const edges = shallowRef<Edge[]>([{ id: 'e1-2', source: '1', target: '2' }]);

function onNodesChange(e: CustomEvent<{ changes: NodeChange[] }>) {
  e.preventDefault(); // controlled: apply the changes ourselves
  nodes.value = applyNodeChanges(e.detail.changes, nodes.value);
}
function onEdgesChange(e: CustomEvent<{ changes: EdgeChange[] }>) {
  e.preventDefault();
  edges.value = applyEdgeChanges(e.detail.changes, edges.value);
}
function addNode() {
  const id = String(nodes.value.length + 1);
  nodes.value = [...nodes.value, { id, position: { x: 40 * nodes.value.length, y: 150 }, data: { label: `Added ${id}` } }];
}
</script>

<template>
  <div class="demo-bar">
    <button type="button" @click="addNode">Add node</button>
    <span class="spacer"></span>
    <span>Vue state: {{ nodes.length }} nodes, {{ edges.length }} edges</span>
  </div>
  <xy-flow
    :nodes="nodes"
    :edges="edges"
    fit-view
    prevent-scrolling="false"
    zoom-on-scroll="false"
    @nodes-change="onNodesChange"
    @edges-change="onEdgesChange"
  >
    <xy-background></xy-background>
    <xy-controls></xy-controls>
  </xy-flow>
</template>
