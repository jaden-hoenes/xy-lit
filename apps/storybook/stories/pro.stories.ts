import '@xy-lit/pro/define.js';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import {
  LocalHistory,
  animateNodePositions,
  applyLayout,
  collapseAll,
  expandAll,
  groupSelection,
  installClipboard,
  installDropIntoGroup,
  installHelperLines,
  isCollapsed,
  layoutBackend,
  toggleCollapsed,
  ungroup,
} from '@xy-lit/pro';
import type { ApplyLayoutOptions } from '@xy-lit/pro';
import { Position } from '@xy-lit/flow';
import type { Edge, Node, XyFlowElement } from '@xy-lit/flow';
import {
  StoryElement,
  chrome,
  defineStoryElement,
  describe,
  fitWhenRendered,
  groupTypes,
  on,
  once,
  titled,
} from './_lib/flow.ts';

interface Args {
  snap?: boolean;
  threshold?: number;
  algorithm?: 'dagre' | 'elk' | 'tree' | 'force';
  direction?: 'TB' | 'LR';
  duration?: number;
  autoApply?: boolean;
}

const meta: Meta<Args> = { title: 'Pro' };
export default meta;
type Story = StoryObj<Args>;

const lr = { sourcePosition: Position.Right, targetPosition: Position.Left };

/** Installs `@xy-lit/pro` features on the story's flow once it exists, and removes them again. */
abstract class ProStory extends StoryElement {
  static override properties = { args: { attribute: false }, tick: { state: true } };
  declare args: Args;
  declare tick: number;
  protected history: LocalHistory | null = null;
  #disposers: (() => void)[] = [];
  #installed = false;
  constructor() {
    super();
    this.tick = 0;
  }
  protected get flow(): XyFlowElement {
    return this.querySelector('xy-flow') as XyFlowElement;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    void this.updateComplete.then(() => {
      if (this.#installed || !this.isConnected) return;
      this.#installed = true;
      const history = new LocalHistory(this.flow, { maxSteps: 100 });
      this.history = history;
      this.#disposers.push(
        () => history.dispose(),
        history.subscribe(() => this.requestUpdate()),
      );
      this.install(this.flow, (fn) => this.#disposers.push(fn));
    });
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this.#disposers.splice(0)) fn();
    this.history = null;
    this.#installed = false;
  }
  /** Install the features under test; register disposers through `onDispose`. */
  protected abstract install(flow: XyFlowElement, onDispose: (fn: () => void) => void): void;

  protected undoRedo(): TemplateResult {
    const h = this.history;
    return html`
      <button class="sb-btn" ?disabled=${!h?.canUndo()} @click=${() => h?.undo()}>Undo</button>
      <button class="sb-btn" ?disabled=${!h?.canRedo()} @click=${() => h?.redo()}>Redo</button>
    `;
  }
}

const link = (a: string, b: string): Edge => ({ id: `${a}-${b}`, source: a, target: b });

// ---- UndoRedo ---------------------------------------------------------------------------------------

class UndoRedoStory extends ProStory {
  #n = 0;
  protected override install(): void {}
  override render() {
    const h = this.history;
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 40 }, data: { label: 'A' }, ...lr },
      { id: 'b', position: { x: 280, y: 0 }, data: { label: 'B' }, ...lr },
      { id: 'c', position: { x: 280, y: 120 }, data: { label: 'C' }, ...lr },
    ];
    return html`
      <div class="sb-bar">
        ${this.undoRedo()}
        <span class="sb-pill plain sb-mono"
          >undo ${h?.undoSize ?? 0} / redo ${h?.redoSize ?? 0}</span
        >
        <button
          class="sb-btn"
          @click=${() => {
            const n = ++this.#n;
            this.flow.addNodes({
              id: `new-${n}`,
              position: { x: 40 * n, y: 220 },
              data: { label: `New ${n}` },
            });
          }}
        >
          Add node
        </button>
        <span class="sb-muted"
          >Drag, connect, delete (Backspace) or add, then <span class="sb-kbd">Ctrl/Cmd</span>+<span
            class="sb-kbd"
            >Z</span
          >.</span
        >
      </div>
      <xy-flow
        fit-view
        .nodes=${once(nodes)}
        .edges=${once((): Edge[] => [link('a', 'b'), link('a', 'c')])}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-undo', UndoRedoStory);

export const UndoRedo: Story = {
  render: () => html`<sb-pro-undo></sb-pro-undo>`,
  parameters: describe(
    '`new LocalHistory(flow)` records every change that goes through the flow and undoes it with `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`. A whole drag, resize, delete or layout is one step. The buttons use `undo()`, `redo()`, `canUndo()` and `subscribe()`. In a collaborative flow the Yjs source supplies its own per-user history and `LocalHistory` stays inactive.',
  ),
};

// ---- Clipboard --------------------------------------------------------------------------------------

class ClipboardStory extends ProStory {
  #clip: ReturnType<typeof installClipboard> | null = null;
  protected override install(flow: XyFlowElement, onDispose: (fn: () => void) => void): void {
    this.#clip = installClipboard(flow);
    onDispose(this.#clip);
    onDispose(() => (this.#clip = null));
  }
  override render() {
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 20 }, data: { label: 'A' }, ...lr },
      { id: 'b', position: { x: 260, y: 20 }, data: { label: 'B' }, ...lr },
      titled('g', 'Group', '99, 102, 241', { position: { x: 0, y: 150 }, width: 400, height: 170 }),
      { id: 'k1', parentId: 'g', position: { x: 30, y: 50 }, data: { label: 'K1' }, ...lr },
      { id: 'k2', parentId: 'g', position: { x: 230, y: 90 }, data: { label: 'K2' }, ...lr },
    ];
    const edges = (): Edge[] => [link('a', 'b'), link('k1', 'k2')];
    const c = () => this.#clip;
    return html`
      <div class="sb-bar">
        <button class="sb-btn" @click=${() => void c()?.copy()}>Copy</button>
        <button class="sb-btn" @click=${() => void c()?.cut()}>Cut</button>
        <button class="sb-btn" @click=${() => void c()?.paste()}>Paste</button>
        <button class="sb-btn" @click=${() => void c()?.duplicate()}>Duplicate</button>
        ${this.undoRedo()}
        <span class="sb-muted"
          >Select (Shift-drag), then <span class="sb-kbd">Ctrl/Cmd</span>+<span class="sb-kbd"
            >C</span
          >
          / <span class="sb-kbd">X</span> / <span class="sb-kbd">V</span> /
          <span class="sb-kbd">D</span>.</span
        >
      </div>
      <xy-flow
        fit-view
        ${fitWhenRendered()}
        .nodeTypes=${groupTypes}
        .nodes=${once(nodes)}
        .edges=${once(edges)}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-clipboard', ClipboardStory);

