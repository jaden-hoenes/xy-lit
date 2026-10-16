// Ported from xyflow (MIT) packages/svelte/src/lib/actions/zoom/index.ts, packages/react/src/container/ZoomPane/index.tsx, packages/react/src/hooks/useViewportSync.ts@3d35b57
import { LIB, shallow } from '@xy-lit/store';
import { XYPanZoom } from '@xy-lit/store/internal';
import type {
  PanOnScrollMode,
  PanZoomInstance,
  PanZoomUpdateOptions,
  Transform,
  Viewport,
} from '@xy-lit/store';
import type { ReactiveController } from 'lit';
import type { XyFlowElement } from '../xy-flow.js';

/**
 * Owns the `XYPanZoom` instance of a flow: creates it on the zoom element, keeps its options in
 * sync with the element's properties and key state, writes the viewport transform straight to
 * the DOM (never through a template) and applies a controlled `viewport`.
 */
export class PanZoomController implements ReactiveController {
  private panZoom: PanZoomInstance | null = null;
  private viewportEl: HTMLElement | null = null;
  private lastParams: PanZoomUpdateOptions | null = null;
  private initEmitted = false;
  private lastTransform: Transform | null = null;

  constructor(private readonly host: XyFlowElement) {
    host.addController(this);
  }

  hostConnected(): void {
    // initialised from the host's firstUpdated / init flag
  }

  hostUpdated(): void {
    this.update();
  }

  hostDisconnected(): void {
    this.destroy();
  }

  /** Whether an engine instance exists. */
  get instance(): PanZoomInstance | null {
    return this.panZoom;
  }

  /**
   * Create the engine on the zoom element and publish it to the store.
   *
   * @param zoomEl - The `.lit-flow__renderer` element d3-zoom listens on.
   * @param viewportEl - The `.lit-flow__viewport` element that receives the transform.
   */
  init(zoomEl: HTMLElement, viewportEl: HTMLElement): void {
    this.destroy();
    this.lastTransform = null;
    const { store } = this.host;
    const { minZoom, maxZoom, translateExtent } = store.getState();
    const initial = this.host.initialViewport;
    this.viewportEl = viewportEl;
    this.panZoom = XYPanZoom({
      domNode: zoomEl,
      minZoom,
      maxZoom,
      translateExtent,
      viewport: initial,
      onDraggingChange: (paneDragging) => {
        if (store.getState().paneDragging !== paneDragging) store.setState({ paneDragging });
      },
      onPanZoomStart: (event, viewport) => {
        this.host.emit('move-start', { event, viewport });
      },
      onPanZoom: (event, viewport) => {
        this.host.emit('move', { event, viewport });
      },
      onPanZoomEnd: (event, viewport) => {
        this.host.emit('move-end', { event, viewport });
      },
    });
    const vp = this.panZoom.getViewport();
    this.applyTransform(vp);
    store.setState({ panZoom: this.panZoom, transform: [vp.x, vp.y, vp.zoom] });
    this.lastParams = null;
    this.update();
    if (!this.initEmitted) {
      this.initEmitted = true;
      this.host.emit('init', { instance: store.instance });
    }
    // a fit queued before the engine existed can run now
    void store.resolveFitView();
  }

  /** Push the current options to the engine (skipped when nothing changed). */
  update(): void {
    const { panZoom } = this;
    if (!panZoom) return;
    const { host } = this;
    const s = host.store.getState();
    const interaction = host.pane.interaction;
    const params: PanZoomUpdateOptions = {
      noWheelClassName: s.noWheelClassName,
      noPanClassName: s.noPanClassName,
      onPaneContextMenu: undefined,
      preventScrolling: host.preventScrolling,
      panOnScroll: interaction.panOnScroll,
      // the selection key hands the primary drag to the selection rectangle (React FlowRenderer)
      panOnDrag: !interaction.selectionKeyPressed && interaction.panOnDrag,
      panActivationKeyPressed: s.panActivationKeyPressed,
      panOnScrollMode: host.panOnScrollMode as PanOnScrollMode,
      panOnScrollSpeed: host.panOnScrollSpeed,
      userSelectionActive: s.userSelectionActive,
      zoomOnPinch: host.zoomOnPinch,
      zoomOnScroll: host.zoomOnScroll,
      zoomOnDoubleClick: host.zoomOnDoubleClick,
      zoomActivationKeyPressed: s.zoomActivationKeyPressed,
      lib: LIB,
      onTransformChange: this.onTransformChange,
      connectionInProgress: s.connection.inProgress,
      paneClickDistance: host.paneClickDistance,
      selectionOnDrag: interaction.selectionOnDrag,
    };
    if (this.lastParams && shallow(this.lastParams, params)) return;
    this.lastParams = params;
    panZoom.update(params);
  }

  /**
   * Make the engine follow a controlled `viewport` (React `useViewportSync`).
   *
   * @param viewport - The viewport the app wants, or undefined (uncontrolled).
   */
  syncViewport(viewport: Viewport | undefined): void {
    if (!viewport || !this.panZoom) return;
    this.panZoom.syncViewport(viewport);
    this.applyTransform(viewport);
    this.host.store.setState({ transform: [viewport.x, viewport.y, viewport.zoom] });
  }

  /** Tear the engine down (the element is disconnected or re-initialised). */
  destroy(): void {
    if (!this.panZoom) return;
    this.panZoom.destroy();
    this.panZoom = null;
    this.lastParams = null;
    this.host.store.setState({ panZoom: null });
  }

  /**
   * Write the transform to the viewport element. Never goes through a Lit template: panning must
   * not trigger an update cycle.
   *
   * @param viewport - The viewport to show.
   */
  applyTransform(viewport: Viewport): void {
    const last = this.lastTransform;
    if (last && last[0] === viewport.x && last[1] === viewport.y && last[2] === viewport.zoom) {
      return;
    }
    // `--xy-zoom` inherits, so writing it restyles the whole subtree below the element that carries
    // it (about 90 ms per frame for 5000 nodes during a zoom). Only the edge labels read it
    // (edge toolbars), so it lives on the label layer and the nodes and edges are never restyled.
    const zoomChanged = !last || last[2] !== viewport.zoom;
    this.lastTransform = [viewport.x, viewport.y, viewport.zoom];
    if (this.viewportEl) {
      if (zoomChanged) {
        const labels = this.viewportEl.querySelector(':scope > .lit-flow__edgelabel-renderer');
        (labels as HTMLElement | null)?.style.setProperty('--xy-zoom', String(viewport.zoom));
      }
      this.viewportEl.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
    }
  }

  private readonly onTransformChange = (t: Transform): void => {
    const viewport = { x: t[0], y: t[1], zoom: t[2] };
    this.applyTransform(viewport);
    this.host.store.setViewportFromPanZoom(viewport);
    if (this.host.hasListener('viewport-change')) this.host.emit('viewport-change', { viewport });
  };
}
