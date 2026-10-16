import type { ComplexAttributeConverter } from 'lit';
import { devWarn } from '@xy-lit/store';
import type { KeyCode, SnapGrid } from '@xy-lit/store';

/**
 * Boolean attribute that can default to `true`: attribute absent gives `defaultValue`, `"false"`
 * gives `false`, any other value (including the empty string) gives `true`.
 *
 * @param defaultValue - Value when the attribute is absent.
 */
export function booleanAttr(defaultValue: boolean): ComplexAttributeConverter<boolean> {
  return {
    fromAttribute: (value) => (value === null ? defaultValue : value !== 'false'),
    toAttribute: (value) => (value ? '' : 'false'),
  };
}

/**
 * Numeric attribute. Missing or non-numeric values give `defaultValue`.
 *
 * @param defaultValue - Value when the attribute is absent or invalid.
 */
export function numberAttr(defaultValue: number): ComplexAttributeConverter<number> {
  return {
    fromAttribute: (value) => {
      if (value === null || value.trim() === '') return defaultValue;
      const n = Number(value);
      return Number.isFinite(n) ? n : defaultValue;
    },
    toAttribute: (value) => String(value),
  };
}

/** Parse `"15 15"`, `"15,15"` or `"15"` into a pair; `undefined` when invalid. */
export function parseNumberPair(value: string | null): [number, number] | undefined {
  if (value === null) return undefined;
  const parts = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length === 0 || parts.length > 2 || parts.some((n) => !Number.isFinite(n))) {
    return undefined;
  }
  return [parts[0] as number, (parts[1] ?? parts[0]) as number];
}

/**
 * Number pair attribute (`snap-grid="15 15"`). Invalid values give `defaultValue`.
 *
 * @param defaultValue - Value when the attribute is absent or invalid.
 */
export function numberPairAttr(defaultValue: SnapGrid): ComplexAttributeConverter<SnapGrid> {
  return {
    fromAttribute: (value) => parseNumberPair(value) ?? defaultValue,
    toAttribute: (value) => value.join(' '),
  };
}

/**
 * `pan-on-drag`: `"true"` / `"false"` / a comma list of mouse buttons (`"0,2"`). Absent gives
 * `true`.
 */
export const panOnDragAttr: ComplexAttributeConverter<boolean | number[]> = {
  fromAttribute: (value) => {
    if (value === null || value === '' || value === 'true') return true;
    if (value === 'false') return false;
    const buttons = value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    return buttons.length > 0 && buttons.every(Number.isInteger) ? buttons : true;
  },
  toAttribute: (value) => (Array.isArray(value) ? value.join(',') : String(value)),
};

/**
 * Key code attribute: `"null"` or the empty string give `null` (key disabled), a value with a
 * comma gives a list of alternatives, anything else the string itself (`"Space"` and `" "` both
 * mean the space bar, matching `event.code` / `event.key`).
 *
 * @param defaultValue - Value when the attribute is absent.
 */
export function keyCodeAttr(
  defaultValue: KeyCode | null,
): ComplexAttributeConverter<KeyCode | null> {
  return {
    fromAttribute: (value) => {
      if (value === null) return defaultValue;
      if (value === ' ') return ' ';
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'null') return null;
      if (trimmed.includes(',')) {
        return trimmed
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
      }
      return trimmed;
    },
    toAttribute: (value) => (Array.isArray(value) ? value.join(',') : (value ?? 'null')),
  };
}

/**
 * Enumerated attribute. Values outside `values` give `defaultValue` and a development warning.
 *
 * @param values - Allowed values.
 * @param defaultValue - Value when the attribute is absent or invalid.
 */
export function enumAttr<T extends string>(
  values: readonly T[],
  defaultValue: T,
): ComplexAttributeConverter<T> {
  return {
    fromAttribute: (value) => {
      if (value === null) return defaultValue;
      if ((values as readonly string[]).includes(value)) return value as T;
      devWarn('XYL03', `Invalid attribute value "${value}"; expected one of ${values.join(', ')}.`);
      return defaultValue;
    },
    toAttribute: (value) => value,
  };
}

/**
 * A number or a pair of numbers (`gap="20"` or `gap="20 10"`). Invalid or missing values give
 * `defaultValue`.
 *
 * @param defaultValue - Value when the attribute is absent or invalid.
 */
export function numberOrPairAttr(
  defaultValue: number | [number, number],
): ComplexAttributeConverter<number | [number, number]> {
  return {
    fromAttribute: (value) => {
      const pair = parseNumberPair(value);
      if (!pair) return defaultValue;
      const parts = (value ?? '').split(/[\s,]+/).filter(Boolean);
      return parts.length === 1 ? pair[0] : pair;
    },
    toAttribute: (value) => (Array.isArray(value) ? value.join(' ') : String(value)),
  };
}
