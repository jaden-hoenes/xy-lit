/**
 * What the index page shows: a title, a one-line description and a category for every example.
 * Routes are still discovered from the file system (`router.ts`); a route that is not listed here
 * appears under "Other", so a new page is never invisible. `tests/e2e/lit/examples.spec.ts` fails
 * when an example page has no entry.
 */
export type Category =
  | 'basics'
  | 'nodes'
  | 'edges'
  | 'interaction'
  | 'layout'
  | 'plugins'
  | 'pro'
  | 'ui'
  | 'performance'
  | 'collaboration';

export interface CatalogEntry {
  /** Route, e.g. `/examples/overview`. */
  route: string;
  title: string;
  description: string;
  category: Category;
}

export const categories: Record<Category, { title: string; blurb: string }> = {
  basics: { title: 'Basics', blurb: 'The smallest flows and the overall look.' },
  nodes: { title: 'Nodes', blurb: 'Custom nodes, sizing, toolbars and sub flows.' },
  edges: { title: 'Edges', blurb: 'Edge types, labels, markers and connection lines.' },
  interaction: { title: 'Interaction', blurb: 'Connecting, dropping, validating and editing.' },
  layout: { title: 'Layout', blurb: 'Positioning nodes automatically.' },
  plugins: { title: 'Plugins', blurb: 'Panel, controls, minimap, background, portals.' },
  pro: { title: 'Pro features', blurb: '@xy-lit/pro: history, clipboard, helper lines, grouping.' },
  ui: { title: 'UI components', blurb: '@xy-lit/ui: ready-made nodes, handles, edges and tools.' },
  performance: { title: 'Performance', blurb: 'Thousands of nodes and edges.' },
  collaboration: { title: 'Collaboration', blurb: 'Yjs, presence and live cursors.' },
};

const ex = (
  name: string,
  title: string,
  category: Category,
  description: string,
): CatalogEntry => ({ route: `/examples/${name}`, title, description, category });

