import { DOCS_URL, LIB_NAME } from './constants.js';

/**
 * True outside production builds. Bundlers replace `process.env.NODE_ENV`; without a bundler (or
 * without `process`) the answer is `true`, so warnings are never silently lost in development.
 */
export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}

/**
 * Print a development-only warning in the form `[XY Lit]: message (code) Help: <docs>/guide/lifecycle#errors-and-warnings`.
 * The default action of the cancelable `flow-error` event.
 *
 * @param code - Error code (upstream codes such as `'008'`, or `XYL..` codes).
 * @param message - Human readable message.
 */
export function devWarn(code: string, message: string): void {
  if (isDev()) {
    console.warn(`[${LIB_NAME}]: ${message} (code ${code}) Help: ${DOCS_URL}/guide/lifecycle#errors-and-warnings`);
  }
}
