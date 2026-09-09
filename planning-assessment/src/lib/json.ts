/**
 * Typed helpers for the JSON-in-TEXT columns used throughout the schema
 * (SQLite has no native Json type in this Prisma version — see
 * prisma/schema.prisma header). Centralizing (de)serialization here means
 * every "JSON column" in the app is read/written through the same two
 * functions instead of ad hoc JSON.parse/stringify scattered around.
 */

export function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function fromJsonArray<T = unknown>(value: string | null | undefined): T[] {
  return fromJson<T[]>(value, []);
}
