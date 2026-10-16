import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyCodeWatcher, PressedKeys, parseKeyCode } from '../src/keyboard/key-code.js';
import { keyboardTracker } from '../src/keyboard/key-tracker.js';

type Mods = { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean };
type Target = { nodeName: string; nodeType: 1; hasAttribute: () => boolean; closest: () => null };

const target = (nodeName = 'DIV'): Target => ({
  nodeName,
  nodeType: 1,
  hasAttribute: () => false,
  closest: () => null,
});

function key(k: string, code = k, mods: Mods = {}, el: Target = target()) {
  const event = {
    key: k,
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
    target: el,
    composedPath: () => [el],
    preventDefault: vi.fn(),
  };
  return event as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe('parseKeyCode', () => {
  it('parses single keys, combinations and alternatives', () => {
    expect(parseKeyCode('a')).toEqual([['a']]);
    expect(parseKeyCode('Meta+s')).toEqual([['Meta', 's']]);
    expect(parseKeyCode(['a', 'd+s'])).toEqual([['a'], ['d', 's']]);
    expect(parseKeyCode(['Meta', 's'])).toEqual([['Meta'], ['s']]);
  });

  it('supports the plus key as part of a combination', () => {
    expect(parseKeyCode('Control++')).toEqual([['Control', '+']]);
  });

  it('returns nothing for null and ignores non-strings', () => {
    expect(parseKeyCode(null)).toEqual([]);
    expect(parseKeyCode([1 as unknown as string, 'a'])).toEqual([['a']]);
  });
});

describe('PressedKeys', () => {
  it('matches by key or by code', () => {
    const pressed = new PressedKeys();
    pressed.add(key('Shift', 'ShiftLeft'));
    expect(pressed.matches([['Shift']])).toBe(true);
    expect(pressed.matches([['ShiftLeft']])).toBe(true);
    expect(pressed.matches([['ShiftRight']])).toBe(false);
    expect(pressed.matches([['Control']])).toBe(false);
    expect(pressed.matches([])).toBe(false);
  });

  it('on keydown only matches combinations of the same size as the pressed set', () => {
    const pressed = new PressedKeys();
    pressed.add(key('Meta', 'MetaLeft'));
    pressed.add(key('r', 'KeyR'));
    expect(pressed.matches([['Meta']])).toBe(false);
    expect(pressed.matches([['Meta', 'r']])).toBe(true);
    expect(pressed.matches([['Meta'], ['Meta', 'r']])).toBe(true);
    // on keyup extra keys are allowed
    expect(pressed.matches([['Meta']], true)).toBe(true);
  });

  it('tracks several alternatives', () => {
    const pressed = new PressedKeys();
    pressed.add(key('d'));
    expect(pressed.matches([['a'], ['d', 's']])).toBe(false);
    pressed.add(key('s'));
    expect(pressed.matches([['a'], ['d', 's']])).toBe(true);
    expect(pressed.size).toBe(2);
  });

  it('remove forgets the key; releasing Meta clears everything (macOS)', () => {
    const pressed = new PressedKeys();
    pressed.add(key('Meta', 'MetaLeft'));
    pressed.add(key('s', 'KeyS'));
    pressed.remove(key('s', 'KeyS'));
    expect(pressed.matches([['Meta']])).toBe(true);
    pressed.add(key('s', 'KeyS'));
    pressed.remove(key('Meta', 'MetaLeft'));
    expect(pressed.size).toBe(0);
  });

  it('clear forgets all keys', () => {
    const pressed = new PressedKeys();
    pressed.add(key('a'));
    pressed.clear();
    expect(pressed.matches([['a']])).toBe(false);
  });
});

describe('KeyCodeWatcher', () => {
  const setup = (code: Parameters<typeof parseKeyCode>[0], options = {}) => {
    const changes: boolean[] = [];
    const watcher = new KeyCodeWatcher(code, (a) => changes.push(a), options);
    return { watcher, changes };
  };

  it('is active between keydown and keyup of a single key', () => {
    const { watcher, changes } = setup('Shift');
    watcher.handle(key('Shift', 'ShiftLeft', { shiftKey: true }), 'down');
    expect(watcher.active).toBe(true);
    watcher.handle(key('Shift', 'ShiftLeft'), 'up');
    expect(watcher.active).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('does not fire change events when nothing flips', () => {
    const { watcher, changes } = setup('Shift');
    watcher.handle(key('Shift', 'ShiftLeft', { shiftKey: true }), 'down');
    watcher.handle(key('Shift', 'ShiftLeft', { shiftKey: true }), 'down'); // key repeat
    expect(changes).toEqual([true]);
  });

  it('needs the whole combination', () => {
    const { watcher } = setup('Meta+s');
    watcher.handle(key('Meta', 'MetaLeft', { metaKey: true }), 'down');
    expect(watcher.active).toBe(false);
    watcher.handle(key('s', 'KeyS', { metaKey: true }), 'down');
    expect(watcher.active).toBe(true);
  });

  it('macOS quirk: releasing Meta ends the combination although keyup of the other key never comes', () => {
    const { watcher, changes } = setup('Meta+s');
    watcher.handle(key('Meta', 'MetaLeft', { metaKey: true }), 'down');
    watcher.handle(key('s', 'KeyS', { metaKey: true }), 'down');
    watcher.handle(key('Meta', 'MetaLeft'), 'up');
    expect(watcher.active).toBe(false);
    expect(changes).toEqual([true, false]);
    // the stale "s" was cleared too: pressing s alone does not trigger
    watcher.handle(key('s', 'KeyS'), 'down');
    expect(watcher.active).toBe(false);
  });

  it('accepts either key or code in the combination', () => {
    const { watcher } = setup('KeyA');
    watcher.handle(key('a', 'KeyA'), 'down');
    expect(watcher.active).toBe(true);
    const other = setup('a');
    other.watcher.handle(key('a', 'KeyA'), 'down');
    expect(other.watcher.active).toBe(true);
  });

  it('supports alternatives', () => {
    const { watcher } = setup(['Backspace', 'Delete']);
    watcher.handle(key('Delete'), 'down');
    expect(watcher.active).toBe(true);
    watcher.handle(key('Delete'), 'up');
    watcher.handle(key('Backspace'), 'down');
    expect(watcher.active).toBe(true);
  });

  it('is inert for null', () => {
    const { watcher, changes } = setup(null);
    watcher.handle(key('a'), 'down');
    expect(watcher.active).toBe(false);
    expect(changes).toEqual([]);
  });

  it('plain keys do not act inside input fields, modified keys do', () => {
    const { watcher } = setup('Backspace');
    watcher.handle(key('Backspace', 'Backspace', {}, target('INPUT')), 'down');
    expect(watcher.active).toBe(false);

    const withModifier = setup('Control+a');
    withModifier.watcher.handle(
      key('Control', 'ControlLeft', { ctrlKey: true }, target('TEXTAREA')),
      'down',
    );
    withModifier.watcher.handle(key('a', 'KeyA', { ctrlKey: true }, target('TEXTAREA')), 'down');
    expect(withModifier.watcher.active).toBe(true);

    const strict = setup('Control+a', { actInsideInputWithModifier: false });
    strict.watcher.handle(
      key('Control', 'ControlLeft', { ctrlKey: true }, target('INPUT')),
      'down',
    );
    strict.watcher.handle(key('a', 'KeyA', { ctrlKey: true }, target('INPUT')), 'down');
    expect(strict.watcher.active).toBe(false);
  });

  it('prevents default on a match, except on buttons and links without a modifier', () => {
    const { watcher } = setup('Space');
    const plain = key(' ', 'Space');
    watcher.handle(plain, 'down');
    expect(plain.preventDefault).toHaveBeenCalled();
    watcher.reset();

    const onButton = key(' ', 'Space', {}, target('BUTTON'));
    watcher.handle(onButton, 'down');
    expect(watcher.active).toBe(true);
    expect(onButton.preventDefault).not.toHaveBeenCalled();
    watcher.reset();

    const modified = setup('Meta+s');
    modified.watcher.handle(key('Meta', 'MetaLeft', { metaKey: true }), 'down');
    const combo = key('s', 'KeyS', { metaKey: true }, target('BUTTON'));
    modified.watcher.handle(combo, 'down');
    expect(combo.preventDefault).toHaveBeenCalled();

    const quiet = setup('Space', { preventDefault: false });
    const ev = key(' ', 'Space');
    quiet.watcher.handle(ev, 'down');
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it('reset clears the state (window blur)', () => {
    const { watcher, changes } = setup('Shift');
    watcher.handle(key('Shift', 'ShiftLeft', { shiftKey: true }), 'down');
    watcher.reset();
    expect(watcher.active).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('setKeyCode switches the watched key and resets', () => {
    const { watcher } = setup('Shift');
    watcher.handle(key('Shift', 'ShiftLeft', { shiftKey: true }), 'down');
    watcher.setKeyCode('Control');
    expect(watcher.active).toBe(false);
    watcher.handle(key('Control', 'ControlLeft', { ctrlKey: true }), 'down');
    expect(watcher.active).toBe(true);
  });
});

describe('keyboardTracker', () => {
  type Handler = (e: unknown) => void;
  const listeners = new Map<string, Set<Handler>>();
  const fakeWindow = {
    addEventListener: vi.fn((type: string, h: Handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(h);
    }),
    removeEventListener: vi.fn((type: string, h: Handler) => {
      listeners.get(type)?.delete(h);
    }),
  };
  const fire = (type: string, e?: unknown) => listeners.get(type)?.forEach((h) => h(e));
  const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);

  afterEach(() => {
    vi.unstubAllGlobals();
    listeners.clear();
    fakeWindow.addEventListener.mockClear();
    fakeWindow.removeEventListener.mockClear();
  });

  it('adds the window listeners on the first subscriber and removes them with the last', () => {
    vi.stubGlobal('window', fakeWindow);
    expect(count()).toBe(0);
    const off1 = keyboardTracker.subscribe(() => undefined);
    expect(count()).toBe(4);
    expect([...listeners.keys()].sort()).toEqual(['blur', 'contextmenu', 'keydown', 'keyup']);
    const off2 = keyboardTracker.onReset(() => undefined);
    expect(count()).toBe(4);
    off1();
    expect(count()).toBe(4);
    off2();
    expect(count()).toBe(0);
  });

  it('forwards keydown/keyup and keeps the shared pressed set', () => {
    vi.stubGlobal('window', fakeWindow);
    const seen: string[] = [];
    const off = keyboardTracker.subscribe((e, type) => seen.push(`${type}:${e.key}`));
    fire('keydown', key('Shift', 'ShiftLeft', { shiftKey: true }));
    expect(keyboardTracker.pressed.matches([['Shift']])).toBe(true);
    fire('keyup', key('Shift', 'ShiftLeft'));
    expect(keyboardTracker.pressed.size).toBe(0);
    expect(seen).toEqual(['down:Shift', 'up:Shift']);
    off();
  });

  it('does not forward plain keys typed in inputs', () => {
    vi.stubGlobal('window', fakeWindow);
    const seen: string[] = [];
    const off = keyboardTracker.subscribe((e) => seen.push(e.key));
    fire('keydown', key('a', 'KeyA', {}, target('INPUT')));
    fire('keydown', key('b', 'KeyB', { ctrlKey: true }, target('INPUT')));
    expect(seen).toEqual(['b']);
    off();
  });

  it('blur and contextmenu clear the keys and notify reset listeners', () => {
    vi.stubGlobal('window', fakeWindow);
    const reset = vi.fn();
    const offKeys = keyboardTracker.subscribe(() => undefined);
    const offReset = keyboardTracker.onReset(reset);
    fire('keydown', key('a'));
    fire('blur');
    expect(keyboardTracker.pressed.size).toBe(0);
    fire('keydown', key('a'));
    fire('contextmenu');
    expect(reset).toHaveBeenCalledTimes(2);
    expect(keyboardTracker.pressed.size).toBe(0);
    offKeys();
    offReset();
  });

  it('works without a window (Node)', () => {
    const off = keyboardTracker.subscribe(() => undefined);
    off();
    expect(keyboardTracker.activeFlow).toBeNull();
  });
});
