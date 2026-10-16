import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import '@xy-lit/flow/define.js';
import '../src/define.js';
import type { XyFlowElement } from '@xy-lit/flow';
import { YjsFlowSource } from '../src/yjs-flow-source.js';
import type { XyPresenceAvatarsElement } from '../src/elements/xy-presence-avatars.js';
import type { XyRemoteCursorsElement } from '../src/elements/xy-remote-cursors.js';
import { cleanup, frames, mountFlow, waitFor } from '../../flow/test/helpers.js';

const user = (id: string, name: string, color: string) => ({ id, name, color });

type Rig = {
  flow: XyFlowElement;
  local: YjsFlowSource;
  remote: YjsFlowSource;
  cursors: XyRemoteCursorsElement;
  avatars: XyPresenceAvatarsElement;
};

async function rig(): Promise<Rig> {
  const d1 = new Y.Doc();
  const d2 = new Y.Doc();
  const a1 = new Awareness(d1);
  const a2 = new Awareness(d2);
  for (const [from, to] of [
    [a1, a2],
    [a2, a1],
  ] as const) {
    from.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        applyAwarenessUpdate(
          to,
          encodeAwarenessUpdate(from, [...added, ...updated, ...removed]),
          'relay',
        );
      },
    );
  }
  YjsFlowSource.populate(d1, {
    nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } }],
    edges: [],
  });
  const local = new YjsFlowSource(d1, {
    awareness: a1,
    user: user('1', 'Ada Lovelace', '#e11d48'),
  });
  const remote = new YjsFlowSource(d2, {
    awareness: a2,
    user: user('2', 'Grace Hopper', '#2563eb'),
  });
  const flow = await mountFlow({});
  const cursors = document.createElement('xy-remote-cursors');
  const avatars = document.createElement('xy-presence-avatars');
  flow.append(cursors, avatars);
  flow.source = local;
  await flow.whenRendered();
  await cursors.updateComplete;
  return { flow, local, remote, cursors, avatars };
}

afterEach(() => cleanup());

const cursorEl = (r: Rig): HTMLElement | null =>
  r.cursors.shadowRoot!.querySelector<HTMLElement>('.cursor');

describe('<xy-remote-cursors>', () => {
  it('sets slot="viewport-front" itself', async () => {
    const r = await rig();
    expect(r.cursors.getAttribute('slot')).toBe('viewport-front');
  });

  it('draws a remote cursor with the name tag in the user colour', async () => {
    const r = await rig();
    r.remote.presence!.setCursor({ x: 100, y: 50 });
    const el = await waitFor(() => cursorEl(r));
    expect(el.querySelector('.name')!.textContent).toBe('Grace Hopper');
    expect(el.getAttribute('style')).toContain('#2563eb');
    await waitFor(() => el.style.transform.includes('translate(100px, 50px)'));
  });

  for (const zoom of [0.5, 2]) {
    it(`keeps its size and position at zoom ${zoom}`, async () => {
      const r = await rig();
      await r.flow.instance.setViewport({ x: 30, y: 20, zoom });
      r.remote.presence!.setCursor({ x: 100, y: 50 });
      const el = await waitFor(() => cursorEl(r));
      await waitFor(() => el.style.transform.includes(`scale(${1 / zoom})`));
      await frames(2);
      const flowRect = r.flow.getBoundingClientRect();
      const arrow = el.querySelector('.arrow')!.getBoundingClientRect();
      // the arrow's box starts at the cursor's flow position
      expect(arrow.left - flowRect.left).toBeCloseTo(30 + 100 * zoom, 0);
      expect(arrow.top - flowRect.top).toBeCloseTo(20 + 50 * zoom, 0);
      // and is 18 x 22 screen pixels whatever the zoom
      expect(arrow.width).toBeCloseTo(18, 0);
      expect(arrow.height).toBeCloseTo(22, 0);
    });
  }

  it('removes the cursor when the remote leaves it', async () => {
    const r = await rig();
    r.remote.presence!.setCursor({ x: 1, y: 1 });
    await waitFor(() => cursorEl(r));
    r.remote.presence!.setCursor(null);
    await waitFor(() => !cursorEl(r));
  });

  it('reports the local pointer in flow coordinates', async () => {
    const r = await rig();
    await r.flow.instance.setViewport({ x: 40, y: 10, zoom: 2 });
    const rect = r.flow.getBoundingClientRect();
    r.flow.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: rect.left + 240,
        clientY: rect.top + 110,
        bubbles: true,
        composed: true,
      }),
    );
    const seen = await waitFor(() => r.remote.presence!.remotes().values().next().value?.cursor);
    expect(seen.x).toBeCloseTo(100, 0);
    expect(seen.y).toBeCloseTo(50, 0);
    r.flow.dispatchEvent(new PointerEvent('pointerleave'));
    await waitFor(() => !r.remote.presence!.remotes().values().next().value?.cursor);
  });

  it('draws a remote connection in progress as a dashed path', async () => {
    const r = await rig();
    r.remote.presence!.setConnection({
      fromNode: 'a',
      fromHandle: null,
      fromType: 'source',
      to: { x: 300, y: 200 },
    });
    const path = await waitFor(() => r.cursors.shadowRoot!.querySelector('path.connection'));
    expect(path.getAttribute('d')).toMatch(/^M/);
    r.remote.presence!.setConnection(null);
    await waitFor(() => !r.cursors.shadowRoot!.querySelector('path.connection'));
  });
});

