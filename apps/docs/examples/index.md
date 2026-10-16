---
title: Examples
aside: false
---

# Examples

The examples app (`apps/examples`) ports the reactflow.dev examples to XY Lit and adds stress pages, a collaboration
demo and a gallery of every UI component. Open any page below (when you run the repository locally, start the app with
`pnpm dev`), or use **Preview** to embed a page right here. Every page is a small Lit element on the same primitives as
the [guides](/guide/getting-started), so its source in `apps/examples/src/examples/<name>.ts` is a good place to copy
from.

Two things the examples need that these docs do not: the **collaboration demo** needs the collab server
(`pnpm dev:collab`; the hosted copy has none and says so), and the biggest **stress pages** (5 000 and 10 000 nodes) are
meant to be opened on their own, not in a preview frame. The [performance guide](/guide/performance) explains what they
measure.

<ExamplesGallery />
