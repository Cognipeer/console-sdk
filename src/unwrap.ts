/**
 * Response-envelope readers for routes whose envelope the Console has not
 * fixed yet (session files, webhooks): a single resource is read as the bare
 * object or as `{ <key>: object }`, a list as the bare array or
 * `{ data: [...] }` / `{ <key>: [...] }`.
 */

export function unwrapOne<T>(response: unknown, key: string): T {
  const body = response as Record<string, unknown> | null | undefined;
  const inner = body?.[key];
  return (inner !== null && typeof inner === 'object' ? inner : response) as T;
}

export function unwrapList<T>(response: unknown, key: string): T[] {
  if (Array.isArray(response)) return response as T[];
  const body = (response ?? {}) as Record<string, unknown>;
  const list = body.data ?? body[key];
  return Array.isArray(list) ? (list as T[]) : [];
}
