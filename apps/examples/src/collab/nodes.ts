import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { Directive, directive, PartType } from 'lit/directive.js';
import type { PartInfo, ElementPart, PropertyPart } from 'lit/directive.js';
import { noChange } from 'lit';
import { defineNodeType, Position } from '@xy-lit/flow';
import type { Node, NodeProps } from '@xy-lit/flow';
import { SWATCHES } from './seed';

export const EMOJIS = ['🚀', '🎨', '🛠️', '📣', '📚', '💡', '🧪', '🔥', '🌱', '🎯', '🧭', '⭐'];

export const swatchOf = (id: unknown): (typeof SWATCHES)[number] =>
  SWATCHES.find((s) => s.id === id) ?? SWATCHES[0];

/**
 * `.value` binding for text fields that other people edit while you type: when the value changes
 * under the caret, the caret keeps its place relative to the surrounding text instead of jumping
 * to the end (what plain `live()` would do).
 */
class TextSyncDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.PROPERTY || partInfo.name !== 'value') {
      throw new Error('textSync() only works on a .value binding');
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Lit's directive contract: render() declares the argument type
  render(_value: string): unknown {
    return noChange;
  }
  override update(part: PropertyPart | ElementPart, [value]: [string]): unknown {
    const el = (part as PropertyPart).element as HTMLInputElement | HTMLTextAreaElement;
    const next = value ?? '';
    const prev = el.value;
    if (prev === next) return noChange;
    const focused =
      el.getRootNode() instanceof ShadowRoot
        ? (el.getRootNode() as ShadowRoot).activeElement === el
        : document.activeElement === el;
    if (!focused) {
      el.value = next;
      return noChange;
    }
    // map the caret through the edit: common prefix and suffix stay, the middle was replaced
    let start = 0;
    const max = Math.min(prev.length, next.length);
    while (start < max && prev[start] === next[start]) start++;
    let endPrev = prev.length;
    let endNext = next.length;
    while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
      endPrev--;
      endNext--;
    }
    const delta = next.length - prev.length;
    const map = (pos: number): number => {
      if (pos <= start) return pos;
      if (pos >= endPrev) return pos + delta;
      return endNext; // inside the replaced part: after the new text
    };
    const selStart = el.selectionStart ?? prev.length;
    const selEnd = el.selectionEnd ?? prev.length;
    el.value = next;
    el.setSelectionRange(map(selStart), map(selEnd));
    return noChange;
  }
}
export const textSync = directive(TextSyncDirective);

const stop = (e: Event): void => e.stopPropagation();

/**
 * Titles are read-only until you double-click (or press Enter on them), so the whole card can be
 * grabbed and dragged by its title; while editing the field is `nodrag`.
 */
export function startEdit(input: HTMLInputElement | null | undefined): void {
  if (!input) return;
  input.readOnly = false;
  input.classList.add('nodrag');
  input.focus();
  input.select();
}
const endEdit = (input: HTMLInputElement): void => {
  input.readOnly = true;
  input.classList.remove('nodrag');
  input.setSelectionRange(0, 0);
};
const titleKeys = (e: KeyboardEvent): void => {
  const input = e.target as HTMLInputElement;
  e.stopPropagation();
  if (input.readOnly) {
    if (e.key === 'Enter') startEdit(input);
  } else if (e.key === 'Enter' || e.key === 'Escape') input.blur();
};

type IdeaData = { label?: string; emoji?: string; color?: string };
type NoteData = { title?: string; body?: string; color?: string };

const styleVars = (color: unknown): string => {
  const s = swatchOf(color);
  return `--accent:${s.accent};--tint:${s.tint};--tint-dark:${s.dark}`;
};