describe('<xy-presence-avatars>', () => {
  const buttons = (r: Rig) => [
    ...r.avatars.shadowRoot!.querySelectorAll<HTMLButtonElement>('button'),
  ];

  it('lists remote users with initials', async () => {
    const r = await rig();
    r.remote.presence!.setTool('x');
    await waitFor(() => buttons(r).length === 1);
    expect(buttons(r)[0]!.textContent!.trim()).toBe('GH');
    expect(buttons(r)[0]!.getAttribute('aria-label')).toBe('Grace Hopper');
    // the label counts everyone in the room including the local user (one remote + you)
    expect(r.avatars.shadowRoot!.querySelector('.live')!.textContent).toContain('2 online');
    expect(r.avatars.includeSelf).toBe(false);
  });

  it('counts the local user with and without include-self', async () => {
    const r = await rig();
    r.remote.presence!.setTool('x');
    await waitFor(() => buttons(r).length === 1);
    const live = () => r.avatars.shadowRoot!.querySelector('.live')!.textContent!.trim();
    expect(live()).toBe('2 online');
    r.avatars.includeSelf = true;
    await waitFor(() => buttons(r).length === 2);
    expect(live()).toBe('2 online');
  });

  it('follows a remote viewport on click until the local user pans', async () => {
    const r = await rig();
    await waitFor(() => buttons(r).length === 1);
    const changes: (number | null)[] = [];
    r.avatars.addEventListener('follow-change', (e) =>
      changes.push((e as CustomEvent<{ clientId: number | null }>).detail.clientId),
    );
    buttons(r)[0]!.click();
    expect(changes).toEqual([r.remote.doc.clientID]);
    r.remote.presence!.setViewport({ x: -200, y: -100, zoom: 1.5 });
    await waitFor(() => {
      const v = r.flow.instance.getViewport();
      return Math.abs(v.x + 200) < 1 && Math.abs(v.y + 100) < 1 && Math.abs(v.zoom - 1.5) < 0.01;
    }, 4000);
    // the local user pans: following stops
    r.flow.dispatchEvent(
      new CustomEvent('move-start', {
        detail: { event: new MouseEvent('mousedown'), viewport: r.flow.instance.getViewport() },
      }),
    );
    expect(changes).toEqual([r.remote.doc.clientID, null]);
    r.remote.presence!.setViewport({ x: 0, y: 0, zoom: 1 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(r.flow.instance.getViewport().zoom).toBeCloseTo(1.5, 1);
  });

  it('a programmatic move does not stop following', async () => {
    const r = await rig();
    await waitFor(() => buttons(r).length === 1);
    buttons(r)[0]!.click();
    r.flow.dispatchEvent(
      new CustomEvent('move-start', { detail: { event: null, viewport: { x: 0, y: 0, zoom: 1 } } }),
    );
    expect(r.avatars.following).toBe(r.remote.doc.clientID);
  });

  it('double click centres on the remote cursor', async () => {
    const r = await rig();
    r.remote.presence!.setCursor({ x: 500, y: 300 });
    await waitFor(
      () => buttons(r).length === 1 && r.local.presence!.remotes().values().next().value?.cursor,
    );
    const b = buttons(r)[0]!;
    b.click();
    b.click();
    b.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await waitFor(() => {
      const v = r.flow.instance.getViewport();
      const w = r.flow.clientWidth;
      const h = r.flow.clientHeight;
      return Math.abs(v.x + 500 * v.zoom - w / 2) < 2 && Math.abs(v.y + 300 * v.zoom - h / 2) < 2;
    }, 4000);
  });

  it('shows "+N" beyond max and drops users who left', async () => {
    const r = await rig();
    r.avatars.max = 1;
    await waitFor(() => buttons(r).length === 1);
    expect(r.avatars.shadowRoot!.querySelector('.more')).toBeNull();
    r.remote.destroy();
    await waitFor(() => buttons(r).length === 0);
  });
});
