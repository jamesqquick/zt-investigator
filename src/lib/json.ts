import type { JsonValue } from '@flue/runtime';

/**
 * Boundary cast for tool return values.
 *
 * Our record and entry types are genuinely JSON-serializable data, but
 * TypeScript cannot prove that a *named* interface (or a type with optional
 * fields, whose values widen to include `undefined`) satisfies JsonValue's
 * index signature. Centralizing the assertion here keeps it honest and
 * greppable instead of scattering `as unknown as JsonValue` across every tool.
 */
export function asJson<T>(value: T): JsonValue {
  return value as unknown as JsonValue;
}
