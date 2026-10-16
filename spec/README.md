# Design documents

These documents are the design that the 0.1 implementation follows. They describe what each
package and element is meant to do, the behaviour decisions that differ from React Flow, and how
the workspace, tests, documentation and Storybook are organised.

| File | Contents |
|---|---|
| `00-decisions.md` | Locked decisions, pinned versions, behaviour decisions, and a changelog of every place where the implementation deviates from or refines the design |
| `01-workspace.md` | Repository layout, packages, dependencies, build, lint and test configuration |
| `02-types.md` | Public types (nodes, edges, changes, events, the flow instance) |
| `03-store.md` | `@xy-lit/store`: state, actions, change pipeline, data sources |
| `04-flow-element.md` | `<xy-flow>`: attributes, properties, events |
| `05-nodes.md` | Nodes: renderers, the single-tree rule, measurement |
| `06-handles-connections.md` | Handles and connection gestures |
| `07-edges.md` | Edges, labels, markers, reconnecting |
| `08-plugins.md` | Background, controls, minimap, panels, portals |
| `09-controllers-context.md` | Contexts and reactive controllers |
| `10-styles-theming.md` | Generated styles, CSS custom properties, parts, colour modes, motion |
| `11-collab-yjs.md` | `@xy-lit/collab-yjs`: the Yjs data source, presence, repair, server hooks |
| `12-pro-ui.md` | `@xy-lit/pro` and `@xy-lit/ui` |
| `13-testing.md` | Test layers: unit, conformance, end-to-end, collaboration, performance, accessibility |
| `16-storybook-docs.md` | Storybook and the documentation site |

The numbering has gaps because two documents of the original plan are not part of this
repository. The documents describe the **0.1 design**: where the code and a document disagree,
`00-decisions.md` §Changelog usually records why, and the code is authoritative. Changes that
alter a decision are recorded there too (see `CONTRIBUTING.md`).
