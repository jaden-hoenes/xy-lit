import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: `<span style="display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:15px;letter-spacing:-0.02em;color:#1a1a24"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><rect x="1.5" y="3" width="9" height="7" rx="2" fill="#6366f1"/><rect x="15.5" y="16" width="9" height="7" rx="2" fill="#ec4899"/><path d="M10.5 6.5h3a3 3 0 0 1 3 3v6.5" stroke="#8b92a8" stroke-width="1.6" stroke-linecap="round"/><circle cx="16.5" cy="16" r="1.6" fill="#fff" stroke="#8b92a8" stroke-width="1.2"/></svg>XY Lit</span>`,
  brandUrl: '.',
  brandTarget: '_self',
  fontBase: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontCode: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
  colorPrimary: '#6366f1',
  colorSecondary: '#6366f1',
  appBg: '#f6f6f9',
  appContentBg: '#ffffff',
  appPreviewBg: '#ffffff',
  appBorderColor: '#e3e3ea',
  appBorderRadius: 8,
  barBg: '#ffffff',
  barTextColor: '#5b5b6b',
  barSelectedColor: '#4f46e5',
  barHoverColor: '#4f46e5',
  textColor: '#1a1a24',
  textMutedColor: '#6b6b7b',
  inputBorderRadius: 6,
});

addons.setConfig({
  theme,
  sidebar: { showRoots: false },
  panelPosition: 'bottom',
});
