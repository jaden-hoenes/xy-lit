import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import '@fontsource-variable/inter';
import './style.css';
import Demo from './Demo.vue';
import HomeDemo from './HomeDemo.vue';
import ExamplesGallery from './ExamplesGallery.vue';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-features-before': () => h(HomeDemo),
    }),
  async enhanceApp({ app }) {
    app.component('Demo', Demo);
    app.component('ExamplesGallery', ExamplesGallery);
    // register the custom elements on the client only: they need `customElements` and the DOM
    if (!import.meta.env.SSR) {
      await Promise.all([
        import('@xy-lit/flow/define.js'),
        import('@xy-lit/collab-yjs/define.js'),
        import('@xy-lit/pro/define.js'),
        import('@xy-lit/ui/define.js'),
      ]);
    }
  },
} satisfies Theme;
