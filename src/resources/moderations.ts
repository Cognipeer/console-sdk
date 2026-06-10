import { HttpClient } from '../http';
import {
  CreateModerationRequest,
  ModerationResponse,
} from '../types';

/**
 * Moderations API resource — OpenAI-compatible content classification backed
 * by console guardrails.
 *
 * The `model` field selects the guardrail to evaluate with (any enabled
 * guardrail key). When omitted, the tenant's first enabled guardrail with an
 * active moderation policy is used.
 *
 * @example
 * ```typescript
 * const moderation = await client.moderations.create({
 *   input: 'I want to hurt someone.',
 * });
 *
 * if (moderation.results[0].flagged) {
 *   console.log(moderation.results[0].categories);
 * }
 * ```
 */
export class ModerationsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Classify one or more inputs against a moderation guardrail. */
  async create(data: CreateModerationRequest): Promise<ModerationResponse> {
    return this.http.request<ModerationResponse>(
      'POST',
      '/api/client/v1/moderations',
      { body: data },
    );
  }
}
