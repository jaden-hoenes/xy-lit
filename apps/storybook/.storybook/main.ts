import type { StorybookConfig } from '@storybook/web-components-vite';
import { mergeConfig } from 'vite';
import { workspaceAliases } from '../../../config/aliases.ts';
import { keepDefineSideEffects } from '../../../config/vite-define.ts';

const config: StorybookConfig = {
  stories: ['../stories/introduction.mdx', '../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/web-components-vite',
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [keepDefineSideEffects],
      resolve: { alias: workspaceAliases },
      // @xy-lit/pro's layout worker is an ES module with dynamic imports (code splitting)
      worker: { format: 'es' },
    }),
};

export default config;
