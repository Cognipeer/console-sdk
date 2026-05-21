import { HttpClient } from '../http';
import { Automation } from '../types';

/**
 * Automations API resource — manage built-in scheduled jobs.
 *
 * Automations are platform-defined recurring tasks. Use these endpoints to
 * inspect their state and manually trigger / pause / resume them.
 */
export class AutomationsResource {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** List all known automations and their current state. */
  async list(): Promise<Automation[]> {
    const res = await this.http.request<{ automations: Automation[] }>(
      'GET',
      '/api/client/v1/automations',
    );
    return res.automations ?? [];
  }

  /** Fetch a single automation. */
  async get(key: string): Promise<Automation> {
    const res = await this.http.request<{ automation: Automation }>(
      'GET',
      `/api/client/v1/automations/${encodeURIComponent(key)}`,
    );
    return res.automation;
  }

  /** Trigger an automation immediately. */
  async run(key: string): Promise<Automation> {
    const res = await this.http.request<{ automation: Automation }>(
      'POST',
      `/api/client/v1/automations/${encodeURIComponent(key)}/run`,
    );
    return res.automation;
  }

  /** Pause an automation so it stops following its schedule. */
  async pause(key: string): Promise<Automation> {
    const res = await this.http.request<{ automation: Automation }>(
      'POST',
      `/api/client/v1/automations/${encodeURIComponent(key)}/pause`,
    );
    return res.automation;
  }

  /** Resume a paused automation. */
  async resume(key: string): Promise<Automation> {
    const res = await this.http.request<{ automation: Automation }>(
      'POST',
      `/api/client/v1/automations/${encodeURIComponent(key)}/resume`,
    );
    return res.automation;
  }
}
