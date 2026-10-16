// Ported from xyflow (MIT) packages/react/src/hooks/useGlobalKeyHandler.ts, packages/react/src/container/FlowRenderer/index.tsx, packages/svelte/src/lib/components/KeyHandler/KeyHandler.svelte@3d35b57
import type { ReactiveController } from 'lit';
import { KeyCodeWatcher, keyboardTracker } from '@xy-lit/store';
import { isInputDOMNode } from '@xy-lit/store/internal';
import type { XyFlowElement } from '../xy-flow.js';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);

/** Flows currently listening to the keyboard (a lone flow acts on the delete key without focus). */
const attached = new Set<XyFlowElement>();

type KeyFlag =
  | 'selectionKeyPressed'
  | 'multiSelectionActive'
  | 'panActivationKeyPressed'
  | 'zoomActivationKeyPressed';

/**
 * Translates the page-wide keyboard state (one `KeyboardTracker` per page) into the flow's key
 * flags (selection, multi-selection, pan and zoom activation), deletes the selection on the
 * delete key, and binds undo/redo to the store's history.
 *
 * Only the **active flow** (the one that has focus, else the one that most recently received a
 * pointer press) reacts to the delete and undo/redo keys; every flow follows the key flags.
 */
export class FlowKeysController implements ReactiveController {
  readonly #selection: KeyCodeWatcher;
  readonly #multiSelection: KeyCodeWatcher;
  readonly #panActivation: KeyCodeWatcher;
  readonly #zoomActivation: KeyCodeWatcher;
  readonly #delete: KeyCodeWatcher;
  #unsubscribe: (() => void) | null = null;
  #unsubscribeReset: (() => void) | null = null;
  /** A Ctrl, Meta or Shift modifier was held for the key event being handled. */
  #modifier = false;

  constructor(protected readonly host: XyFlowElement) {
    this.#selection = new KeyCodeWatcher(null, (v) => {
      this.#setFlag('selectionKeyPressed', v);
    });
    this.#multiSelection = new KeyCodeWatcher(null, (v) => {
      this.#setFlag('multiSelectionActive', v);
    });
    this.#panActivation = new KeyCodeWatcher(null, (v) => {
      this.#setFlag('panActivationKeyPressed', v);
    });
    this.#zoomActivation = new KeyCodeWatcher(null, (v) => {
      this.#setFlag('zoomActivationKeyPressed', v);
    });
    this.#delete = new KeyCodeWatcher(
      null,
      (active) => {
        if (active) this.#deleteSelection();
      },
      { actInsideInputWithModifier: false },
    );
    host.addController(this);
  }

  hostConnected(): void {
    attached.add(this.host);
    this.update();
    this.#unsubscribe ??= keyboardTracker.subscribe((event, type) => {
      this.#onKey(event, type);
    });
    this.#unsubscribeReset ??= keyboardTracker.onReset(() => {
      this.#reset();
    });
  }

  hostDisconnected(): void {
    attached.delete(this.host);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#unsubscribeReset?.();
    this.#unsubscribeReset = null;
    for (const watcher of this.#watchers()) watcher.reset();
    if (keyboardTracker.activeFlow === this.host) keyboardTracker.activeFlow = null;
  }

  /** Re-read the key properties of the host (called when any `*-key` property changed). */
  update(): void {
    const { host } = this;
    this.#selection.setKeyCode(host.selectionKey);
    this.#multiSelection.setKeyCode(host.multiSelectionKey);
    this.#panActivation.setKeyCode(host.panActivationKey);
    this.#zoomActivation.setKeyCode(host.zoomActivationKey);
    this.#delete.setKeyCode(host.deleteKey);
  }

  #watchers(): KeyCodeWatcher[] {
    return [
      this.#selection,
      this.#multiSelection,
      this.#panActivation,
      this.#zoomActivation,
      this.#delete,
    ];
  }

  #onKey(event: KeyboardEvent, type: 'down' | 'up'): void {
    this.#modifier = event.ctrlKey || event.metaKey || event.shiftKey;
    for (const watcher of this.#watchers()) watcher.handle(event, type);
    if (type === 'down') this.#undoRedo(event);
  }

  #setFlag(flag: KeyFlag, value: boolean): void {
    const { host } = this;
    if (!host.hasStore) return;
    const { store } = host;
    if (store.getState()[flag] !== value) {
      store.setState({ [flag]: value });
    }
    // the engine reads the flags right away: a drag may start before Lit re-renders
    host.panZoomCtl.update();
  }

  /** Whether this flow receives delete and undo/redo keys right now. */
  #isActive(): boolean {
    const active = keyboardTracker.activeFlow;
    if (active !== null) return active === this.host;
    // nothing was pressed or focused yet: a lone flow is the obvious target
    return attached.size === 1 && attached.has(this.host);
  }

  #deleteSelection(): void {
    const { host } = this;
    if (!host.hasStore || this.#modifier || !this.#isActive()) return;
    const { nodes, edges } = host.store.getState();
    void host.deleteElements({
      nodes: nodes.filter((n) => n.selected),
      edges: edges.filter((e) => e.selected),
    });
    host.store.setState({ nodesSelectionActive: false });
  }

  #undoRedo(event: KeyboardEvent): void {
    const { host } = this;
    if (!host.hasStore || host.historyKeys === 'off') return;
    const history = host.store.history;
    if (!history || !this.#isActive() || isInputDOMNode(event)) return;
    const mod = MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (!mod || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      history.undo();
    } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
      event.preventDefault();
      history.redo();
    }
  }

  #reset(): void {
    const { host } = this;
    for (const watcher of this.#watchers()) watcher.reset();
    if (!host.hasStore) return;
    const s = host.store.getState();
    if (
      s.selectionKeyPressed ||
      s.multiSelectionActive ||
      s.panActivationKeyPressed ||
      s.zoomActivationKeyPressed ||
      s.userSelectionRect
    ) {
      host.store.setState({
        selectionKeyPressed: false,
        multiSelectionActive: false,
        panActivationKeyPressed: false,
        zoomActivationKeyPressed: false,
        userSelectionRect: null,
      });
    }
    host.panZoomCtl.update();
  }
}
