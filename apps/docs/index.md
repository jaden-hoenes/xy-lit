---
layout: home
title: XY Lit
hero:
  name: XY Lit
  text: Node-based UIs as web components
  tagline: A Lit port of React Flow on the same engine, usable from plain HTML or any framework, with Yjs collaboration built in.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/jaden-hoenes/xy-lit
features:
  - icon:
      src: /icons/standards.svg
      width: 28
      height: 28
    title: Standards-based
    details: Custom elements, one shadow root per flow, CSS custom properties and ::part for styling, CustomEvents for everything. No framework runtime to ship.
    link: /guide/getting-started
    linkText: Getting started
  - icon:
      src: /icons/engine.svg
      width: 28
      height: 28
    title: The React Flow engine
    details: Pan, zoom, dragging, selection, connection validation, resizing and auto-pan come from @xyflow/system. The upstream end-to-end suite runs against XY Lit.
    link: /guide/migrating-from-react-flow
    linkText: Migrating from React Flow
  - icon:
      src: /icons/collab.svg
      width: 28
      height: 28
    title: Collaboration as a data source
    details: flow.source = new YjsFlowSource(doc, { awareness, user } ) gives you shared state, per-user undo, live cursors and self-healing documents.
    link: /guide/collaboration
    linkText: Collaboration
  - icon:
      src: /icons/modes.svg
      width: 28
      height: 28
    title: Controlled or uncontrolled
    details: Hand nodes over once and let the flow own them, or veto every change and keep the state in your app. Both modes share one change pipeline.
    link: /guide/controlled-vs-uncontrolled
    linkText: Two modes
  - icon:
      src: /icons/scale.svg
      width: 28
      height: 28
    title: Built for scale
    details: With only-render-visible-elements a 10 000-node graph pans, zooms and drags at 60 fps. The performance guide lists every measured number, including the ones that miss the budget.
    link: /guide/performance
    linkText: Performance
  - icon:
      src: /icons/a11y.svg
      width: 28
      height: 28
    title: Accessible by default
    details: Keyboard navigation, live-region announcements, labelled controls and WCAG AA colour contrast, checked by axe in the test suite.
    link: /guide/accessibility
    linkText: Accessibility
  - icon:
      src: /icons/pro.svg
      width: 28
      height: 28
    title: Pro features
    details: Undo and redo, clipboard, helper lines, auto layout in a worker, expand and collapse, grouping and animated positions that compose on one flow.
    link: /guide/pro-features
    linkText: Pro features
  - icon:
      src: /icons/ui.svg
      width: 28
      height: 28
    title: UI components
    details: Node cards with status rings, schema and shape nodes, zoom slider, node search and devtools, ready to drop in and themed by the flow.
    link: /guide/ui-components
    linkText: UI components
---