export const ideaNode = defineNodeType<Node<IdeaData>>({
  styles: css`
    .xyc-idea {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 190px;
      padding: 8px 14px 8px 8px;
      border-radius: 16px;
      background: var(--xyc-surface);
      color: var(--xyc-fg);
      box-shadow:
        0 0 0 1px var(--xyc-line),
        0 1px 2px rgba(15, 23, 42, 0.06),
        0 8px 24px -8px rgba(15, 23, 42, 0.18);
      transition:
        box-shadow 0.15s ease,
        transform 0.15s ease;
      font-family: var(--xyc-font);
    }
    .lit-flow__node:hover .xyc-idea {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--accent) 45%, var(--xyc-line)),
        0 2px 4px rgba(15, 23, 42, 0.08),
        0 12px 28px -8px rgba(15, 23, 42, 0.24);
    }
    .lit-flow__node.selected .xyc-idea {
      box-shadow:
        0 0 0 2px var(--accent),
        0 12px 28px -8px color-mix(in srgb, var(--accent) 45%, transparent);
    }
    .lit-flow__node.dragging .xyc-idea {
      transform: scale(1.03);
    }
    /* another user's selection / drag: ring the card itself (the host has no rounded corners) */
    .lit-flow__node.remote-selected:has(.xyc-idea, .xyc-note),
    .lit-flow__node.remote-dragging:has(.xyc-idea, .xyc-note) {
      outline: none;
    }
    .lit-flow__node.remote-selected .xyc-idea,
    .lit-flow__node.remote-selected .xyc-note,
    .lit-flow__node.remote-dragging .xyc-idea,
    .lit-flow__node.remote-dragging .xyc-note {
      box-shadow:
        0 0 0 2px var(--xy-remote-color),
        0 12px 28px -8px color-mix(in srgb, var(--xy-remote-color) 50%, transparent);
    }
    .lit-flow__node.remote-dragging .xyc-idea,
    .lit-flow__node.remote-dragging .xyc-note {
      transform: scale(1.03);
    }
    .xyc-idea .emoji {
      all: unset;
      display: grid;
      place-items: center;
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: var(--tint);
      font-size: 19px;
      cursor: pointer;
      transition: transform 0.12s ease;
    }
    .xyc-idea .emoji:hover {
      transform: rotate(-8deg) scale(1.08);
    }
    .xyc-idea input {
      all: unset;
      flex: 1;
      min-width: 0;
      font: 600 15px/1.3 var(--xyc-font);
      letter-spacing: -0.01em;
      color: inherit;
      cursor: text;
    }
    .xyc-idea input[readonly],
    .xyc-note header input[readonly] {
      pointer-events: none;
      cursor: inherit;
    }
    .xyc-idea input::placeholder {
      color: var(--xyc-muted);
    }
    .xyc-card-handle {
      width: 11px;
      height: 11px;
      min-width: 0;
      min-height: 0;
      background: var(--accent);
      border: 2px solid var(--xyc-surface);
      box-shadow: 0 0 0 1px var(--accent);
      transition: transform 0.12s ease;
    }
    .xyc-card-handle:hover {
      transform: translate(var(--tx, 0), var(--ty, 0)) scale(1.35);
    }
    .lit-flow.dark .xyc-idea .emoji {
      background: var(--tint-dark);
    }
  `,
  render: ({ id, data }: NodeProps<Node<IdeaData>>, flow) => {
    const emoji = data.emoji ?? '💡';
    return html`<div
      class="xyc-idea"
      style=${styleVars(data.color)}
      @dblclick=${(e: MouseEvent) => {
        if (!(e.target as Element).closest('.emoji')) {
          startEdit((e.currentTarget as HTMLElement).querySelector('input'));
        }
      }}
    >
      <xy-handle
        class="xyc-card-handle"
        type="source"
        position=${Position.Left}
        handle-id="l"
      ></xy-handle>
      <button
        class="emoji nodrag"
        type="button"
        title="Change icon"
        @click=${() =>
          flow.updateNodeData(id, {
            emoji: EMOJIS[(EMOJIS.indexOf(emoji) + 1) % EMOJIS.length],
          })}
      >
        ${emoji}
      </button>
      <input
        readonly
        data-testid="idea-label"
        aria-label="Idea (double-click to edit)"
        placeholder="Name this idea"
        spellcheck="false"
        .value=${textSync(data.label ?? '')}
        @input=${(e: InputEvent) =>
          flow.updateNodeData(id, { label: (e.target as HTMLInputElement).value })}
        @blur=${(e: FocusEvent) => endEdit(e.target as HTMLInputElement)}
        @keydown=${titleKeys}
      />
      <xy-handle
        class="xyc-card-handle"
        type="source"
        position=${Position.Right}
        handle-id="r"
      ></xy-handle>
    </div>`;
  },
});

export const noteNode = defineNodeType<Node<NoteData>>({
  styles: css`
    .xyc-note {
      width: 270px;
      border-radius: 14px;
      overflow: hidden;
      background: var(--xyc-surface);
      color: var(--xyc-fg);
      box-shadow:
        0 0 0 1px var(--xyc-line),
        0 1px 2px rgba(15, 23, 42, 0.06),
        0 8px 24px -8px rgba(15, 23, 42, 0.18);
      font-family: var(--xyc-font);
      transition: box-shadow 0.15s ease;
    }
    .lit-flow__node.selected .xyc-note {
      box-shadow:
        0 0 0 2px var(--accent),
        0 12px 28px -8px color-mix(in srgb, var(--accent) 45%, transparent);
    }
    .xyc-note header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--tint);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    }
    .lit-flow.dark .xyc-note header {
      background: var(--tint-dark);
    }
    .xyc-note header i {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
    }
    .xyc-note header input {
      all: unset;
      flex: 1;
      min-width: 0;
      font: 700 12px/1.2 var(--xyc-font);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--accent) 70%, var(--xyc-fg));
    }
    .xyc-note textarea {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      min-height: 140px;
      padding: 12px 14px 14px;
      font: 400 13.5px/1.5 var(--xyc-font);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      resize: none;
      cursor: text;
    }
  `,
  render: ({ id, data }: NodeProps<Node<NoteData>>, flow) => {
    return html`<div class="xyc-note" style=${styleVars(data.color)}>
      <xy-handle
        class="xyc-card-handle"
        type="source"
        position=${Position.Left}
        handle-id="l"
      ></xy-handle>
      <header
        @dblclick=${(e: MouseEvent) =>
          startEdit((e.currentTarget as HTMLElement).querySelector('input'))}
      >
        <i></i>
        <input
          readonly
          data-testid="note-title"
          aria-label="Note title (double-click to edit)"
          placeholder="Title"
          spellcheck="false"
          .value=${textSync(data.title ?? '')}
          @input=${(e: InputEvent) =>
            flow.updateNodeData(id, { title: (e.target as HTMLInputElement).value })}
          @blur=${(e: FocusEvent) => endEdit(e.target as HTMLInputElement)}
          @keydown=${titleKeys}
        />
      </header>
      <textarea
        class="nodrag nowheel"
        data-testid="note-body"
        aria-label="Note"
        placeholder="Write something. Everyone can type here at once."
        .value=${textSync(data.body ?? '')}
        @input=${(e: InputEvent) =>
          flow.updateNodeData(id, { body: (e.target as HTMLTextAreaElement).value })}
        @keydown=${stop}
      ></textarea>
      <xy-handle
        class="xyc-card-handle"
        type="source"
        position=${Position.Right}
        handle-id="r"
      ></xy-handle>
    </div>`;
  },
});

export const nodeTypes = { idea: ideaNode, note: noteNode };
export type { TemplateResult };
