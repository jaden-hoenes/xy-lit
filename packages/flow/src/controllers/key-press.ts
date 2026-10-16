// Ported from xyflow (MIT) packages/react/src/hooks/useKeyPress.ts@3d35b57
import type { ReactiveController } from 'lit';
import { KeyCodeWatcher, keyboardTracker } from '@xy-lit/store';
import type { KeyCode } from '@xy-lit/store';
import type { ControllerHost } from './flow-controllers.js';

/** Options of {@link KeyPressController}. */
export type KeyPressOptions = {
  /** Listen on this element instead of the page-wide shared tracker. */
  target?: HTMLElement;
  /** Combinations with a modifier also work while an input is focused. Default true. */
  actInsideInputWithModifier?: boolean;
  /** Prevent the default action of a matching keydown. Default true. */
  preventDefault?: boolean;
};

/**
 * Whether a key (or combination such as `'Control+s'` or `['a', 'b']`) is pressed (React
 * `useKeyPress`). Uses the page's shared `KeyboardTracker`, or listens on `target` while the host
 * is connected. The host updates when the state flips.
 */
export class KeyPressController implements ReactiveController {
  readonly #watcher: KeyCodeWatcher;
  readonly #options: KeyPressOptions;
  #unsubscribe: (() => void) | null = null;
  #unsubscribeReset: (() => void) | null = null;
  #targetListeners: [string, EventListener][] = [];

  constructor(
    private readonly host: ControllerHost,
    keyCode: KeyCode | null,
    options: KeyPressOptions = {},
  ) {
    this.#options = options;
    this.#watcher = new KeyCodeWatcher(
      keyCode,
      () => {
        host.requestUpdate();
      },
      options,
    );
    host.addController(this);
  }

  /** True while the key is pressed. */
  get value(): boolean {
    return this.#watcher.active;
  }

  /**
   * Watch another key code (resets the pressed state).
   *
   * @param keyCode - The new key code.
   */
  setKeyCode(keyCode: KeyCode | null): void {
    const was = this.#watcher.active;
    this.#watcher.setKeyCode(keyCode);
    if (was) this.host.requestUpdate();
  }

  hostConnected(): void {
    const target = this.#options.target;
    if (target) {
      const down: EventListener = (e) => {
        this.#watcher.handle(e as KeyboardEvent, 'down');
      };
      const up: EventListener = (e) => {
        this.#watcher.handle(e as KeyboardEvent, 'up');
      };
      const reset: EventListener = () => {
        this.#watcher.reset();
      };
      this.#targetListeners = [
        ['keydown', down],
        ['keyup', up],
        ['blur', reset],
      ];
      for (const [type, fn] of this.#targetListeners) target.addEventListener(type, fn);
      return;
    }
    this.#unsubscribe ??= keyboardTracker.subscribe((event, type) => {
      this.#watcher.handle(event, type);
    });
    this.#unsubscribeReset ??= keyboardTracker.onReset(() => {
      this.#watcher.reset();
    });
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#unsubscribeReset?.();
    this.#unsubscribeReset = null;
    const target = this.#options.target;
    if (target)
      for (const [type, fn] of this.#targetListeners) target.removeEventListener(type, fn);
    this.#targetListeners = [];
    this.#watcher.reset();
  }
}
