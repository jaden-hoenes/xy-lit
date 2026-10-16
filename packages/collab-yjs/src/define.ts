import { XyPresenceAvatarsElement } from './elements/xy-presence-avatars.js';
import { XyRemoteCursorsElement } from './elements/xy-remote-cursors.js';

/**
 * Registers `<xy-remote-cursors>` and `<xy-presence-avatars>`. Importing
 * `@xy-lit/collab-yjs/define.js` is the only place with side effects; registration is idempotent.
 */
const elements: [string, CustomElementConstructor][] = [
  ['xy-remote-cursors', XyRemoteCursorsElement],
  ['xy-presence-avatars', XyPresenceAvatarsElement],
];

for (const [tag, ctor] of elements) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

declare global {
  interface HTMLElementTagNameMap {
    'xy-remote-cursors': XyRemoteCursorsElement;
    'xy-presence-avatars': XyPresenceAvatarsElement;
  }
}
