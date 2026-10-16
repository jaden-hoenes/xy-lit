import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { defineNodeType, devWarn } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';
import { defaultShapes } from './registry.js';
import type { ShapeRegistry } from './registry.js';
import { uiStyles } from '../styles.js';

/** `data` of a {@link shapeNode}. */
export type ShapeNodeData = {
  /** Name of a shape in the registry. */
  shape: string;
  /** Text inside the shape (rendered as text). */
  label?: string;
  /** CSS colour of the outline; the fill is a light tint of it. */
  color?: string;
  /** Registry to look the shape up in. Default {@link defaultShapes}. */
  registry?: ShapeRegistry;
  [key: string]: unknown;
};

const warned = new Set<string>();
const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 80;

/**
 * A node drawn as an SVG shape from a {@link ShapeRegistry}, with the label in the shape's text box
 * and handles at the shape's connection points (ids `top`, `right`, `bottom`, `left` for the built-in
 * shapes; each point has a `source` and a `target` handle on top of each other, so any of them
 * connects in both directions). Resizable (`variant: 'handles'`, minimum 40x40); the outline is
 * redrawn at the node's size.
 *
 * Unknown shape names render a plain rectangle and warn in the console.
 */
export const shapeNode = defineNodeType<Node<ShapeNodeData>>({
  styles: uiStyles,
  resizer: { variant: 'handles', minWidth: 40, minHeight: 40 },
  render: ({ data, width, height, selected }): TemplateResult => {
    const registry = data.registry ?? defaultShapes;
    let def = registry.get(data.shape);
    if (!def) {
      if (!warned.has(data.shape)) {
        warned.add(data.shape);
        devWarn('XYL40', `Unknown shape "${data.shape}"; drawing a rectangle.`);
      }
      def = defaultShapes.get('rectangle')!;
    }
    const w = width !== undefined && width > 0 ? width : DEFAULT_WIDTH;
    const h = height !== undefined && height > 0 ? height : DEFAULT_HEIGHT;
    const text = def.textBox(w, h);
    const handles = def.handles(w, h);
    const vars = { width: `${w}px`, height: `${h}px`, '--xy-shape-color': data.color ?? null };
    return html`<div class="xy-ui-shape ${selected ? 'selected' : ''}" style=${styleMap(vars)}>
      <svg
        class="xy-ui-shape__svg"
        viewBox="0 0 ${w} ${h}"
        width=${w}
        height=${h}
        aria-hidden="true"
      >
        <path class="xy-ui-shape__path" d=${def.path(w, h)}></path>
      </svg>
      ${
        data.label
          ? html`<div
              class="xy-ui-shape__text"
              style=${styleMap({
                left: `${text.x}px`,
                top: `${text.y}px`,
                width: `${text.width}px`,
                height: `${text.height}px`,
              })}
            >
              <span>${data.label}</span>
            </div>`
          : nothing
      }
      ${handles.flatMap((p) =>
        (p.type ? [p.type] : (['target', 'source'] as const)).map(
          (type) =>
            html`<xy-handle
              class="xy-ui-handle xy-ui-shape__handle"
              type=${type}
              position=${p.position}
              handle-id=${p.id}
              style=${styleMap({ left: `${p.x}px`, top: `${p.y}px` })}
            ></xy-handle>`,
        ),
      )}
    </div>`;
  },
});
