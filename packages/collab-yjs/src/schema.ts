import * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';

/** Version written to `meta.schema` (spec/11 §Schema). */
export const SCHEMA_VERSION = 1;

/** Names of the three top-level maps of the document (`keys` option of `YjsFlowSource`). */
export type DocKeys = { nodes: string; edges: string; meta: string };
/** The default top-level map names. */
export const DEFAULT_KEYS: Readonly<DocKeys> = { nodes: 'nodes', edges: 'edges', meta: 'meta' };

/** Resolve a partial `keys` option. */
export const resolveKeys = (keys?: Partial<DocKeys>): DocKeys => ({ ...DEFAULT_KEYS, ...keys });

/** The three top-level maps of a document. */
export type DocMaps = {
  nodes: Y.Map<Y.Map<unknown>>;
  edges: Y.Map<Y.Map<unknown>>;
  meta: Y.Map<unknown>;
};

/** Get (creating on first access) the three top-level maps. */
export function getMaps(doc: Y.Doc, keys?: Partial<DocKeys>): DocMaps {
  const k = resolveKeys(keys);
  return {
    nodes: doc.getMap<Y.Map<unknown>>(k.nodes),
    edges: doc.getMap<Y.Map<unknown>>(k.edges),
    meta: doc.getMap<unknown>(k.meta),
  };
}

/** Node fields that only live in the local overlay and are never written to the document. */
export const NODE_LOCAL_KEYS: ReadonlySet<string> = new Set([
  'selected',
  'dragging',
  'resizing',
  'measured',
  'remote',
  'internals',
]);
/** Edge fields that only live in the local overlay. */
export const EDGE_LOCAL_KEYS: ReadonlySet<string> = new Set(['selected']);

/** Key of the fractional index inside a node/edge map. It is not a field of `Node`/`Edge`. */
export const ORDER_KEY = 'order';

/** Error code of a value that cannot be stored (functions, symbols, ...). */
export const XYL10 = 'XYL10';

/** Thrown by {@link toYNode} / {@link toYEdge} for values that are not JSON-safe. */
export class SchemaError extends Error {
  /** The error code, `XYL10` for a value that cannot be stored. */
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'SchemaError';
    this.code = code;
  }
}

/**
 * Deep-clone a plain JSON value. Functions, symbols and bigints throw `XYL10`; `undefined`
 * object members are dropped (array members become `null`, as in JSON).
 */
export function cloneJson(value: unknown, path = ''): unknown {
  switch (typeof value) {
    case 'function':
    case 'symbol':
    case 'bigint':
      throw new SchemaError(
        XYL10,
        `${typeof value} at "${path || '<root>'}" cannot be stored in the document`,
      );
    case 'object': {
      if (value === null) return null;
      if (Array.isArray(value)) {
        return value.map((v, i) => (v === undefined ? null : cloneJson(v, `${path}[${i}]`)));
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) {
        throw new SchemaError(
          XYL10,
          `non-plain object at "${path || '<root>'}" cannot be stored in the document`,
        );
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) out[k] = cloneJson(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    default:
      return value;
  }
}

/** Structural equality of two JSON values. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.hasOwn(b, k)) return false;
    if (!jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

/** Build the `data` map of a node or edge. Keys in `richText` that hold a string become `Y.Text`. */
function toYData(data: Record<string, unknown>, richText: readonly string[]): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (richText.includes(k) && typeof v === 'string') y.set(k, new Y.Text(v));
    else y.set(k, cloneJson(v, `data.${k}`));
  }
  return y;
}

/**
 * Convert a node to a (not yet integrated) `Y.Map`.
 *
 * @param node - The node. Local fields (`selected`, `measured`, ...) are skipped.
 * @param order - Fractional index of the node.
 * @param richText - Keys of `data` stored as `Y.Text`.
 * @throws SchemaError (`XYL10`) when a value is not JSON-safe.
 */
export function toYNode(
  node: Node,
  order: string,
  richText: readonly string[] = [],
): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(node)) {
    if (v === undefined || NODE_LOCAL_KEYS.has(k) || k === ORDER_KEY) continue;
    if (k === 'data' || k === 'position') continue;
    y.set(k, cloneJson(v, k));
  }
  y.set('position', cloneJson(node.position ?? { x: 0, y: 0 }, 'position'));
  y.set('data', toYData(node.data ?? {}, richText));
  y.set(ORDER_KEY, order);
  return y;
}

/** Convert an edge to a (not yet integrated) `Y.Map`. */
export function toYEdge(edge: Edge, order: string): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(edge)) {
    if (v === undefined || EDGE_LOCAL_KEYS.has(k) || k === ORDER_KEY || k === 'data') continue;
    y.set(k, cloneJson(v, k));
  }
  if (edge.data !== undefined) y.set('data', toYData(edge.data, []));
  y.set(ORDER_KEY, order);
  return y;
}

/** Read a `data` map into a plain object (`Y.Text` values become strings). */
export function fromYData(value: unknown): Record<string, unknown> {
  if (value instanceof Y.Map) {
    const out: Record<string, unknown> = {};
    value.forEach((v, k) => {
      out[k] = v instanceof Y.Text ? v.toJSON() : v;
    });
    return out;
  }
  if (typeof value === 'object' && value !== null) return { ...(value as Record<string, unknown>) };
  return {};
}

/** The fractional index stored in a node or edge map (`''` when missing). */
export function getOrder(y: Y.Map<unknown>): string {
  const order = y.get(ORDER_KEY);
  return typeof order === 'string' ? order : '';
}

/** Read a node map into a plain node (without `order`; `Y.Text` becomes a string). */
export function fromYNode(y: Y.Map<unknown>): Node {
  const out: Record<string, unknown> = {};
  y.forEach((v, k) => {
    if (k === ORDER_KEY) return;
    if (k === 'data') out.data = fromYData(v);
    else if (k === 'position') {
      const p = v as { x?: number; y?: number } | undefined;
      out.position = { x: p?.x ?? 0, y: p?.y ?? 0 };
    } else out[k] = v;
  });
  if (!('data' in out)) out.data = {};
  if (!('position' in out)) out.position = { x: 0, y: 0 };
  return out as unknown as Node;
}

/** Read an edge map into a plain edge (without `order`). */
export function fromYEdge(y: Y.Map<unknown>): Edge {
  const out: Record<string, unknown> = {};
  y.forEach((v, k) => {
    if (k === ORDER_KEY) return;
    out[k] = k === 'data' ? fromYData(v) : v;
  });
  return out as unknown as Edge;
}
