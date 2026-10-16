import '@xy-lit/collab-yjs/define.js';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { XyFlowElement } from '@xy-lit/flow';
import { createPair, destroyPeer } from './_lib/collab.ts';
import type { Peer, Relay } from './_lib/collab.ts';
import {
  StoryElement,
  defineStoryElement,
  describe,
  fitWhenRendered,
  on,
  once,
} from './_lib/flow.ts';

interface Args {
  latency?: number;
  startOffline?: boolean;
}

const meta: Meta<Args> = {
  title: 'Collaboration',
  argTypes: {
    latency: {
      control: { type: 'range', min: 0, max: 2000, step: 50 },
      description: 'One-way delay of the relay in ms (the slider in the story changes it live).',
    },
    startOffline: { control: 'boolean', description: 'Start with the connection cut.' },
  },
  parameters: { controls: { include: ['latency', 'startOffline'] }, frame: { height: 640 } },
};
export default meta;
type Story = StoryObj<Args>;

/** Shared plumbing: the pair of peers, the relay, and re-rendering when anything changes. */
abstract class PairStory extends StoryElement {
  static override properties = {
    args: { attribute: false },
    run: { state: true },
    tick: { state: true },
  };
  declare args: Args;
  declare run: number;
  declare tick: number;
  protected alice!: Peer;
  protected bob!: Peer;
  protected relay!: Relay;
  #cleanup: (() => void)[] = [];
  constructor() {
    super();
    this.run = 0;
    this.tick = 0;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.#setup();
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardown();
  }
  protected reset(): void {
    this.#teardown();
    this.#setup();
    this.run++;
  }
  #setup(): void {
    const pair = createPair(this.args?.latency ?? 400);
    this.alice = pair.alice;
    this.bob = pair.bob;
    this.relay = pair.relay;
    if (this.args?.startOffline) this.relay.setOffline(true);
    const refresh = (): void => void this.requestUpdate();
    this.#cleanup = [
      this.relay.onChange(refresh),
      this.alice.source.history?.subscribe(refresh) ?? (() => {}),
      this.bob.source.history?.subscribe(refresh) ?? (() => {}),
    ];
  }
  #teardown(): void {
    for (const fn of this.#cleanup) fn();
    this.#cleanup = [];
    this.relay?.destroy();
    destroyPeer(this.alice);
    destroyPeer(this.bob);
  }
  protected flowOf(peer: Peer): XyFlowElement {
    return this.querySelector(`xy-flow[data-peer="${peer.id}"]`) as XyFlowElement;
  }
}

const styles = `
.sb-peer-head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--sb-border); background: var(--sb-surface); }
.sb-peer-head .sb-dot { width: 10px; height: 10px; border-radius: 50%; }
.sb-peer-head strong { font-size: 13px; }
.sb-split { display: flex; flex: 1; min-height: 0; }
.sb-split > .sb-col + .sb-col { border-left: 2px solid var(--sb-border); }
`;
let styled = false;
const ensureStyles = (): void => {
  if (styled) return;
  styled = true;
  document.head.append(Object.assign(document.createElement('style'), { textContent: styles }));
};

// ---- SideBySide -------------------------------------------------------------------------------------

