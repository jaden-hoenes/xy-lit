/**
 * `@xy-lit/pro`: undo/redo, clipboard, helper lines, layout, animation, collapse and grouping
 * for XY Lit flows. Every feature is built on the public store and instance APIs and composes
 * with the others on one `<xy-flow>`.
 *
 * @packageDocumentation
 */

export { storeOf, instanceOf, withStore } from './common.js';
export type { FlowLike, Disposer } from './common.js';

export { LocalHistory } from './history/local-history.js';
export type { LocalHistoryOptions } from './history/local-history.js';

export {
  installClipboard,
  serializeSelection,
  parseClipboard,
  pasteElements,
  CLIPBOARD_MIME,
} from './clipboard/clipboard.js';
export type {
  ClipboardOptions,
  ClipboardPayload,
  InstalledClipboard,
  PasteOptions,
} from './clipboard/clipboard.js';

export {
  installHelperLines,
  defineHelperLines,
  XyHelperLinesElement,
} from './helper-lines/helper-lines.js';
export type {
  HelperGuides,
  HelperLinesOptions,
  InstalledHelperLines,
} from './helper-lines/helper-lines.js';

export { animateNodePositions, easeInOutCubic } from './animation/animate.js';
export type { AnimateOptions } from './animation/animate.js';

export { layout, applyLayout, disposeLayoutWorker, layoutBackend } from './layout/layout.js';
export type { ApplyLayoutOptions, LayoutRunOptions } from './layout/layout.js';
export type { LayoutOptions, LayoutDirection } from './layout/algorithms.js';

export {
  toggleCollapsed,
  collapseAll,
  expandAll,
  isCollapsed,
  getCollapsibleDescendants,
} from './collapse/collapse.js';

export { groupSelection, ungroup, installDropIntoGroup } from './grouping/grouping.js';
export type { GroupOptions, DropIntoGroupOptions } from './grouping/grouping.js';
