/**
 * Minimal Server-Sent Events parser (WHATWG "Interpreting an event stream"):
 * keeps the `id:` / `event:` / `data:` fields that `HttpClient.stream()` drops,
 * which a resumable stream needs (`Last-Event-ID`).
 */

/** One dispatched SSE message. */
export interface SseMessage {
  /** `event:` field; `message` when the block had none (the SSE default). */
  event: string;
  /** `data:` lines joined with `\n`. */
  data: string;
  /** `id:` field of THIS block (undefined when the block carried none). */
  id?: string;
  /** `retry:` field (ms) of this block, when present. */
  retry?: number;
}

export class SseParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName = '';
  private eventId: string | undefined;
  private retryMs: number | undefined;

  /**
   * Feed a decoded chunk. Returns the messages it completed; a partial line or
   * block is kept for the next call. Comment lines (`: ping`) dispatch nothing.
   */
  push(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const out: SseMessage[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch !== '\n' && ch !== '\r') continue;
      // A trailing "\r" may be the first half of "\r\n": wait for the next chunk.
      if (ch === '\r' && i === this.buffer.length - 1) break;
      const line = this.buffer.slice(start, i);
      if (ch === '\r' && this.buffer[i + 1] === '\n') i++;
      start = i + 1;
      this.processLine(line, out);
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  private processLine(line: string, out: SseMessage[]): void {
    if (line === '') {
      this.dispatch(out);
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        this.dataLines.push(value);
        break;
      case 'event':
        this.eventName = value;
        break;
      case 'id':
        if (!value.includes('\0')) this.eventId = value;
        break;
      case 'retry':
        if (/^\d+$/.test(value)) this.retryMs = Number(value);
        break;
      default:
        break;
    }
  }

  private dispatch(out: SseMessage[]): void {
    if (this.dataLines.length > 0) {
      out.push({
        event: this.eventName || 'message',
        data: this.dataLines.join('\n'),
        ...(this.eventId !== undefined ? { id: this.eventId } : {}),
        ...(this.retryMs !== undefined ? { retry: this.retryMs } : {}),
      });
    }
    this.dataLines = [];
    this.eventName = '';
    this.eventId = undefined;
    this.retryMs = undefined;
  }
}