class SideBySideStory extends PairStory {
  #added = 0;
  override connectedCallback(): void {
    ensureStyles();
    super.connectedCallback();
  }
  #panel(peer: Peer): TemplateResult {
    const history = peer.source.history;
    return html`
      <div class="sb-col">
        <div class="sb-peer-head">
          <span class="sb-dot" style="background: ${peer.color}"></span>
          <strong>${peer.name}</strong>
          <span class="sb-grow"></span>
          <button class="sb-btn" ?disabled=${!history?.canUndo()} @click=${() => history?.undo()}>
            Undo
          </button>
          <button class="sb-btn" ?disabled=${!history?.canRedo()} @click=${() => history?.redo()}>
            Redo
          </button>
          <button
            class="sb-btn"
            @click=${() => {
              const n = ++this.#added;
              const flow = this.flowOf(peer);
              const at = flow.screenToFlowPosition({
                x: flow.getBoundingClientRect().left + 120 + ((n * 37) % 160),
                y: flow.getBoundingClientRect().top + 90 + ((n * 53) % 160),
              });
              flow.addNodes({
                id: `${peer.id}-${n}`,
                position: at,
                data: { label: `${peer.name} ${n}` },
              });
            }}
          >
            Add node
          </button>
        </div>
        <xy-flow
          data-peer=${peer.id}
          .source=${once(() => peer.source)}
          ${fitWhenRendered()}
          .minZoom=${0.4}
        >
          <xy-background variant="dots"></xy-background>
          <xy-remote-cursors></xy-remote-cursors>
          <xy-presence-avatars></xy-presence-avatars>
        </xy-flow>
      </div>
    `;
  }
  override render() {
    const relay = this.relay;
    return html`
      <div class="sb-bar">
        <label class="sb-field">
          Latency
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            aria-label="Relay latency in milliseconds"
            .value=${String(relay.latency)}
            @input=${(e: Event) => {
              relay.latency = Number((e.target as HTMLInputElement).value);
              this.tick++;
            }}
          />
          <span class="sb-mono" style="min-width: 56px">${relay.latency} ms</span>
        </label>
        <button
          class="sb-btn"
          aria-pressed=${relay.offline}
          @click=${() => relay.setOffline(!relay.offline)}
        >
          ${relay.offline ? 'Offline: click to reconnect' : 'Go offline'}
        </button>
        <span class="sb-pill ${relay.offline ? 'warn' : relay.pending ? 'plain' : 'ok'}">
          ${relay.offline ? `${relay.pending} updates held` : relay.pending ? `${relay.pending} in flight` : 'in sync'}
        </span>
        <span class="sb-grow"></span>
        <span class="sb-muted"
          >Drag, connect and type on either side. Undo only reverts your own edits.</span
        >
        <button class="sb-btn" @click=${() => this.reset()}>Reset</button>
      </div>
      ${keyed(
        this.run,
        html`<div class="sb-split">${this.#panel(this.alice)} ${this.#panel(this.bob)}</div>`,
      )}
    `;
  }
}
defineStoryElement('sb-side-by-side', SideBySideStory);

export const SideBySide: Story = {
  args: { latency: 400, startOffline: false },
  render: (args) => html`<sb-side-by-side .args=${args}></sb-side-by-side>`,
  parameters: describe(
    'Two flows bound to two in-memory `Y.Doc`s through `YjsFlowSource`, joined by a relay that delays every update (use the slider). Move the pointer over one side and a labelled cursor appears on the other; while you drag a node the other side sees it move live (live drags travel through awareness and are written to the document once, on drop); selecting a node shows a coloured outline on the other side. Undo and Redo are per user: Alice undoing never reverts Bob. Go offline, edit both sides, then reconnect to watch the merge.',
  ),
};

// ---- RepairDemo -------------------------------------------------------------------------------------

type Step = 0 | 1 | 2 | 3;

class RepairStory extends PairStory {
  static override properties = {
    ...PairStory.properties,
    step: { state: true },
    log: { state: true },
  };
  declare step: Step;
  declare log: string[];
  constructor() {
    super();
    this.step = 0;
    this.log = [];
  }
  override connectedCallback(): void {
    ensureStyles();
    super.connectedCallback();
    // this story is about the offline merge: the relay starts latency-free
    this.relay.latency = 150;
  }
  #note(text: string): void {
    this.log = [...this.log.slice(-6), text];
  }
  #errors(peer: Peer) {
    return on({
      'flow-error': (e) => {
        const d = (e as CustomEvent<{ code: string; message: string }>).detail;
        this.#note(`${peer.name} sees ${d.code}: ${d.message}`);
      },
    });
  }
  protected override reset(): void {
    this.step = 0;
    this.log = [];
    super.reset();
    this.relay.latency = 150;
  }
  #do(step: Step): void {
    if (step === 1) {
      this.relay.setOffline(true);
      this.#note('Connection cut: edits stay local.');
    } else if (step === 2) {
      void this.flowOf(this.alice).deleteElements({ nodes: [{ id: 'design' }] });
      this.flowOf(this.bob).addEdges({
        id: 'bob-design-build',
        source: 'design',
        target: 'build',
      });
      this.#note('Alice deleted "Design" while Bob connected "Design" to "Build".');
    } else if (step === 3) {
      this.relay.setOffline(false);
      this.#note('Reconnected: both edits merge. The new edge now points at a deleted node.');
    }
    this.step = step;
  }
  #panel(peer: Peer): TemplateResult {
    return html`
      <div class="sb-col">
        <div class="sb-peer-head">
          <span class="sb-dot" style="background: ${peer.color}"></span>
          <strong>${peer.name}</strong>
        </div>
        <xy-flow
          data-peer=${peer.id}
          .source=${once(() => peer.source)}
          ${fitWhenRendered()}
          ${this.#errors(peer)}
        >
          <xy-background variant="dots"></xy-background>
          <xy-remote-cursors></xy-remote-cursors>
        </xy-flow>
      </div>
    `;
  }
  override render() {
    const steps: [Step, string][] = [
      [1, '1. Go offline'],
      [2, '2. Edit concurrently'],
      [3, '3. Reconnect'],
    ];
    return html`
      <div class="sb-bar">
        ${steps.map(
          ([n, label]) =>
            html`<button
              class="sb-btn ${this.step === n - 1 ? 'sb-primary' : ''}"
              ?disabled=${this.step !== n - 1}
              @click=${() => this.#do(n)}
            >
              ${label}
            </button>`,
        )}
        <button class="sb-btn" @click=${() => this.reset()}>Reset</button>
        <span class="sb-grow"></span>
        <span class="sb-pill ${this.relay.offline ? 'warn' : 'ok'}"
          >${this.relay.offline ? 'offline' : 'online'}</span
        >
      </div>
      ${keyed(this.run, html`<div class="sb-split">${this.#panel(this.alice)} ${this.#panel(this.bob)}</div>`)}
      <div
        class="sb-bar"
        style="border-top: 1px solid var(--sb-border); border-bottom: 0; min-height: 56px; align-items: flex-start"
      >
        <ul class="sb-log" aria-live="polite" style="flex: 1">
          ${
            this.log.length
              ? this.log.map((l) => html`<li>${l}</li>`)
              : html`<li>
                  Run the three steps: delete a node on one side while the other connects it, then
                  reconnect.
                </li>`
          }
        </ul>
      </div>
    `;
  }
}
defineStoryElement('sb-repair', RepairStory);

export const RepairDemo: Story = {
  render: (args) => html`<sb-repair .args=${args}></sb-repair>`,
  parameters: describe(
    'A concurrent delete and connect, the classic way a CRDT graph breaks. Alice deletes a node while Bob (offline) draws an edge to it. After the merge the document holds an edge whose target no longer exists. `YjsFlowSource` heals this: every client renders the repaired graph immediately, one client writes the repair back (not undoable), and a `flow-error` event with code `XYL20` tells the app what was removed.',
  ),
};
