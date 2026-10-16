<script setup lang="ts">
import { useData } from 'vitepress';
import Demo from './Demo.vue';
const { frontmatter } = useData();
</script>

<template>
  <section v-if="frontmatter.layout === 'home'" class="home-demo" aria-label="Live demo">
    <div class="home-demo-inner">
      <Demo name="hero" :height="440" :source="false" caption="" />
      <p class="home-demo-hint">
        This is a live flow: drag nodes, drag from a handle to connect, scroll the page freely and
        hold Ctrl or Cmd while scrolling to zoom.
      </p>
    </div>
  </section>
</template>