export const catalog: CatalogEntry[] = [
  // basics
  ex('hello', 'Hello', 'basics', 'Three nodes and two edges in plain DOM, no framework.'),
  ex(
    'basic',
    'Basic',
    'basics',
    'Node types, edge types, labels, markers and styling in one flow.',
  ),
  ex(
    'overview',
    'Overview',
    'basics',
    'Input, default and output nodes with minimap, controls, background and an event panel.',
  ),
  ex(
    'color-mode',
    'Color mode',
    'basics',
    'The conformance fixture for `color-mode`: light, dark and system.',
  ),
  ex(
    'dark-mode',
    'Dark mode',
    'basics',
    'Themed custom nodes and a switch between light, dark and the system setting.',
  ),
  ex(
    'backgrounds',
    'Backgrounds',
    'basics',
    'Four flows with dots, lines and cross backgrounds, gaps and offsets.',
  ),
  // nodes
  ex(
    'custom-node',
    'Custom node',
    'nodes',
    'A node element with a colour input; target nodes follow it through controllers.',
  ),
  ex(
    'node-resizer',
    'Node resizer',
    'nodes',
    'Resize handles, lines, hover corner, one-direction controls and expanding parents.',
  ),
  ex(
    'node-toolbar',
    'Node toolbar',
    'nodes',
    'A toolbar beside the selected node with configurable position and alignment.',
  ),
  ex(
    'sub-flow',
    'Sub flow',
    'nodes',
    'Nested groups, children confined to their parent, detaching and adding children.',
  ),
  ex(
    'computing-flows',
    'Computing flows',
    'nodes',
    'Number nodes feed sum and product nodes that show the computed value.',
  ),
  ex(
    'controllers',
    'Controllers',
    'nodes',
    'Reactive controllers: a sum node, viewport statistics and the selection.',
  ),
  // edges
  ex(
    'edge-types',
    'Edge types',
    'edges',
    'Every built-in edge type with labels, markers and animation.',
  ),
  ex(
    'custom-edge',
    'Custom edge',
    'edges',
    'A button edge: an interactive delete button in the middle of the edge.',
  ),
  ex(
    'edge-label-renderer',
    'Edge label renderer',
    'edges',
    'HTML labels on a custom edge, editable in place.',
  ),
  ex(
    'edge-toolbar',
    'Edge toolbar',
    'edges',
    'A toolbar on a selected edge that keeps its size while zooming.',
  ),
  ex(
    'custom-connection-line',
    'Custom connection line',
    'edges',
    'A custom line while dragging a connection, coloured by validity.',
  ),
  ex(
    'floating-edges',
    'Floating edges',
    'edges',
    'Edges that attach where the line between two nodes crosses their border.',
  ),
  ex(
    'parallel-edges',
    'Parallel edges',
    'edges',
    'Several edges between the same nodes fanned out, with start and end labels.',
  ),
  // interaction
  ex(
    'drag-and-drop',
    'Drag and drop',
    'interaction',
    'Drag node types from a palette onto the pane.',
  ),
  ex(
    'add-node-on-edge-drop',
    'Add node on edge drop',
    'interaction',
    'Release a connection on the pane to create a connected node.',
  ),
  ex(
    'validation',
    'Validation',
    'interaction',
    'Only connect nodes of the same colour; handles show valid and invalid targets.',
  ),
  ex(
    'connection-limit',
    'Connection limit',
    'interaction',
    'Handles that stop accepting connections after a limit.',
  ),
  ex(
    'easy-connect',
    'Easy connect',
    'interaction',
    'The whole node is a handle: drag from anywhere, drop anywhere.',
  ),
  ex(
    'proximity-connect',
    'Proximity connect',
    'interaction',
    'Drag a node near another one to preview and drop to create an edge.',
  ),
  ex(
    'intersections',
    'Intersections',
    'interaction',
    'Highlight the nodes a dragged node overlaps.',
  ),
  ex(
    'context-menu',
    'Context menu',
    'interaction',
    'A right-click menu on nodes: duplicate and delete.',
  ),
  ex(
    'save-restore',
    'Save and restore',
    'interaction',
    'Serialise the flow with `toObject()` and restore nodes, edges and viewport.',
  ),
  // layout
  ex(
    'dagre',
    'Dagre layout',
    'layout',
    'Automatic vertical and horizontal layout with `@xy-lit/pro` and dagre.',
  ),
  ex(
    'pro-layout',
    'Layout algorithms',
    'layout',
    'Dagre, elk, tree and force layouts running in a worker, with undo.',
  ),
  // plugins
  ex(
    'controls',
    'Controls',
    'plugins',
    'Zoom controls, vertical and horizontal, with a custom button.',
  ),
  ex('minimap', 'Minimap', 'plugins', 'A pannable and zoomable minimap with per-node colours.'),
  ex('panel', 'Panel', 'plugins', 'A panel in every position.'),
  ex(
    'viewport-portal',
    'Viewport portal',
    'plugins',
    'Content in flow coordinates, in front of and behind the nodes.',
  ),
  // pro
  ex(
    'pro-compose',
    'Everything on one flow',
    'pro',
    'History, clipboard, helper lines, grouping, collapse and layout together.',
  ),
  ex('pro-history', 'Undo and redo', 'pro', 'Local history with Mod+Z / Mod+Shift+Z.'),
  ex(
    'pro-clipboard',
    'Copy and paste',
    'pro',
    'Copy, cut, paste and duplicate with the keyboard or buttons.',
  ),
  ex('pro-helper-lines', 'Helper lines', 'pro', 'Alignment guides and snapping while dragging.'),
  ex(
    'pro-animation',
    'Position animation',
    'pro',
    'Animate nodes to new positions as one gesture.',
  ),
  ex(
    'pro-collapse',
    'Expand and collapse',
    'pro',
    'Collapse and expand the subtree behind a node.',
  ),
  ex(
    'pro-grouping',
    'Grouping',
    'pro',
    'Group the selection, ungroup, and drop nodes into groups.',
  ),
  // ui
  ex('ui', 'UI gallery', 'ui', 'Every @xy-lit/ui component on one live flow.'),
  // performance
  ex(
    'stress',
    'Stress',
    'performance',
    'Up to 10,000 nodes with switches for viewport culling and the minimap.',
  ),
  ...[1000, 5000, 10000].map((n): CatalogEntry => ({
    route: `/stress/${n}`,
    title: `Stress page, ${n.toLocaleString('en')} nodes`,
    description: `A grid of ${n.toLocaleString('en')} nodes and ${(n - 1).toLocaleString('en')} edges; the page the performance budgets run against.`,
    category: 'performance',
  })),
  // collaboration
  {
    route: '/collab/demo',
    title: 'Collaboration demo',
    description:
      'Hocuspocus and y-indexeddb: shared editing, cursors, presence, undo. Needs the collab server.',
    category: 'collaboration',
  },
];
