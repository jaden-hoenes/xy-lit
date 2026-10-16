import { ContextConsumer } from '@lit/context';
import { LitElement, css } from 'lit';
import type { CSSResult } from 'lit';
import { devWarn } from '@xy-lit/store';
import { flowContext } from '../context.js';
import type { FlowContextValue } from '../context.js';
import { baseSheets, defaultSheets, sheetOf } from '../styles/sheets.js';

/** Host rule shared by every plugin: the host takes no box, its panel positions against the flow. */
const hostStyles = css`
  :host {
    display: contents;
    contain: none;
    overflow: visible;
  }
  :host([hidden]) {
    display: none;
  }
`;

/**
 * Base class of the plugin elements (`<xy-panel>`, `<xy-background>`, `<xy-controls>`,
 * `<xy-minimap>`): a light-DOM child of `<xy-flow>` with its own shadow root, the flow's
 * stylesheet adopted into it and `display: contents`, so its inner `.lit-flow__panel` positions
 * against the flow wrapper.
 *
 * The store comes through `flowContext` (see `StoreController`). A plugin outside any flow or
 * provider renders nothing and warns once in development.
 */
export abstract class FlowPluginElement extends LitElement {
  /** Extra styles of the plugin, adopted after the flow's sheets. */
  static pluginStyles?: CSSResult;

  /** The context value once a flow or provider answered. */
  protected flowValue: FlowContextValue | undefined;
  #root: ShadowRoot | null = null;
  #unstyled: boolean | undefined;
  #consumer = new ContextConsumer(this, {
    context: flowContext,
    subscribe: true,
    callback: (value) => {
      this.flowValue = value;
      this.#adoptSheets();
      this.requestUpdate();
    },
  });

  /** @internal Keeps the consumer referenced (it registers itself on the host). */
  get consumer(): ContextConsumer<typeof flowContext, this> {
    return this.#consumer;
  }

  protected override createRenderRoot(): ShadowRoot {
    this.#root = super.createRenderRoot() as ShadowRoot;
    this.#adoptSheets();
    return this.#root;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => {
      if (this.isConnected && !this.flowValue?.store) {
        devWarn(
          'XYL06',
          `<${this.localName}> must be placed inside <xy-flow> or <xy-flow-provider>; it renders nothing otherwise.`,
        );
      }
    });
  }

  #adoptSheets(): void {
    const root = this.#root;
    if (!root) return;
    const unstyled = this.flowValue?.flow?.unstyled ?? false;
    if (unstyled === this.#unstyled && root.adoptedStyleSheets.length > 0) return;
    this.#unstyled = unstyled;
    const ctor = this.constructor as typeof FlowPluginElement;
    const sheets = [
      ...(unstyled ? baseSheets : defaultSheets),
      sheetOf(hostStyles),
      ...(ctor.pluginStyles ? [sheetOf(ctor.pluginStyles)] : []),
    ];
    root.adoptedStyleSheets = [...new Set(sheets)];
  }

  /** The store of the enclosing flow or provider, if any. */
  protected get store(): FlowContextValue['store'] | undefined {
    return this.flowValue?.store;
  }
}

/**
 * Class names of a panel position: `top-right` gives `top right` (`center` is a class like the
 * others, as in React).
 *
 * @param position - A panel position.
 */
export function positionClasses(position: string): string {
  return position.split('-').join(' ');
}
