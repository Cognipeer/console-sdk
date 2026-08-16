import { HttpClient } from '../http';
import { AuditLog, AuditLogListResponse, ListAuditLogsQuery } from '../types';

/**
 * Audit API resource — read-only access to the tenant's security /
 * administrative audit trail. Audit is tenant-scoped (NOT project-scoped) and
 * restricted to owner/admin tokens or tokens with an explicit `audit:read`
 * grant.
 *
 * @example
 * ```typescript
 * const logs = await client.audit.logs({ outcome: 'denied', limit: 50 });
 * for (const log of logs) console.log(log.actorEmail, log.event, log.outcome);
 * ```
 */
export class AuditResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List filtered + paginated audit events (returns the `data` array). */
  async logs(query?: ListAuditLogsQuery): Promise<AuditLog[]> {
    const res = await this.http.request<AuditLogListResponse>(
      'GET',
      '/api/client/v1/audit/logs',
      { query: query as Record<string, string | number | boolean | undefined> },
    );
    return res.data ?? [];
  }
}
