# Frameworks

`<xy-flow>` is a custom element, so it works in any framework without a wrapper package. The binding rules are the
same everywhere:

- **Import `@xy-lit/flow/define.js` once** (at your app's entry), before the flow is created.
- **`nodes`, `edges` and every object or function option are properties.** Frameworks that set a property when it exists
  on the element (Vue, Svelte, Angular `[prop]`, React 19) do the right thing with `nodes={nodes}`.
- **Scalar options are attributes** in kebab-case (`fit-view`, `min-zoom`) and properties in camelCase; boolean attributes that
  default to `true` take the string `"false"`.
- **Events are `CustomEvent`s** with kebab-case names (`nodes-change`, `connect`); read `event.detail`. They bubble and are
  composed.
- Give the element a **height**.

With controlled state, keep nodes and edges in an immutable structure (replace arrays, do not mutate or wrap them in deep
reactive proxies: the engine compares identities) and apply the changes with `applyNodeChanges` / `applyEdgeChanges`.

## Vue

Tell the compiler that `xy-` tags are custom elements, and use the element like any other. The demo below is exactly this
component.

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('xy-') } } })] };
```

```vue
<script setup lang="ts">
import '@xy-lit/flow/define.js';
import { shallowRef } from 'vue';
import { applyEdgeChanges, applyNodeChanges } from '@xy-lit/flow';

const nodes = shallowRef([{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Vue owns' } }]);
const edges = shallowRef([]);
const onNodesChange = (e: CustomEvent) => {
  e.preventDefault();
  nodes.value = applyNodeChanges(e.detail.changes, nodes.value);
};
const onEdgesChange = (e: CustomEvent) => {
  e.preventDefault();
  edges.value = applyEdgeChanges(e.detail.changes, edges.value);
};
</script>

<template>
  <xy-flow :nodes="nodes" :edges="edges" fit-view style="display: block; height: 400px"
    @nodes-change="onNodesChange" @edges-change="onEdgesChange">
    <xy-controls></xy-controls>
  </xy-flow>
</template>
```

<Demo name="frameworks" :height="320" caption="The Vue component above, controlled by Vue state. This documentation site is a Vue application." />

Use `shallowRef`, not `ref`: a deep reactive proxy around the nodes would defeat identity-based change detection.

## React 19

React 19 supports custom elements: props whose name exists as a property on the element are assigned as properties,
the others become attributes. Events are best attached with a ref, because React does not map `onNodesChange` to a
custom event named `nodes-change`.

```tsx
import '@xy-lit/flow/define.js';
import { useEffect, useRef, useState, type DetailedHTMLProps, type HTMLAttributes } from 'react';
import { applyEdgeChanges, applyNodeChanges, type Edge, type Node, type XyFlowElement } from '@xy-lit/flow';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'xy-flow': DetailedHTMLProps<HTMLAttributes<XyFlowElement>, XyFlowElement> & Record<string, unknown>;
      'xy-controls': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export function Diagram() {
  const ref = useRef<XyFlowElement>(null);
  const [nodes, setNodes] = useState<Node[]>([{ id: '1', position: { x: 0, y: 0 }, data: { label: 'React owns' } }]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const flow = ref.current!;
    const onNodes = (e: Event) => {
      e.preventDefault();
      setNodes((n) => applyNodeChanges((e as CustomEvent).detail.changes, n));
    };
    const onEdges = (e: Event) => {
      e.preventDefault();
      setEdges((n) => applyEdgeChanges((e as CustomEvent).detail.changes, n));
    };
    flow.addEventListener('nodes-change', onNodes);
    flow.addEventListener('edges-change', onEdges);
    return () => {
      flow.removeEventListener('nodes-change', onNodes);
      flow.removeEventListener('edges-change', onEdges);
    };
  }, []);

  return (
    <xy-flow ref={ref} nodes={nodes} edges={edges} fit-view style={{ display: 'block', height: 400 }}>
      <xy-controls />
    </xy-flow>
  );
}
```

Custom node renderers are Lit templates (`defineNodeType`) or `FlowNodeElement` subclasses, not React components. To use React
inside a node, render a React root into a container element from a `FlowNodeElement` (the same pattern as for any custom
element), and keep the handles as `<xy-handle>` elements in the node's light DOM.
A dedicated `@xy-lit/react` wrapper is not part of this release.

## Angular

```ts
// main.ts
import '@xy-lit/flow/define.js';

// app.component.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { applyNodeChanges, type Node, type NodeChange } from '@xy-lit/flow';

@Component({
  selector: 'app-diagram',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <xy-flow [nodes]="nodes" [edges]="edges" fit-view style="display: block; height: 400px"
      (nodes-change)="onNodesChange($any($event))">
      <xy-controls></xy-controls>
    </xy-flow>
  `,
})
export class DiagramComponent {
  nodes: Node[] = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Angular owns' } }];
  edges = [];
  onNodesChange(e: CustomEvent<{ changes: NodeChange[] }>) {
    e.preventDefault();
    this.nodes = applyNodeChanges(e.detail.changes, this.nodes);
  }
}
```

`[nodes]` binds the property; `(nodes-change)` listens to the DOM event. Leave out the `preventDefault` handlers for an
uncontrolled flow and just set `nodes` once.

## Svelte

```svelte
<script lang="ts">
  import '@xy-lit/flow/define.js';
  import { applyNodeChanges, type Node } from '@xy-lit/flow';

  let nodes: Node[] = $state.raw([{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Svelte owns' } }]);
  let edges = $state.raw([]);

  function onNodesChange(e: CustomEvent) {
    e.preventDefault();
    nodes = applyNodeChanges(e.detail.changes, nodes);
  }
</script>

<xy-flow {nodes} {edges} fit-view style="display: block; height: 400px" on:nodes-change={onNodesChange}>
  <xy-controls></xy-controls>
</xy-flow>
```

Use `$state.raw` so Svelte does not wrap the arrays in a deep proxy. `on:nodes-change` is Svelte's event directive, which
accepts any event name and works in Svelte 4 and 5.

## No framework, and Lit

See [getting started](/guide/getting-started). In a Lit element, bind `.nodes` once (`guard`) or set it imperatively, and
listen with `@nodes-change=${...}`.

## Server rendering

The flow needs a browser: its layout is measured. Render a container on the server, register the elements and assign data
on the client only (this site does so with a client-only `Demo` component). The store (`@xy-lit/store`) runs in Node.

::: info What the tests cover
The Vue demo on this page runs in the documentation test suite. The React 19, Angular and Svelte snippets are
type-checked by `pnpm --filter @xy-lit/docs check:snippets` (part of `pnpm --filter @xy-lit/docs test`) against the real
`@xy-lit/flow` types. React is checked against `@types/react`; the Angular and Svelte compilers are not installed here, so
their templates and markup are not compiled.
:::
