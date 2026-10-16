import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('@xy-lit/flow (browser)', () => {
  it('loads in a real browser', () => {
    expect(typeof pkg).toBe('object');
    expect(typeof customElements.define).toBe('function');
  });
});
