// What the pages in apps/examples/src/examples/e2e-*.ts put on `window` (see apps/examples/src/lib/e2e.ts).
interface Window {
  /** The page's flow element (typed loosely: specs reach into it with `evaluate`). */
  flow?: unknown;
  /** Names of the events a page records. */
  __events?: string[];
  /** Details of the `render-complete` events a page records. */
  __renderComplete?: unknown[];
  /** Set by an injected `onerror` handler (must stay undefined). */
  __pwned?: number;
  /** `e2e-measurement`: toggle the size of the growing node. */
  toggleSize?: () => void;
}
