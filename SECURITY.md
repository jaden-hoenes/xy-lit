# Security policy

## Supported versions

Security fixes go into the latest 0.x release of each published package (`@xy-lit/store`,
`@xy-lit/flow`, `@xy-lit/collab-yjs`, `@xy-lit/pro` and `@xy-lit/ui`). Older releases are not patched;
update to the latest version.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub's
private vulnerability reporting: open the
[Security tab](https://github.com/jaden-hoenes/xy-lit/security) of the repository and choose
**Report a vulnerability**.

Include what you found, the affected package and version, and steps or a small example that
reproduces it. The aim is to acknowledge a report within a few days. Once the problem is confirmed, a
fix and an advisory are published together, and you are credited unless you prefer not to be.

XY Lit renders node and edge data as text or through registered renderers and never builds HTML from
data, so a way to make it do so (or any other way to run script through data you control as an
attacker) is in scope. Vulnerabilities in `@xyflow/system` itself should be reported to
[xyflow](https://github.com/xyflow/xyflow).
