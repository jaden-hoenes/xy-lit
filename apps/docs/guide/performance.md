# Performance

The numbers below are measured, not hoped for: `pnpm perf` runs `tests/perf` against the stress pages in headless
Chromium and records every run. Read them with the caveats stated next to them.

## Measured results

p95 frame time during a programmatic pan, zoom and a node drag, plus the time from assigning the nodes to
`render-complete`. Host: the development machine, headless Chromium with **software compositing**, load average 2 to 5.
Frame deltas are multiples of 16.67 ms.

| Scenario | 1 000 nodes | 5 000 | 10 000 | Spec budget (1k / 5k / 10k) |
|---|---|---|---|---|
| **Everything on screen** (`fit-view`): render-complete | 223 ms | 1 050 ms | 2 252 ms | 1 500 / 5 000 / 10 000 ms |
| everything on screen: pan | 16.8 ms | 33.4 ms | 66.6 ms | 16.7 / 16.7 / 33 ms |
| everything on screen: zoom | 16.7 ms | 33.4 ms | 66.7 ms | (same as pan) |
| everything on screen: drag one node | 16.7 ms | 33.4 ms (50 once) | 83.3 ms (100 once) | 16.7 / 25 / 33 ms |
| **Windowed** (`only-render-visible-elements`, zoom 1, about 90 nodes in the DOM): pan, zoom, drag | 16.7 ms | 16.7 ms | 16.7 ms | 16.7 ms |

What that means, honestly:

- **Windowed and culled graphs meet the spec at every size** that was tested, up to 10 000 nodes and 9 999 edges: 60 fps
  for panning, zooming and dragging.
- **1 000 nodes fully on screen meets the spec.**
- **5 000 and 10 000 nodes fully on screen do not meet the spec budgets on this host.** They run at roughly 30 fps (5k)
  and 15 fps (10k) here. The enforced limits in `tests/perf/budgets.ts` are *calibrated regression guards* above the
  measured numbers (66.7 ms at 5k, 133.4 ms at 10k for pan and zoom, 150 ms for drag at 10k), recorded next to the spec
  value in `results.json` (`meetsSpec: false`). They are not claims that those frame times are good.
- **Why**: with every node visible the main thread spends about 3 microseconds per node and frame in Blink's
  *Layerize* step (every node and every handle has a CSS transform, about three paint chunks per node). JavaScript
  stays under 1 ms per frame. Real GPU-composited browsers should do better; the limits are to be re-calibrated on CI
  hardware. WebKit and Firefox were not measured (the perf suite runs Chromium only by design).

Nobody looks at 10 000 unreadable boxes at once. Where a graph that big matters, use culling, the mini map and
zoom-dependent detail.

<Demo name="performance" :height="420" caption="Run it on your hardware. The probe pans the viewport for two seconds and reports the p95 frame time like the perf suite does." />

## Turning culling on

```html
<xy-flow only-render-visible-elements min-zoom="0.02" fit-view></xy-flow>
```

`only-render-visible-elements` renders only the nodes and edges inside the viewport (plus the nodes an edge needs). It
keeps the DOM small at any graph size. Two things to know: measuring waits only for the visible nodes, and the
filter itself is O(n) per viewport change (small next to DOM work, but visible at 10 000 nodes). Lower `min-zoom` if
users should be able to zoom far out; the default of 0.5 cuts a big grid off.

## Keeping a flow fast

- **Cull** first. It is the difference between 66 ms and 16.7 ms at 5 000 nodes.
- **Keep node markup small.** Cost is per node: avoid deep trees, large images and per-node animations. Drawing a node
  with one `div` and a few text nodes is cheap; each `<xy-handle>` is an element with a transform, so use only the
  handles you need (hiding them would halve the frame cost, but their `transform` comes from the upstream stylesheet).
- **Do not read `--xy-zoom` on the viewport.** The flow keeps it on the edge-label layer for edge toolbars. Writing
  an inherited custom property on the viewport once restyled every element on each zoom frame (about 90 ms per frame
  at 5 000 nodes; panning with an animated zoom hit it too). If your CSS reads `--xy-zoom`, read it inside the label
  layer.
- **Do not add `will-change` to the viewport.** It made things ten times worse in the measurements.
- **Batch your own writes.** Many `flow.updateNodeData()` calls in one task are fine (notifications coalesce per
  microtask), but a data source that persists should group them: a Yjs source offers `transact(fn)`, which is also one
  undo step.
- **Controlled flows**: applying changes with `applyNodeChanges` copies only the changed nodes and keeps the identity of
  the rest, so unchanged nodes do not re-render. Do not rebuild the whole array with new objects on every change.
- **Events cost only when used.** The flow does no pointer-event work for events nobody listens to
  (`node-pointer-move`, `pane-pointer-move`, `viewport-change` and friends).
- **Motion** switches itself off above `motion-max-nodes` (300 visible nodes).
- **Parallel edges** and **edge labels** are per-edge work; labels are HTML. Many thousands of labelled edges are
  heavy, so show labels only for a selection or above a zoom.
- **Layout** in `@xy-lit/pro` runs in a worker, so a big dagre or ELK layout does not freeze the page.

## What the suite measures

`tests/perf` (`pnpm perf`, one Chromium worker) opens `/stress/:count` (a grid of `count` default nodes and
`count - 1` edges, `fit-view`, `min-zoom=0.02`). A page-injected recorder collects `requestAnimationFrame` deltas while
`setViewport` pans for two seconds, zooms three times around the centre for two seconds, and one node is dragged with 60
mouse moves. `?visible=1` turns on culling, `?minimap=1` adds the mini map. Frame checks allow 0.5 ms of jitter.
