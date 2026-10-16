<script setup lang="ts">
// Renders a live demo: a container that a module from `apps/docs/demos/<name>.ts` fills on mount
// (`export function mount(el)`). Client only; the server renders just the frame. Once every
// <xy-flow> in the container reported `render-complete` the container gets
// `data-render-complete="true"`, which the smoke test waits for.
import { computed, createApp, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    name: string;
    height?: number | string;
    caption?: string;
    /** Offer the demo's source file under the frame. */
    source?: boolean;
  }>(),
  { height: 360, caption: '', source: true },
);

type Mount = (el: HTMLElement) => void | (() => void) | Promise<void | (() => void)>;
const loaders = import.meta.glob<{ mount: Mount }>('../../demos/*.ts');
// a demo may also be a Vue single-file component (the Vue usage shown in the frameworks guide)
const vueLoaders = import.meta.glob<{ default: Component }>('../../demos/*.vue');
const sources = import.meta.glob<string>('../../demos/*.{ts,vue}', { query: '?raw', import: 'default' });

const host = ref<HTMLElement | null>(null);
const state = ref<'loading' | 'ready' | 'error'>('loading');
const errorText = ref('');
const code = ref('');
const showCode = ref(false);
const size = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));

let dispose: (() => void) | void;
let observer: MutationObserver | undefined;
let childObserver: MutationObserver | undefined;

type ColorModeFlow = HTMLElement & { colorMode?: string };
const applyColorMode = (): void => {
  const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  host.value?.querySelectorAll<ColorModeFlow>('xy-flow').forEach((flow) => {
    if (flow.colorMode !== mode) flow.colorMode = mode;
  });
  host.value?.setAttribute('data-color-mode', mode);
};

onMounted(async () => {
  const el = host.value;
  if (!el) return;
  try {
    const load = loaders[`../../demos/${props.name}.ts`];
    const loadVue = vueLoaders[`../../demos/${props.name}.vue`];
    if (load) {
      const mod = await load();
      dispose = await mod.mount(el);
    } else if (loadVue) {
      const app = createApp((await loadVue()).default);
      app.mount(el);
      dispose = () => app.unmount();
    } else {
      throw new Error(`no demo named "${props.name}" in apps/docs/demos`);
    }
    applyColorMode();
    observer = new MutationObserver(applyColorMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // demos that re-create their flow get the page's colour mode too
    childObserver = new MutationObserver(applyColorMode);
    childObserver.observe(el, { childList: true, subtree: true });
    const flows = Array.from(el.querySelectorAll<HTMLElement & { whenRendered(): Promise<unknown> }>('xy-flow'));
    // demos with a flow that never gets nodes still finish: the flow's own timeout applies
    await Promise.race([
      Promise.all(flows.map((f) => f.whenRendered())),
      new Promise((resolve) => setTimeout(resolve, 20000)),
    ]);
    el.setAttribute('data-render-complete', 'true');
    state.value = 'ready';
  } catch (error) {
    console.error(`[docs] demo "${props.name}" failed`, error);
    errorText.value = String(error);
    state.value = 'error';
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  childObserver?.disconnect();
  if (typeof dispose === 'function') dispose();
  host.value?.replaceChildren();
});

async function toggleSource(): Promise<void> {
  showCode.value = !showCode.value;
  if (showCode.value && !code.value) {
    const load = sources[`../../demos/${props.name}.ts`] ?? sources[`../../demos/${props.name}.vue`];
    code.value = load ? await load() : '// source not found';
  }
}
</script>

<template>
  <figure class="xy-demo-figure">
    <div
      ref="host"
      class="xy-demo"
      :data-demo="name"
      :data-state="state"
      :style="{ height: size }"
      role="group"
      :aria-label="caption || `Live demo: ${name}`"
    ></div>
    <p v-if="state === 'error'" class="xy-demo-error">This demo failed to load: {{ errorText }}</p>
    <figcaption v-if="caption || source" class="xy-demo-caption">
      <span v-if="caption">{{ caption }}</span>
      <button v-if="source" type="button" class="xy-demo-source-toggle" @click="toggleSource">
        {{ showCode ? 'Hide demo source' : 'Show demo source' }}
      </button>
    </figcaption>
    <pre v-if="showCode" class="xy-demo-source"><code>{{ code }}</code></pre>
  </figure>
</template>
