import { vi } from 'vitest';
import { HttpClient } from '../http';

/**
 * A fully mocked `HttpClient` for resource-level unit tests. Every network
 * method is replaced with a `vi.fn()` spy so tests can assert on the method,
 * path, and payload a resource sends, without making real HTTP calls.
 */
export type MockHttpClient = {
  [K in 'request' | 'stream' | 'requestBinary' | 'requestMultipart' | 'resolveURL']: ReturnType<
    typeof vi.fn
  >;
};

/**
 * Create a mock `HttpClient` suitable for injecting into resource classes
 * (e.g. `new EmbeddingsResource(createMockHttp())`).
 */
export function createMockHttp(): MockHttpClient & HttpClient {
  // Left untyped (no `: MockHttpClient` annotation) so each `vi.fn()` keeps its
  // own precise inferred signature instead of being widened up front - the
  // final cast below is what reconciles it with `MockHttpClient & HttpClient`.
  const mock = {
    request: vi.fn(),
    stream: vi.fn(),
    requestBinary: vi.fn(),
    requestMultipart: vi.fn(),
    resolveURL: vi.fn((path: string) => `https://mock.test${path}`),
  };
  return mock as unknown as MockHttpClient & HttpClient;
}
