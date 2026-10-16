import type * as Y from 'yjs';
import { SERVER, healDoc } from '@xy-lit/collab-yjs/server';
import type { RepairIssue } from '@xy-lit/collab-yjs/server';

/** The slice of Hocuspocus' `onChange` payload the hook needs. */
export type ChangePayload = { documentName: string; document: Y.Doc };

/**
 * Debounced server-side validation (spec/11 §Server entry): 2 s after the last change of a
 * document, run the shared `orderAndRepair` validator and write the fixes with origin `'server'`.
 * The writes trigger `onChange` again; the next run finds nothing to fix, so it settles.
 *
 * @param options.delayMs - Debounce (default 2000, env `HEAL_DEBOUNCE_MS` in `server.ts`).
 * @param options.onHealed - Called with the issues that were fixed (logging).
 */
export function createRepairHook(
  options: {
    delayMs?: number;
    onHealed?: (documentName: string, fixed: RepairIssue[]) => void;
  } = {},
) {
  const delay = options.delayMs ?? 2000;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const run = (documentName: string, document: Y.Doc): void => {
    timers.delete(documentName);
    const fixed = healDoc(document, SERVER);
    if (fixed.length) options.onHealed?.(documentName, fixed);
  };

  return {
    /** Hocuspocus `onChange`. */
    onChange({ documentName, document }: ChangePayload): Promise<void> {
      const pending = timers.get(documentName);
      if (pending) clearTimeout(pending);
      timers.set(
        documentName,
        setTimeout(() => run(documentName, document), delay),
      );
      return Promise.resolve();
    },
    /** Hocuspocus `afterUnloadDocument`: a document that is gone needs no repair. */
    forget(documentName: string): void {
      const pending = timers.get(documentName);
      if (pending) clearTimeout(pending);
      timers.delete(documentName);
    },
    /** Cancel every pending run. */
    destroy(): void {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
