/**
 * Helpers shared by the demos. A demo module exports `mount(el)`; it fills `el` (the frame the
 * `<Demo>` component created, 100% wide with a fixed height) and returns an optional cleanup.
 */
import { render, type TemplateResult } from 'lit';
import type { XyFlowElement } from '@xy-lit/flow';

export type Mount = (el: HTMLElement) => void | (() => void) | Promise<void | (() => void)>;

/** Render a template into the frame; returns the cleanup that clears it. */
export function mountTemplate(el: HTMLElement, template: TemplateResult): () => void {
  render(template, el);
  return () => render(null, el);
}

/** The first flow inside `el`. */
export function flowOf(el: ParentNode): XyFlowElement {
  const flow = el.querySelector('xy-flow');
  if (!flow) throw new Error('the demo has no <xy-flow>');
  return flow as XyFlowElement;
}

/** Append a line to a `.demo-log` element, newest first, keeping at most `max` lines. */
export function logLine(log: HTMLElement, label: string, text = '', max = 40): void {
  const line = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = label;
  line.append(b, text ? ` ${text}` : '');
  log.prepend(line);
  while (log.childElementCount > max) log.lastElementChild?.remove();
}

/** Compact JSON for log lines. */
export const brief = (value: unknown, max = 90): string => {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** A `.demo-bar` of checkboxes, each bound to a boolean property of the flow. */
export function toggleBar(
  flow: object,
  items: { label: string; prop: string; value: boolean }[],
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  for (const item of items) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.value;
    (flow as Record<string, unknown>)[item.prop] = item.value;
    input.addEventListener('change', () => {
      (flow as Record<string, unknown>)[item.prop] = input.checked;
    });
    label.append(input, ` ${item.label}`);
    bar.append(label);
  }
  return bar;
}
