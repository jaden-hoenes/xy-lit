import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { buttonHandle, labeledHandle, uiStyles } from '../src/index.js';
import { cleanup, frames, mountFlow, node, nodeEl, waitFor } from './helpers.js';

afterEach(cleanup);

const clicks: string[] = [];
const labeled = defineNodeType<Node<{ show?: boolean }>>({
  styles: uiStyles,
  render: ({ id, data }) =>
    html`<xy-base-node class="xy-ui-node">
      ${labeledHandle({ type: 'target', position: 'left', id: 'in-1', label: 'Input <b>one</b>' })}
      ${labeledHandle({ type: 'source', position: 'right', id: 'out', label: 'Output' })}
      ${buttonHandle({
        type: 'source',
        position: 'bottom',
        id: 'next',
        showButton: !!data.show,
        onClick: () => clicks.push(id),
      })}
    </xy-base-node>`,
});

describe('labeledHandle()', () => {
  it('renders an <xy-handle> with the id and a text label that is never parsed as HTML', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'labeled', data: {} })],
      props: { nodeTypes: { labeled } },
    });
    const el = nodeEl(flow, 'a');
    const row = el.querySelector<HTMLElement>('.xy-ui-labeled-handle.left')!;
    const handle = row.querySelector('xy-handle')!;
    expect(handle.getAttribute('handle-id')).toBe('in-1');
    expect(handle.classList.contains('target')).toBe(true);
    expect(row.querySelector('.xy-ui-labeled-handle__label')?.textContent).toBe('Input <b>one</b>');
    expect(row.querySelector('b')).toBeNull();
    // the handle is registered with the engine under its id
    const bounds = await waitFor(() => flow.getInternalNode('a')?.internals.handleBounds);
    expect(bounds.target?.map((h) => h.id)).toEqual(['in-1']);
    expect(bounds.source?.map((h) => h.id).sort()).toEqual(['next', 'out']);
  });

  it('puts the handle on the node border and the label inside', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'labeled', data: {} })],
      props: { nodeTypes: { labeled } },
    });
    const el = nodeEl(flow, 'a');
    const box = el.getBoundingClientRect();
    const left = el.querySelector('.xy-ui-labeled-handle.left xy-handle')!.getBoundingClientRect();
    const right = el
      .querySelector('.xy-ui-labeled-handle.right xy-handle')!
      .getBoundingClientRect();
    expect(left.left + left.width / 2).toBeCloseTo(box.left, 0);
    expect(right.left + right.width / 2).toBeCloseTo(box.right, 0);
    const label = el
      .querySelector('.xy-ui-labeled-handle.left .xy-ui-labeled-handle__label')!
      .getBoundingClientRect();
    expect(label.left).toBeGreaterThan(box.left + 6);
    expect(label.right).toBeLessThan(box.right);
  });

  it('connects through its handle ids', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 0, 0, { type: 'labeled', data: {} }),
        node('b', 400, 0, { type: 'labeled', data: {} }),
      ],
      edges: [{ id: 'e', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in-1' }],
      props: { nodeTypes: { labeled } },
    });
    await waitFor(() => flow.renderRoot.querySelector('g[data-id="e"] path'));
    expect(flow.getHandleConnections({ type: 'source', nodeId: 'a', id: 'out' })).toHaveLength(1);
    expect(flow.getHandleConnections({ type: 'target', nodeId: 'b', id: 'in-1' })).toHaveLength(1);
  });
});

describe('buttonHandle()', () => {
  it('shows the button only when asked and calls onClick without starting a connection', async () => {
    clicks.length = 0;
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'labeled', data: { show: false } })],
      props: { nodeTypes: { labeled } },
    });
    const el = nodeEl(flow, 'a');
    expect(el.querySelector('.xy-ui-button-handle__button')).toBeNull();
    flow.updateNodeData('a', { show: true });
    const button = await waitFor(() =>
      el.querySelector<HTMLButtonElement>('.xy-ui-button-handle__button'),
    );
    expect(button.classList.contains('nodrag')).toBe(true);
    expect(button.classList.contains('nopan')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Add');
    expect(button.textContent?.trim()).toBe('+');

    const onConnectStart = vi.fn();
    flow.addEventListener('connect-start', onConnectStart);
    const box = button.getBoundingClientRect();
    // the button sits outside the node, below the handle
    expect(box.top).toBeGreaterThan(el.getBoundingClientRect().bottom);
    const init = {
      bubbles: true,
      composed: true,
      cancelable: true,
      button: 0,
      clientX: box.left + 4,
      clientY: box.top + 4,
    };
    button.dispatchEvent(
      new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse' }),
    );
    button.dispatchEvent(new MouseEvent('mousedown', init));
    button.dispatchEvent(new MouseEvent('mouseup', init));
    button.click();
    await frames(2);
    expect(clicks).toEqual(['a']);
    expect(onConnectStart).not.toHaveBeenCalled();
    expect(flow.getEdges()).toHaveLength(0);
  });

  it('keeps the button out of the handle (no nested interactive elements) and still next to it', async () => {
    const flow = await mountFlow({
      nodes: [node('a', 0, 0, { type: 'labeled', data: { show: true } })],
      props: { nodeTypes: { labeled } },
    });
    const el = nodeEl(flow, 'a');
    const button = await waitFor(() =>
      el.querySelector<HTMLButtonElement>('.xy-ui-button-handle__button'),
    );
    const handle = el.querySelector<HTMLElement>('xy-handle.xy-ui-button-handle')!;
    expect(handle.contains(button)).toBe(false);
    expect(handle.querySelector('button')).toBeNull();
    expect(button.closest('xy-handle')).toBeNull();
    // the handle dot and the button are centred on the same vertical line, the button below the dot
    const h = handle.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    expect(Math.abs(h.left + h.width / 2 - (b.left + b.width / 2))).toBeLessThan(1.5);
    expect(b.top).toBeGreaterThan(h.bottom);
    expect(b.top - h.bottom).toBeLessThan(24);
  });
});