export const Clipboard: Story = {
  render: () => html`<sb-pro-clipboard></sb-pro-clipboard>`,
  parameters: describe(
    '`installClipboard(flow)` adds copy, cut, paste and duplicate for the selected nodes and the edges between them, with the keyboard shortcuts and as commands. Pasted elements get fresh ids, land at the pointer (or offset from the original), and are selected; children keep their parent when it is copied too. Paste is one undo step.',
  ),
};

// ---- HelperLines ------------------------------------------------------------------------------------

class HelperLinesStory extends ProStory {
  #dispose: (() => void) | null = null;
  #key = '';
  protected override install(): void {}
  override updated(): void {
    // (re)install when the controls change, once the flow exists
    if (!this.history) return;
    const key = `${this.args.snap ?? true}:${this.args.threshold ?? 6}`;
    if (key === this.#key) return;
    this.#key = key;
    this.#dispose?.();
    this.#dispose = installHelperLines(this.flow, {
      snap: this.args.snap ?? true,
      threshold: this.args.threshold ?? 6,
    });
  }
  override connectedCallback(): void {
    super.connectedCallback();
    void this.updateComplete.then(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dispose?.();
    this.#dispose = null;
    this.#key = '';
  }
  override render() {
    const size = { width: 120, height: 44 };
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, ...size },
      { id: 'b', position: { x: 300, y: 130 }, data: { label: 'B' }, ...size },
      { id: 'c', position: { x: 560, y: 20 }, data: { label: 'C' }, ...size },
      { id: 'd', position: { x: 160, y: 260 }, data: { label: 'D' }, ...size },
    ];
    return html`
      <div class="sb-bar">
        <span class="sb-muted"
          >Drag a node close to another one's edge or centre: a guide appears and the node snaps to
          it.</span
        >
      </div>
      <xy-flow fit-view .nodes=${once(nodes)} .edges=${once((): Edge[] => [])}>
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-helper-lines', HelperLinesStory);

export const HelperLines: Story = {
  args: { snap: true, threshold: 6 },
  argTypes: {
    snap: { control: 'boolean', description: 'Snap the node to the guide, not just draw it.' },
    threshold: {
      control: { type: 'range', min: 2, max: 24, step: 1 },
      description: 'Distance in px at which a guide appears.',
    },
  },
  parameters: {
    ...describe(
      '`installHelperLines(flow, { threshold, snap })` shows alignment guides while a single node is dragged (edges and centres of the other nodes) and optionally snaps to them. The guide is drawn by `<xy-helper-lines>`; `--xy-helper-line-color` changes its colour, and `onChange` exposes the guides for custom drawing.',
    ),
    controls: { include: ['snap', 'threshold'] },
  },
  render: (args) => html`<sb-pro-helper-lines .args=${args}></sb-pro-helper-lines>`,
};

// ---- AutoLayout -------------------------------------------------------------------------------------

const layoutNames = ['root', 'a', 'b', 'c', 'a1', 'a2', 'b1', 'c1', 'c2', 'c3', 'join'];
const layoutPairs: [string, string][] = [
  ['root', 'a'],
  ['root', 'b'],
  ['root', 'c'],
  ['a', 'a1'],
  ['a', 'a2'],
  ['b', 'b1'],
  ['c', 'c1'],
  ['c', 'c2'],
  ['c', 'c3'],
  ['a1', 'join'],
  ['b1', 'join'],
  ['c3', 'join'],
];

class AutoLayoutStory extends ProStory {
  static override properties = { ...ProStory.properties, backend: { state: true } };
  declare backend: string;
  #last = '';
  constructor() {
    super();
    this.backend = '';
  }
  protected override install(): void {
    void this.#run();
  }
  async #run(): Promise<void> {
    const options = {
      algorithm: this.args.algorithm ?? 'dagre',
      ...(this.args.algorithm === 'dagre' || this.args.algorithm === 'tree' || !this.args.algorithm
        ? { direction: this.args.direction ?? 'LR' }
        : {}),
      animate: this.args.duration ?? 500,
      fitView: true,
    } as ApplyLayoutOptions;
    await this.flow.whenRendered();
    try {
      await applyLayout(this.flow, options);
      this.backend = layoutBackend();
    } catch (e) {
      this.backend = `failed: ${String(e)}`;
    }
  }
  override updated(): void {
    const key = `${this.args.algorithm}:${this.args.direction}`;
    if (this.history && key !== this.#last) {
      if (this.#last) void this.#run();
      this.#last = key;
    }
  }
  override render() {
    const nodes = (): Node[] =>
      layoutNames.map((id, i) => ({
        id,
        position: { x: (i % 4) * 45, y: Math.floor(i / 4) * 35 },
        data: { label: id },
        ...lr,
      }));
    return html`
      <div class="sb-bar">
        <button class="sb-btn sb-primary" @click=${() => void this.#run()}>Apply layout</button>
        <button
          class="sb-btn"
          @click=${() => {
            for (const n of this.flow.getNodes()) {
              this.flow.updateNode(n.id, {
                position: { x: Math.random() * 700, y: Math.random() * 380 },
              });
            }
          }}
        >
          Shuffle
        </button>
        ${this.undoRedo()}
        <span class="sb-muted"
          >${this.args.algorithm ?? 'dagre'}${this.backend ? `, ran in the ${this.backend}` : ''}.
          Switch the algorithm in the controls.</span
        >
      </div>
      <xy-flow
        min-zoom="0.2"
        fit-view
        .nodes=${once(nodes)}
        .edges=${once((): Edge[] => layoutPairs.map(([a, b]) => link(a, b)))}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-layout', AutoLayoutStory);

export const AutoLayout: Story = {
  args: { algorithm: 'dagre', direction: 'LR', duration: 500 },
  argTypes: {
    algorithm: { control: 'inline-radio', options: ['dagre', 'elk', 'tree', 'force'] },
    direction: {
      control: 'inline-radio',
      options: ['TB', 'LR'],
      description: 'For dagre and tree.',
    },
    duration: {
      control: { type: 'range', min: 0, max: 1500, step: 50 },
      description: 'Animation in ms (0 jumps).',
    },
  },
  parameters: {
    ...describe(
      '`applyLayout(flow, { algorithm })` arranges the nodes with dagre, elk, a d3 tree or a force simulation, in a Web Worker, and animates them there (falling back to the main thread if workers are unavailable). The whole layout is one undo step. The libraries are optional peers loaded on demand. Pick an algorithm in the controls; the story re-runs it.',
    ),
    controls: { include: ['algorithm', 'direction', 'duration'] },
  },
  render: (args) => html`<sb-pro-layout .args=${args}></sb-pro-layout>`,
};

// ---- AnimatedPositions ------------------------------------------------------------------------------

class AnimatedStory extends ProStory {
  static override properties = { ...ProStory.properties, shape: { state: true } };
  declare shape: string;
  constructor() {
    super();
    this.shape = 'row';
  }
  protected override install(): void {}
  #go(shape: 'circle' | 'row' | 'grid' | 'wave'): void {
    this.shape = shape;
    const nodes = this.flow.getNodes();
    const n = nodes.length;
    const target = (i: number): { x: number; y: number } => {
      switch (shape) {
        case 'circle': {
          const a = (i / n) * Math.PI * 2;
          return { x: 330 + Math.cos(a) * 200, y: 170 + Math.sin(a) * 160 };
        }
        case 'grid':
          return { x: 100 + (i % 4) * 150, y: 40 + Math.floor(i / 4) * 130 };
        case 'wave':
          return { x: 20 + i * 70, y: 170 + Math.sin(i * 0.9) * 110 };
        default:
          return { x: 20 + i * 70, y: 170 };
      }
    };
    void animateNodePositions(
      this.flow,
      Object.fromEntries(nodes.map((node, i) => [node.id, target(i)])),
      {
        duration: this.args.duration ?? 600,
      },
    );
  }
  override render() {
    const nodes = (): Node[] =>
      Array.from({ length: 8 }, (_, i) => ({
        id: `n${i}`,
        position: { x: 20 + i * 70, y: 170 },
        data: { label: `${i + 1}` },
        width: 54,
        height: 40,
      }));
    return html`
      <div class="sb-bar">
        ${(['circle', 'grid', 'wave', 'row'] as const).map(
          (s) =>
            html`<button
              class="sb-btn"
              aria-pressed=${this.shape === s}
              @click=${() => this.#go(s)}
            >
              ${s}
            </button>`,
        )}
        ${this.undoRedo()}
        <span class="sb-muted">Each move is one animation and one undo step.</span>
      </div>
      <xy-flow fit-view .nodes=${once(nodes)} .edges=${once((): Edge[] => [])}
        >${chrome({ minimap: false })}</xy-flow
      >
    `;
  }
}
defineStoryElement('sb-pro-animated', AnimatedStory);

export const AnimatedPositions: Story = {
  args: { duration: 600 },
  argTypes: {
    duration: {
      control: { type: 'range', min: 0, max: 2000, step: 100 },
      description: 'Animation in ms.',
    },
  },
  parameters: {
    ...describe(
      '`animateNodePositions(flow, targets, { duration })` moves nodes smoothly to new positions through the normal change pipeline, so edges, undo and a collaborative document all stay correct (a Yjs source commits once, at the end). It respects `prefers-reduced-motion` and is cancelled by a newer animation of the same nodes.',
    ),
    controls: { include: ['duration'] },
  },
  render: (args) => html`<sb-pro-animated .args=${args}></sb-pro-animated>`,
};

// ---- ExpandCollapse ---------------------------------------------------------------------------------

const tree: Record<string, string[]> = {
  root: ['a', 'b', 'c'],
  a: ['a1', 'a2'],
  b: ['b1'],
  c: ['c1', 'c2'],
  c2: ['c21', 'c22'],
};

class CollapseStory extends ProStory {
  protected override install(flow: XyFlowElement): void {
    void flow.whenRendered().then(() => this.#relayout());
  }
  async #relayout(): Promise<void> {
    await applyLayout(this.flow, {
      algorithm: 'dagre',
      direction: 'LR',
      animate: 250,
      fitView: true,
    });
  }
  #labels(): void {
    const flow = this.flow;
    this.history?.withoutRecording(() => {
      for (const n of flow.getNodes()) {
        if (n.id in tree) {
          flow.updateNodeData(n.id, { label: `${isCollapsed(flow, n.id) ? '▸' : '▾'} ${n.id}` });
        }
      }
    });
  }
  #toggle(id: string): void {
    toggleCollapsed(this.flow, id);
    this.#labels();
    void this.#relayout();
  }
  override render() {
    const ids = new Set(['root', ...Object.values(tree).flat()]);
    const nodes = (): Node[] =>
      [...ids].map((id) => ({
        id,
        position: { x: 0, y: 0 },
        data: { label: id in tree ? `▾ ${id}` : id },
        ...lr,
      }));
    const edges = (): Edge[] =>
      Object.entries(tree).flatMap(([source, targets]) =>
        targets.map((target) => link(source, target)),
      );
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => {
            collapseAll(this.flow);
            this.#labels();
            void this.#relayout();
          }}
        >
          Collapse all
        </button>
        <button
          class="sb-btn"
          @click=${() => {
            expandAll(this.flow);
            this.#labels();
            void this.#relayout();
          }}
        >
          Expand all
        </button>
        ${this.undoRedo()}
        <span class="sb-muted"
          >Double-click a node with children to collapse or expand its subtree.</span
        >
      </div>
      <xy-flow
        fit-view
        .nodes=${once(nodes)}
        .edges=${once(edges)}
        ${on({ 'node-double-click': (e) => this.#toggle((e as CustomEvent<{ node: Node }>).detail.node.id) })}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-collapse', CollapseStory);

export const ExpandCollapse: Story = {
  render: () => html`<sb-pro-collapse></sb-pro-collapse>`,
  parameters: describe(
    '`toggleCollapsed(flow, id)`, `collapseAll` and `expandAll` hide and show the subtree below a node (the descendants reachable along edges, flagged with `hidden`). The state is `node.data.collapsed`; the node template shows the toggle. Here a layout re-runs after each change so the tree stays tidy, and `history.withoutRecording` keeps the label updates out of undo.',
  ),
};

// ---- Grouping ---------------------------------------------------------------------------------------

class GroupingStory extends ProStory {
  protected override install(flow: XyFlowElement, onDispose: (fn: () => void) => void): void {
    onDispose(installDropIntoGroup(flow, { groupTypes: ['titled'] }));
  }
  override render() {
    const size = { width: 120, height: 44 };
    const nodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, ...size },
      { id: 'b', position: { x: 200, y: 90 }, data: { label: 'B' }, ...size },
      { id: 'c', position: { x: 420, y: 0 }, data: { label: 'C' }, ...size },
      titled('lane', 'Lane', '16, 185, 129', {
        position: { x: 0, y: 220 },
        width: 420,
        height: 170,
      }),
    ];
    return html`
      <div class="sb-bar">
        <button
          class="sb-btn"
          @click=${() => void groupSelection(this.flow, { type: 'titled', padding: 28, data: { label: 'Group', rgb: '99, 102, 241' } })}
        >
          Group selection
        </button>
        <button
          class="sb-btn"
          @click=${() => {
            for (const n of this.flow.getNodes())
              if (n.selected && n.type === 'titled') ungroup(this.flow, n.id);
          }}
        >
          Ungroup
        </button>
        ${this.undoRedo()}
        <span class="sb-muted"
          >Select nodes (Shift-drag) and group them, or drag a node onto the lane and back
          out.</span
        >
      </div>
      <xy-flow
        fit-view
        ${fitWhenRendered()}
        .nodeTypes=${groupTypes}
        .nodes=${once(nodes)}
        .edges=${once((): Edge[] => [link('a', 'b')])}
      >
        ${chrome({ minimap: false })}
      </xy-flow>
    `;
  }
}
defineStoryElement('sb-pro-grouping', GroupingStory);

export const Grouping: Story = {
  render: () => html`<sb-pro-grouping></sb-pro-grouping>`,
  parameters: describe(
    '`groupSelection(flow, { type, padding, data })` wraps the selected nodes in a new group node sized to fit and reparents them; `ungroup(flow, id)` undoes it. `installDropIntoGroup(flow, { groupTypes })` reparents nodes as you drag them into or out of a group. Each operation is one undo step, positions stay where they were on screen, and parents are kept before children in the array.',
  ),
};
