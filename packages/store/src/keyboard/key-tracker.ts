import { isInputDOMNode } from '../engine.js';
import { PressedKeys } from './key-code.js';

type KeyListener = (e: KeyboardEvent, type: 'down' | 'up') => void;

/** The page-wide keyboard tracker. See {@link keyboardTracker}. */
export interface KeyboardTracker {
  /**
   * Be told about every keydown/keyup on the page. Starts listening on the first subscriber.
   * Key events typed inside input fields without a modifier are not forwarded.
   *
   * @returns Unsubscribe; the window listeners are removed when the last subscriber leaves.
   */
  subscribe(listener: KeyListener): () => void;
  /** Be told when the page loses focus or a context menu opens (all keys should be released). */
  onReset(listener: () => void): () => void;
  /** Keys currently held (shared state; cleared on reset). */
  readonly pressed: PressedKeys;
  /** The flow that currently receives key commands (set by flows on pointerdown/focusin). */
  activeFlow: object | null;
}

/**
 * One tracker per page (a module singleton, created lazily on first subscription): the only
 * place with persistent `window` key listeners. Flows translate key state into store flags in
 * `FlowKeysController`, typically through `KeyCodeWatcher`.
 */
class Tracker implements KeyboardTracker {
  readonly pressed = new PressedKeys();
  activeFlow: object | null = null;

  private readonly listeners = new Set<KeyListener>();
  private readonly resetListeners = new Set<() => void>();
  private attached = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const modifier = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;
    // typing in an input is not a key command (unless a modifier is held)
    if (!modifier && isInputDOMNode(e)) return;
    this.pressed.add(e);
    this.emit(e, 'down');
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.remove(e);
    this.emit(e, 'up');
  };

  private readonly handleReset = (): void => {
    this.pressed.clear();
    for (const listener of [...this.resetListeners]) listener();
  };

  subscribe(listener: KeyListener): () => void {
    this.listeners.add(listener);
    this.attach();
    return () => {
      this.listeners.delete(listener);
      this.detachIfIdle();
    };
  }

  onReset(listener: () => void): () => void {
    this.resetListeners.add(listener);
    this.attach();
    return () => {
      this.resetListeners.delete(listener);
      this.detachIfIdle();
    };
  }

  private emit(e: KeyboardEvent, type: 'down' | 'up'): void {
    for (const listener of [...this.listeners]) listener(e, type);
  }

  private attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.handleReset);
    window.addEventListener('contextmenu', this.handleReset);
  }

  private detachIfIdle(): void {
    if (!this.attached || this.listeners.size > 0 || this.resetListeners.size > 0) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.handleReset);
    window.removeEventListener('contextmenu', this.handleReset);
    this.pressed.clear();
  }
}

/** The page-wide keyboard tracker (module singleton). */
export const keyboardTracker: KeyboardTracker = new Tracker();
