// Ported from xyflow (MIT) packages/react/src/additional-components/Background/Background.tsx, Patterns.tsx@3d35b57
import { html, svg } from 'lit';
import type { TemplateResult } from 'lit';
import { shallow } from '@xy-lit/store';
import type { Transform } from '@xy-lit/store';
import { StoreController } from '../controllers/store-controller.js';
import { numberAttr, numberOrPairAttr } from '../elements/xy-flow/attributes.js';
import { FlowPluginElement } from './plugin-base.js';

/** Background pattern. */
export type BackgroundVariant = 'dots' | 'lines' | 'cross';

const DEFAULT_SIZE: Record<BackgroundVariant, number> = { dots: 1, lines: 1, cross: 6 };

/**
 * A pattern behind the flow that moves and scales with the viewport (React `Background`). Give
 * every background of one flow a unique `bg-id` when combining several.
 *
 * @csspart background - The `<svg>` element.
 * @tag xy-background
 */
export class XyBackgroundElement extends FlowPluginElement {
  static override properties = {
    bgId: { attribute: 'bg-id' },
    variant: { reflect: true },
    gap: { converter: numberOrPairAttr(20) },
    size: { converter: numberAttr(0) },
    lineWidth: { attribute: 'line-width', converter: numberAttr(1) },
    offset: { converter: numberOrPairAttr(0) },
    color: {},
    bgColor: { attribute: 'bg-color' },
    patternClass: { attribute: 'pattern-class' },
  };

  /** Distinguishes several backgrounds of one flow (part of the pattern id). */
  declare bgId: string;
  /** `dots` (default), `lines` or `cross`. */
  declare variant: BackgroundVariant;
  /** Distance between pattern cells in flow units, or `[x, y]`. Default 20. */
  declare gap: number | [number, number];
  /** Size of a dot / cross arm in flow units. Default 1 (dots, lines) or 6 (cross). */
  declare size: number | undefined;
  /** Stroke width of lines and crosses. Default 1. */
  declare lineWidth: number;
  /** Shifts the pattern, in flow units, or `[x, y]`. Default 0. */
  declare offset: number | [number, number];
  /** Colour of the pattern (`--xy-background-pattern-color-props`). */
  declare color: string | undefined;
  /** Colour behind the pattern (`--xy-background-color-props`). */
  declare bgColor: string | undefined;
  /** Extra class of the pattern element. */
  declare patternClass: string | undefined;

  readonly #view = new StoreController<readonly [Transform, string]>(
    this,
    (s) => [s.transform, s.flowId] as const,
    shallow,
  );

  constructor() {
    super();
    this.bgId = '';
    this.variant = 'dots';
    this.gap = 20;
    this.size = undefined;
    this.lineWidth = 1;
    this.offset = 0;
    this.color = undefined;
    this.bgColor = undefined;
    this.patternClass = undefined;
  }

  protected override render(): TemplateResult | string {
    if (!this.store) return '';
    const [transform, flowId] = this.#view.value;
    const [tx, ty, zoom] = transform;
    const variant = this.variant;
    const isDots = variant === 'dots';
    const isCross = variant === 'cross';
    const gapXY: [number, number] = Array.isArray(this.gap) ? this.gap : [this.gap, this.gap];
    const scaledGap: [number, number] = [gapXY[0] * zoom || 1, gapXY[1] * zoom || 1];
    const scaledSize = (this.size || DEFAULT_SIZE[variant]) * zoom;
    const offsetXY: [number, number] = Array.isArray(this.offset)
      ? this.offset
      : [this.offset, this.offset];
    const dimensions: [number, number] = isCross ? [scaledSize, scaledSize] : scaledGap;
    const scaledOffset: [number, number] = [
      offsetXY[0] * zoom + dimensions[0] / 2,
      offsetXY[1] * zoom + dimensions[1] / 2,
    ];
    const patternId = `pattern-${flowId}${this.bgId}`;
    const patternClass = this.patternClass ?? '';
    const radius = scaledSize / 2;
    const pattern = isDots
      ? svg`<circle cx=${radius} cy=${radius} r=${radius}
          class="lit-flow__background-pattern dots ${patternClass}"></circle>`
      : svg`<path stroke-width=${this.lineWidth}
          d="M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}"
          class="lit-flow__background-pattern ${variant} ${patternClass}"></path>`;
    const style =
      (this.bgColor ? `--xy-background-color-props:${this.bgColor};` : '') +
      (this.color ? `--xy-background-pattern-color-props:${this.color};` : '');
    return html`<svg
      class="lit-flow__background lit-flow__container"
      data-testid="rf__background"
      part="background"
      style=${style}
    >
      <pattern
        id=${patternId}
        x=${tx % scaledGap[0]}
        y=${ty % scaledGap[1]}
        width=${scaledGap[0]}
        height=${scaledGap[1]}
        patternUnits="userSpaceOnUse"
        patternTransform=${`translate(-${scaledOffset[0]},-${scaledOffset[1]})`}
      >
        ${pattern}
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill=${`url(#${patternId})`}></rect>
    </svg>`;
  }
}
