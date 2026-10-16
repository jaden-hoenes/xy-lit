// Shared config of `cem analyze` (custom-elements-manifest analyzer) for flow, collab-yjs and ui.
// The analyzer lists everything a class declares. This plugin removes what is not public API, so
// the manifest (and the docs and Storybook tables built from it) shows only documented members:
//   - members and attributes without a description (`@internal` members, Lit `state: true`
//     properties, controllers held in fields, and the like; `scripts/check-jsdoc.mjs --members`
//     makes sure every public member has a description),
//   - private and protected members,
//   - events without a description (the analyzer picks `dispatchEvent(new FlowContextRequestEvent(...))`
//     calls up as events named after the identifier).
export default {
  // do not rewrite the `customElements` field of package.json (it already says custom-elements.json;
  // the API generator also runs the analyzer into a temp directory)
  packagejson: false,
  plugins: [
    {
      name: 'xy-lit-public-api-only',
      packageLinkPhase({ customElementsManifest }) {
        for (const mod of customElementsManifest.modules ?? []) {
          for (const decl of mod.declarations ?? []) {
            if (decl.kind !== 'class') continue;
            const documented = new Set();
            if (decl.members) {
              decl.members = decl.members.filter((m) => {
                const keep =
                  !!m.description?.trim() &&
                  m.privacy !== 'private' &&
                  m.privacy !== 'protected' &&
                  !m.name.startsWith('#') &&
                  !m.name.startsWith('_');
                if (keep) documented.add(m.name);
                return keep;
              });
            }
            if (decl.attributes) {
              decl.attributes = decl.attributes.filter(
                (a) => documented.has(a.fieldName ?? a.name) || !!a.description?.trim(),
              );
            }
            if (decl.events) decl.events = decl.events.filter((e) => !!e.description?.trim());
          }
        }
      },
    },
  ],
};
