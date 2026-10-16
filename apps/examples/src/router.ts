/**
 * Tiny pathname router with auto-discovered routes (spec/01 §Apps → apps/examples).
 * Pages are added by adding files; there is no shared route table to edit:
 *
 * - `src/examples/<name>.ts`        -> `/examples/<name>`        (default export `mount`)
 * - `src/generic-tests/<t>/<e>.ts` -> `/tests/generic/<t>/<e>`  (default export = FlowConfig)
 * - `src/pages/<a>.<b>.[p].ts`     -> `/<a>/<b>/:p`  (dots are slashes, `[p]` is a param), e.g.
 *   `pages/collab.[room].ts` -> `/collab/:room`, `pages/stress.[count].ts` -> `/stress/:count`.
 *   A page module may export `links: string[]` (concrete URLs shown on the index page).
 */
export type Mount = (root: HTMLElement, params: Record<string, string>) => void | Promise<void>;

export interface PageModule {
  default: Mount;
  /** Concrete links shown on the index page for parametrised routes. */
  links?: string[];
}

export interface Route {
  /** Pattern, e.g. `/examples/hello` or `/stress/:count`. */
  pattern: string;
  /** Links listed on the index page; resolved lazily for parametrised page routes. */
  links: () => Promise<string[]>;
  load: (params: Record<string, string>) => Promise<Mount>;
}

const exampleModules = import.meta.glob<{ default: Mount }>('./examples/**/*.ts');
const genericModules = import.meta.glob<{ default: unknown }>([
  './generic-tests/*/*.ts',
  '!./generic-tests/components/**',
  '!./generic-tests/*.d.ts',
]);
const fixtureModule = import.meta.glob<{
  mountFixture: (root: HTMLElement, config: unknown) => void;
}>('./fixture.ts');
const pageModules = import.meta.glob<PageModule>('./pages/*.ts');

const strip = (path: string, prefix: string): string =>
  path.slice(prefix.length).replace(/\.ts$/, '');

export function discoverRoutes(): Route[] {
  const routes: Route[] = [];

  for (const [file, load] of Object.entries(exampleModules)) {
    const name = strip(file, './examples/');
    routes.push({
      pattern: `/examples/${name}`,
      links: () => Promise.resolve([`/examples/${name}`]),
      load: async () => (await load()).default,
    });
  }

  for (const [file, load] of Object.entries(genericModules)) {
    const name = strip(file, './generic-tests/');
    routes.push({
      pattern: `/tests/generic/${name}`,
      links: () => Promise.resolve([`/tests/generic/${name}`]),
      load: async () => {
        const config = (await load()).default;
        const fixture = await fixtureModule['./fixture.ts']?.();
        if (!fixture) throw new Error('src/fixture.ts (mountFixture) is missing');
        return (root) => fixture.mountFixture(root, config);
      },
    });
  }

  for (const [file, load] of Object.entries(pageModules)) {
    const pattern =
      '/' +
      strip(file, './pages/')
        .split('.')
        .map((seg) => seg.replace(/^\[(.+)\]$/, ':$1'))
        .join('/');
    routes.push({
      pattern,
      links: async () => (await load()).links ?? (pattern.includes(':') ? [] : [pattern]),
      load: async () => (await load()).default,
    });
  }

  return routes.sort((a, b) => a.pattern.localeCompare(b.pattern));
}

export function matchRoute(
  routes: Route[],
  pathname: string,
): { route: Route; params: Record<string, string> } | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const parts = clean.split('/');
  for (const route of routes) {
    const pat = route.pattern.split('/');
    if (pat.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = pat.every((seg, i) => {
      const part = parts[i] as string;
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(part);
        return true;
      }
      return seg === part;
    });
    if (ok) return { route, params };
  }
  return undefined;
}
