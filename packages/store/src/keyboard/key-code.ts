// Ported from xyflow (MIT) packages/react/src/hooks/useKeyPress.ts@3d35b57
import { isInputDOMNode } from '../engine.js';
import type { KeyCode } from '../types/options.js';

/**
 * Parse a key code into combinations.
 *
 * - A string is one combination; `+` separates the keys of a combination (`'Meta+s'`).
 * - An array lists alternatives (`['a', 'd+s']` = `a`, or `d` and `s` together).
 * - `'key++'` is supported (the key `+` pressed with `key`).
 * - `null` and non-string entries yield no combination.
 *
 * @param keyCode - Key code as accepted by the `*-key` attributes.
 * @returns Combinations, each a list of key names (`event.key` or `event.code` values).
 * @example
 * parseKeyCode(['Meta+s', 'Shift']); // [['Meta', 's'], ['Shift']]
 */
export function parseKeyCode(keyCode: KeyCode | null): string[][] {
  if (keyCode === null) return [];
  const keyCodeArr = Array.isArray(keyCode) ? keyCode : [keyCode];
  return (
    keyCodeArr
      .filter((kc) => typeof kc === 'string')
      /*
       * we first replace all '+' with '\n'  which we will use to split the keys on
       * then we replace '\n\n' with '\n+', this way we can also support the combination 'key++'
       * in the end we simply split on '\n' to get the key array
       */
      .map((kc) => kc.replace(/\+/g, '\n').replace('\n\n', '\n+').split('\n'))
  );
}

/** Tag the key event fields we read, so tests can pass plain objects. */
export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code'>;

/**
 * The set of keys currently held, with the matching logic of React Flow's `useKeyPress`.
 *
 * Each pressed key is remembered by both `event.key` and `event.code`, so combinations can be
 * written with either (`'Shift'` or `'ShiftLeft'`). Where React stores one of the two depending on
 * the watched keys, this stores both and matches a combination key against either.
 */
export class PressedKeys {
  /** Pressed keys by `event.code` (falls back to `key` when the code is empty). */
  private readonly pressed = new Map<string, string>();

  /** Number of physical keys currently held. */
  get size(): number {
    return this.pressed.size;
  }

  /** Record a keydown. */
  add(e: KeyEventLike): void {
    this.pressed.set(e.code || e.key, e.key);
  }

  /**
   * Record a keyup. Mac fix: while Cmd is held, keyup is not fired for other keys, so releasing
   * `Meta` clears everything.
   */
  remove(e: KeyEventLike): void {
    this.pressed.delete(e.code || e.key);
    if (e.key === 'Meta') this.pressed.clear();
  }

  /** Forget all pressed keys (window blur, context menu). */
  clear(): void {
    this.pressed.clear();
  }

  /** Whether a combination key is currently held, by `key` or by `code`. */
  has(name: string): boolean {
    if (this.pressed.has(name)) return true;
    for (const key of this.pressed.values()) if (key === name) return true;
    return false;
  }

  /**
   * Whether any combination is held.
   *
   * @param combos - Combinations from {@link parseKeyCode}.
   * @param isUp - When false (keydown), a combination only matches if exactly its keys are held
   * (so `'Meta'` does not match while `Meta+r` is held). When true (keyup) extra keys are
   * allowed, so releasing a key of a held combination is recognised.
   */
  matches(combos: string[][], isUp = false): boolean {
    return (
      combos
        /*
         * we only want to compare same sizes of keyCode definitions
         * and pressed keys. When the user specified 'Meta' as a key somewhere
         * this would also be truthy without this filter when user presses 'Meta' + 'r'
         */
        .filter((keys) => isUp || keys.length === this.pressed.size)
        /*
         * since we want to support multiple possibilities only one of the
         * combinations need to be part of the pressed keys
         */
        .some((keys) => keys.every((k) => this.has(k)))
    );
  }
}

/** Options of {@link KeyCodeWatcher}. */
export type KeyCodeWatcherOptions = {
  /**
   * Whether combinations that include a modifier also work while an input field is focused.
   * Plain keys never act inside inputs. Default true.
   */
  actInsideInputWithModifier?: boolean;
  /** Prevent the default action of a matching keydown (not on buttons/links without modifier). Default true. */
  preventDefault?: boolean;
};

/**
 * One watched key code with React's `useKeyPress` semantics: its own pressed-key set, sticky
 * state (set on a matching keydown, cleared on a keyup that releases part of the held
 * combination), input-field guard and `preventDefault` rule.
 *
 * Feed it from the shared keyboard tracker: `tracker.subscribe((e, type) => watcher.handle(e, type))`
 * and `tracker.onReset(() => watcher.reset())`.
 */
export class KeyCodeWatcher {
  private combos: string[][] = [];
  private readonly pressed = new PressedKeys();
  private modifierPressed = false;
  private _active = false;

  /**
   * @param keyCode - Key code to watch; `null` watches nothing.
   * @param onChange - Called when {@link active} flips.
   * @param options - See {@link KeyCodeWatcherOptions}.
   */
  constructor(
    keyCode: KeyCode | null,
    private readonly onChange: (active: boolean) => void,
    private readonly options: KeyCodeWatcherOptions = {},
  ) {
    this.setKeyCode(keyCode);
  }

  /** Whether the watched key code is currently pressed. */
  get active(): boolean {
    return this._active;
  }

  /**
   * Change the watched key code. Resets the pressed state.
   *
   * @param keyCode - New key code.
   */
  setKeyCode(keyCode: KeyCode | null): void {
    this.combos = parseKeyCode(keyCode);
    this.reset();
  }

  /**
   * Handle a keydown or keyup.
   *
   * @param event - The keyboard event.
   * @param type - `'down'` or `'up'`.
   */
  handle(event: KeyboardEvent, type: 'down' | 'up'): void {
    if (type === 'down') this.down(event);
    else this.up(event);
  }

  /** Clear everything (window blur, context menu). */
  reset(): void {
    this.pressed.clear();
    this.set(false);
  }

  private set(active: boolean): void {
    if (this._active === active) return;
    this._active = active;
    this.onChange(active);
  }

  private down(event: KeyboardEvent): void {
    if (this.combos.length === 0) return;
    const actInsideInputWithModifier = this.options.actInsideInputWithModifier ?? true;
    this.modifierPressed = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    const preventAction =
      (!this.modifierPressed || (this.modifierPressed && !actInsideInputWithModifier)) &&
      isInputDOMNode(event);

    if (preventAction) return;

    this.pressed.add(event);

    if (this.pressed.matches(this.combos, false)) {
      const target = (event.composedPath?.()?.[0] || event.target) as Element | null;
      const isInteractiveElement = target?.nodeName === 'BUTTON' || target?.nodeName === 'A';

      if (
        this.options.preventDefault !== false &&
        (this.modifierPressed || !isInteractiveElement)
      ) {
        event.preventDefault();
      }

      this.set(true);
    }
  }

  private up(event: KeyboardEvent): void {
    if (this.combos.length === 0) return;
    if (this.pressed.matches(this.combos, true)) {
      this.set(false);
      this.pressed.clear();
    } else {
      this.pressed.remove(event);
    }

    // fix for Mac: when cmd key is pressed, keyup is not triggered for any other key
    if (event.key === 'Meta') {
      this.pressed.clear();
    }

    this.modifierPressed = false;
  }
}
