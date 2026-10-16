import type { XYPosition } from '@xy-lit/store';
import { jsonEqual } from './schema.js';

/** Local-only state of a node (spec/11 §Local overlay). Never written to the document. */
export type NodeOverlay = {
  selected?: boolean;
  dragging?: boolean;
  resizing?: boolean;
  measured?: { width?: number; height?: number };
  /** Position during a local drag/resize gesture. */
  livePosition?: XYPosition;
  /** Size during a local resize gesture. */
  liveSize?: { width: number; height: number };
};

/** Local-only state of an edge. */
export type EdgeOverlay = { selected?: boolean };

/** `undefined` members mean "remove this field". */
type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/**
 * The local state that lives next to the shared document: selection, drag/resize flags,
 * measurements and the live geometry of a gesture in progress. Entries of ids that no longer
 * exist in the document are dropped by the materialiser.
 */
export class LocalOverlay {
  readonly nodes = new Map<string, NodeOverlay>();
  readonly edges = new Map<string, EdgeOverlay>();

  /**
   * @param onDirty - Called with the id of every node or edge whose overlay changed.
   * @param onSelection - Called when the set of selected nodes or edges changed.
   */
  constructor(
    private readonly onDirty: (kind: 'node' | 'edge', id: string) => void,
    private readonly onSelection?: () => void,
  ) {}

  /** The overlay of a node, if any. */
  getNode(id: string): NodeOverlay | undefined {
    return this.nodes.get(id);
  }

  /** The overlay of an edge, if any. */
  getEdge(id: string): EdgeOverlay | undefined {
    return this.edges.get(id);
  }

  /**
   * Merge a patch into a node's overlay (`undefined` removes a field).
   *
   * @returns Whether anything changed.
   */
  patchNode(id: string, patch: Patch<NodeOverlay>): boolean {
    const current = this.nodes.get(id);
    const next: Record<string, unknown> = { ...current };
    let changed = false;
    for (const key of Object.keys(patch) as (keyof NodeOverlay)[]) {
      const value = patch[key];
      if (value === undefined) {
        if (key in next) {
          delete next[key];
          changed = true;
        }
      } else if (!jsonEqual(next[key], value)) {
        next[key] = value;
        changed = true;
      }
    }
    if (!changed) return false;
    const selectionChanged = !!current?.selected !== !!next.selected;
    if (Object.keys(next).length) this.nodes.set(id, next);
    else this.nodes.delete(id);
    this.onDirty('node', id);
    if (selectionChanged) this.onSelection?.();
    return true;
  }

  /** Merge a patch into an edge's overlay. */
  patchEdge(id: string, patch: Patch<EdgeOverlay>): boolean {
    const current = this.edges.get(id);
    const selected = patch.selected;
    if (selected === undefined ? current?.selected === undefined : current?.selected === selected) {
      return false;
    }
    const wasSelected = !!current?.selected;
    if (selected === undefined) this.edges.delete(id);
    else this.edges.set(id, { selected });
    this.onDirty('edge', id);
    if (wasSelected !== !!selected) this.onSelection?.();
    return true;
  }

  /** Ids of the selected nodes. */
  selectedNodeIds(): string[] {
    const ids: string[] = [];
    for (const [id, o] of this.nodes) if (o.selected) ids.push(id);
    return ids;
  }

  /** Ids of the selected edges. */
  selectedEdgeIds(): string[] {
    const ids: string[] = [];
    for (const [id, o] of this.edges) if (o.selected) ids.push(id);
    return ids;
  }

  /** Drop the entries of ids that do not exist any more (no dirty notification). */
  prune(nodeExists: (id: string) => boolean, edgeExists: (id: string) => boolean): void {
    let selection = false;
    for (const [id, o] of this.nodes) {
      if (nodeExists(id)) continue;
      if (o.selected) selection = true;
      this.nodes.delete(id);
    }
    for (const [id, o] of this.edges) {
      if (edgeExists(id)) continue;
      if (o.selected) selection = true;
      this.edges.delete(id);
    }
    if (selection) this.onSelection?.();
  }

  /** Remove everything. */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}
