<script setup lang="ts">
// The gallery of apps/examples: titles and descriptions come straight from that app's catalog, so
// the page cannot drift from it. Previews are iframes of the running examples app, created only
// when asked for (the app is a separate dev server: `pnpm dev`).
import { computed, ref } from 'vue';
import { catalog, categories } from '../../../examples/src/catalog';

declare const __XY_URLS__: { examples: string; storybook: string };
const base = __XY_URLS__.examples.replace(/\/$/, '');
const local = /^https?:\/\/localhost/.test(base);

const query = ref('');
const open = ref<string | null>(null);

const groups = computed(() => {
  const q = query.value.trim().toLowerCase();
  return Object.entries(categories)
    .map(([id, meta]) => ({
      id,
      ...meta,
      entries: catalog.filter(
        (e) =>
          e.category === id &&
          (!q || `${e.title} ${e.description} ${e.route}`.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.entries.length);
});
</script>

<template>
  <div class="gallery">
    <div class="gallery-head">
      <input v-model="query" type="search" placeholder="Filter examples" aria-label="Filter examples" />
      <span v-if="local" class="gallery-hint">
        Run the examples app with <code>pnpm dev</code> (<code>{{ base }}</code>). Previews load from there.
      </span>
      <span v-else class="gallery-hint">Previews load the hosted examples app.</span>
    </div>
    <section v-for="group in groups" :key="group.id" class="gallery-group">
      <h2 :id="group.id">{{ group.title }}</h2>
      <p class="gallery-blurb">{{ group.blurb }}</p>
      <div class="gallery-cards">
        <article v-for="entry in group.entries" :key="entry.route" class="gallery-card">
          <h3>{{ entry.title }}</h3>
          <p>{{ entry.description }}</p>
          <div class="gallery-actions">
            <a :href="base + entry.route" target="_blank" rel="noopener">Open</a>
            <button type="button" @click="open = open === entry.route ? null : entry.route">
              {{ open === entry.route ? 'Close preview' : 'Preview' }}
            </button>
            <code>{{ entry.route }}</code>
          </div>
          <iframe
            v-if="open === entry.route"
            :src="base + entry.route"
            :title="`${entry.title} example`"
            loading="lazy"
          ></iframe>
        </article>
      </div>
    </section>
    <p v-if="!groups.length">No example matches the filter.</p>
  </div>
</template>

<style scoped>
.gallery-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin-bottom: 8px;
}
.gallery-head input {
  min-width: 220px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font: inherit;
}
.gallery-hint,
.gallery-blurb {
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.gallery-blurb {
  margin: 0 0 12px;
}
.gallery-group h2 {
  margin-top: 32px;
}
.gallery-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.gallery-card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.gallery-card:has(iframe) {
  grid-column: 1 / -1;
}
.gallery-card h3 {
  margin: 0 0 4px;
  font-size: 15px;
}
.gallery-card p {
  flex: 1;
  margin: 0 0 10px;
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  line-height: 1.5;
}
.gallery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  font-size: 13px;
}
.gallery-actions button {
  padding: 1px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  cursor: pointer;
}
.gallery-actions code {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
iframe {
  width: 100%;
  height: 480px;
  margin-top: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
}
</style>
