/**
 * Engine internals for sibling packages (`@xy-lit/flow`, `@xy-lit/pro`, ...): the full list of
 * symbols in `engine.ts` (XYDrag, XYPanZoom, XYHandle, XYResizer, XYMinimap, store utilities,
 * geometry helpers, ...) and the hook to reach a store from an instance. Not a public API.
 *
 * @packageDocumentation
 */
export * from './engine.js';
export { STORE_SYMBOL, getStoreOf } from './instance.js';
