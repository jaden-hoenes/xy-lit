// @xy-lit/pro on one flow: history, clipboard, helper lines, drop into groups, layout, collapse, grouping.
import { html } from 'lit';
import {
  LocalHistory,
  applyLayout,
  groupSelection,
  installClipboard,
  installDropIntoGroup,
  installHelperLines,
  toggleCollapsed,
  collapseAll,
  expandAll,
  ungroup,
} from '@xy-lit/pro';
import { Position } from '@xy-lit/flow';
import type { Edge, Node } from '@xy-lit/flow';
import { flowOf, mountTemplate, type Mount } from './_shared';

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };
const labels = ['Root', 'Parse', 'Plan', 'Check', 'Emit', 'Link', 'Test', 'Pack'];
const nodes: Node[] = labels.map((label, i) => ({
  id: label.toLowerCase(),
  position: { x: (i % 4) * 190, y: Math.floor(i / 4) * 120 + (i % 2) * 20 },
  data: { label },
  ...lr,
}));
const e = (a: string, b: string): Edge => ({ id: `${a}-${b}`, source: a, target: b });
const edges: Edge[] = [
  e('root', 'parse'), e('root', 'plan'), e('parse', 'check'), e('plan', 'emit'),
  e('check', 'link'), e('emit', 'test'), e('link', 'pack'), e('test', 'pack'),
];

export const mount: Mount = (el) => {
  const dispose = mountTemplate(
    el,
    html`<div class="demo-bar">
        <button type="button" id="undo" disabled>Undo</button>
        <button type="button" id="redo" disabled>Redo</button>
        <button type="button" id="copy">Copy</button>
        <button type="button" id="paste">Paste</button>
        <button type="button" id="dup">Duplicate</button>
        <span class="spacer"></span>
        <button type="button" id="group">Group selection</button>
        <button type="button" id="ungroup">Ungroup</button>
        <button type="button" id="collapse">Collapse / expand selected</button>
        <button type="button" id="expand">Expand all</button>
        <button type="button" id="layout">Layout (dagre, LR)</button>
        <span id="note" aria-live="polite"></span>
      </div>
      <xy-flow .nodes=${nodes} .edges=${edges} fit-view delete-key="Backspace" prevent-scrolling="false" zoom-on-scroll="false">
        <xy-background></xy-background>
        <xy-controls show-interactive="false"></xy-controls>
      </xy-flow>`,
  );
  const flow = flowOf(el);
  const history = new LocalHistory(flow);
  const clipboard = installClipboard(flow);
  const stopLines = installHelperLines(flow);
  const stopDrop = installDropIntoGroup(flow);
  const note = el.querySelector<HTMLElement>('#note')!;
  const $ = (id: string): HTMLButtonElement => el.querySelector<HTMLButtonElement>(`#${id}`)!;
  const sync = (): void => {
    $('undo').disabled = !history.canUndo();
    $('redo').disabled = !history.canRedo();
  };
  history.subscribe(sync);
  $('undo').onclick = () => history.undo();
  $('redo').onclick = () => history.redo();
  $('copy').onclick = () => clipboard.copy();
  $('paste').onclick = () => clipboard.paste();
  $('dup').onclick = () => clipboard.duplicate();
  $('group').onclick = () => {
    const id = groupSelection(flow, { type: 'group', padding: 24, data: {} });
    note.textContent = id ? `grouped as ${id}` : 'select two or more nodes first (Shift-drag a rectangle)';
  };
  $('ungroup').onclick = () => {
    const group = flow.getNodes().find((n) => n.selected && n.type === 'group');
    if (group) void ungroup(flow, group.id);
    else note.textContent = 'select a group first';
  };
  $('collapse').onclick = () => {
    const sel = flow.getNodes().filter((n) => n.selected);
    if (!sel.length) note.textContent = 'select a node first';
    for (const n of sel) toggleCollapsed(flow, n.id);
  };
  $('expand').onclick = () => expandAll(flow);
  void collapseAll;
  $('layout').onclick = async () => {
    note.textContent = 'laying out...';
    try {
      await applyLayout(flow, { algorithm: 'dagre', direction: 'LR', animate: 300, fitView: true });
      note.textContent = 'done';
    } catch (error) {
      note.textContent = String(error);
    }
  };
  return () => {
    stopLines();
    stopDrop();
    clipboard();
    history.dispose();
    dispose();
  };
};
