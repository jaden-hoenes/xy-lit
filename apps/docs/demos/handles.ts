// Connections: colour validation, strict or loose mode, click to connect, reconnecting edges.
import { css, html } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Connection, Edge, Node } from '@xy-lit/flow';
import { flowOf, logLine, mountTemplate, type Mount } from './_shared';

type Tone = { tone: 'red' | 'green' | 'blue'; label: string };
const colors = { red: '#fca5a5', green: '#86efac', blue: '#93c5fd' };

const styles = css`
  .doc-tone {
    padding: 8px 14px;
    border: 1px solid #1a192b;
    border-radius: 8px;
    color: #1a192b;
    font: 12px var(--vp-font-family-base, system-ui, sans-serif);
  }
  .doc-tone .lit-flow__handle {
    width: 9px;
    height: 9px;
    background: #1a192b;
  }
  /* the handle under the dragged connection: red when refused, green when accepted */
  .doc-tone .lit-flow__handle.connectingto {
    background: #ef4444;
  }
  .doc-tone .lit-flow__handle.connectingto.valid {
    background: #22c55e;
  }
`;
const tone = (kind: 'source' | 'target') =>
  defineNodeType<Node<Tone>>({
    styles,
    render: ({ data }) => html`<div class="doc-tone" style="background: ${colors[data.tone]}">
      ${kind === 'target' ? html`<xy-handle type="target" position="left"></xy-handle>` : ''}
      ${data.label}
      ${kind === 'source' ? html`<xy-handle type="source" position="right"></xy-handle>` : ''}
    </div>`,
  });

const tones = ['red', 'green', 'blue'] as const;
const nodes: Node[] = [
  ...tones.map((t, i) => ({ id: `s-${t}`, type: 'src', position: { x: 0, y: i * 80 }, data: { tone: t, label: `${t} source` } })),
  ...tones.map((t, i) => ({ id: `t-${t}`, type: 'dst', position: { x: 300, y: ((i + 1) % 3) * 80 }, data: { tone: t, label: `${t} target` } })),
];
const edges: Edge[] = [{ id: 'start', source: 's-red', target: 't-red' }];

export const mount: Mount = (el) => {
  let sameColour = true;
  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <label><input type="checkbox" id="same" checked /> only matching colours (<code>isValidConnection</code>)</label>
        <label>
          <code>connection-mode</code>
          <select id="mode"><option>strict</option><option>loose</option></select>
        </label>
        <label><input type="checkbox" id="reconnect" checked /> <code>edges-reconnectable</code></label>
      </div>
      <div class="demo-body">
        <xy-flow
          .nodes=${nodes}
          .edges=${edges}
          .nodeTypes=${{ src: tone('source'), dst: tone('target') }}
          edges-reconnectable
          fit-view
          prevent-scrolling="false"
          zoom-on-scroll="false"
        >
          <xy-background></xy-background>
        </xy-flow>
        <div class="demo-log" id="log" aria-label="Connection log"></div>
      </div>`,
  );
  const flow = flowOf(el);
  const log = el.querySelector<HTMLElement>('#log')!;
  flow.isValidConnection = (c: Connection | Edge): boolean => {
    if (!sameColour) return true;
    const a = flow.getNode(c.source)?.data as Tone | undefined;
    const b = flow.getNode(c.target)?.data as Tone | undefined;
    return !!a && !!b && a.tone === b.tone;
  };
  logLine(log, 'try it', 'drag from a handle (or click one, then click another)');
  flow.addEventListener('connect', (e) => logLine(log, 'connect', `${(e as CustomEvent).detail.connection.source} to ${(e as CustomEvent).detail.connection.target}`));
  flow.addEventListener('connect-end', (e) => {
    const state = (e as CustomEvent).detail.connectionState;
    logLine(log, 'connect-end', state.isValid === false ? 'refused' : state.isValid ? 'accepted' : 'dropped on the pane');
  });
  flow.addEventListener('reconnect', (e) => logLine(log, 'reconnect', (e as CustomEvent).detail.oldEdge.id));
  el.querySelector('#same')!.addEventListener('change', (e) => {
    sameColour = (e.target as HTMLInputElement).checked;
  });
  el.querySelector('#mode')!.addEventListener('change', (e) => {
    flow.connectionMode = (e.target as HTMLSelectElement).value as 'strict' | 'loose';
  });
  el.querySelector('#reconnect')!.addEventListener('change', (e) => {
    flow.edgesReconnectable = (e.target as HTMLInputElement).checked;
  });
  return dispose;
};
