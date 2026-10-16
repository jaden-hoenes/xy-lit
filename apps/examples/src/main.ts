import { catalog, categories } from './catalog';
import type { Category, CatalogEntry } from './catalog';
import { discoverRoutes, matchRoute } from './router';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

function notFound(): void {
  const h = document.createElement('h1');
  h.textContent = '404';
  root!.replaceChildren(h);
}

const STYLE = `
.ex-index { max-width: 1100px; margin: 0 auto; padding: 24px 20px 64px; color: #1a192b; }
.ex-index h1 { margin: 0 0 4px; font-size: 28px; }
.ex-index .lead { margin: 0 0 20px; color: #555; }
.ex-index input[type=search] { width: 100%; max-width: 360px; padding: 8px 10px; font: inherit; border: 1px solid #bbb; border-radius: 6px; }
.ex-index h2 { margin: 28px 0 2px; font-size: 18px; }
.ex-index .blurb { margin: 0 0 10px; color: #666; font-size: 13px; }
.ex-index ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.ex-index li a { display: block; height: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d8d8de; border-radius: 8px; text-decoration: none; color: inherit; background: #fff; }
.ex-index li a:hover, .ex-index li a:focus-visible { border-color: #6366f1; box-shadow: 0 0 0 2px #6366f133; outline: none; }
.ex-index li strong { display: block; font-size: 14px; }
.ex-index li span { display: block; margin-top: 2px; font-size: 12px; color: #555; }
.ex-index li code { display: block; margin-top: 6px; font-size: 11px; color: #888; }
.ex-index details { margin-top: 32px; color: #555; }
.ex-index details summary { cursor: pointer; font-weight: 600; }
.ex-index details ul { margin-top: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.ex-index [hidden] { display: none; }
`;

function card(entry: CatalogEntry): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.search = `${entry.title} ${entry.description} ${entry.route}`.toLowerCase();
  const a = document.createElement('a');
  a.href = import.meta.env.BASE_URL.replace(/\/$/, '') + entry.route;
  a.dataset.route = entry.route;
  const title = document.createElement('strong');
  title.textContent = entry.title;
  const text = document.createElement('span');
  text.textContent = entry.description;
  const path = document.createElement('code');
  path.textContent = entry.route;
  a.append(title, text, path);
  li.append(a);
  return li;
}

/** The index: examples grouped by category, plus every undocumented route under "Other". */
async function renderIndex(routes: ReturnType<typeof discoverRoutes>): Promise<void> {
  if (!document.getElementById('xy-index-style')) {
    const style = document.createElement('style');
    style.id = 'xy-index-style';
    style.textContent = STYLE;
    document.head.append(style);
  }
  const page = document.createElement('main');
  page.className = 'ex-index';
  const h = document.createElement('h1');
  h.textContent = 'XY Lit examples';
  const lead = document.createElement('p');
  lead.className = 'lead';
  lead.textContent =
    'Web-component ports of the reactflow.dev examples, plus the XY Lit extras. Every page is a small file in apps/examples/src/examples.';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Filter examples';
  search.setAttribute('aria-label', 'Filter examples');
  page.append(h, lead, search);

  const known = new Set(catalog.map((c) => c.route));
  const lists: HTMLUListElement[] = [];
  const listOf = (items: CatalogEntry[]): HTMLUListElement => {
    const ul = document.createElement('ul');
    for (const item of items) ul.append(card(item));
    lists.push(ul);
    return ul;
  };

  const list = document.createElement('div');
  list.dataset.testid = 'route-list';
  for (const [key, meta] of Object.entries(categories) as [
    Category,
    (typeof categories)[Category],
  ][]) {
    const items = catalog.filter((c) => c.category === key);
    if (!items.length) continue;
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = meta.title;
    const blurb = document.createElement('p');
    blurb.className = 'blurb';
    blurb.textContent = meta.blurb;
    section.append(h2, blurb, listOf(items));
    list.append(section);
  }

  // routes nobody described: test pages, fixtures and new examples
  const other: CatalogEntry[] = [];
  const tests: CatalogEntry[] = [];
  for (const route of routes) {
    for (const href of await route.links()) {
      if (known.has(href)) continue;
      const entry: CatalogEntry = {
        route: href,
        title: href.replace(/^\/(examples\/)?/, ''),
        description: '',
        category: 'basics',
      };
      const isTestPage = href.startsWith('/tests/') || href.startsWith('/examples/e2e-');
      (isTestPage ? tests : other).push(entry);
    }
    if (!(await route.links()).length)
      tests.push({
        route: route.pattern,
        title: route.pattern,
        description: 'Needs a parameter.',
        category: 'basics',
      });
  }
  if (other.length) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Other';
    section.append(h2, listOf(other));
    list.append(section);
  }
  page.append(list);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `Test pages and fixtures (${tests.length})`;
  const hint = document.createElement('p');
  hint.className = 'blurb';
  hint.textContent = 'Pages the end-to-end and conformance suites drive. Not examples.';
  details.append(summary, hint, listOf(tests));
  page.append(details);

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const ul of lists) {
      for (const li of ul.children as HTMLCollectionOf<HTMLLIElement>) {
        li.hidden = !!q && !(li.dataset.search ?? '').includes(q);
      }
    }
    for (const section of list.querySelectorAll('section')) {
      section.hidden = !!q && ![...section.querySelectorAll('li')].some((li) => !li.hidden);
    }
    if (q) details.open = true;
  });
  root!.replaceChildren(page);
}

async function start(): Promise<void> {
  const routes = discoverRoutes();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = location.pathname.startsWith(base)
    ? location.pathname.slice(base.length) || '/'
    : location.pathname;
  if (pathname === '/' || pathname === '/index.html') return renderIndex(routes);
  const match = matchRoute(routes, pathname);
  if (!match) return notFound();
  try {
    root!.replaceChildren();
    await (
      await match.route.load(match.params)
    )(root!, match.params);
  } catch (error) {
    console.error(error);
    const pre = document.createElement('pre');
    pre.textContent = String(error);
    root!.replaceChildren(pre);
  }
}

void start();
