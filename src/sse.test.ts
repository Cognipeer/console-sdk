import { describe, it, expect } from 'vitest';
import { SseParser } from './sse';

describe('SseParser', () => {
  it('parses id / event / data blocks', () => {
    const parser = new SseParser();

    const messages = parser.push('id: 7\nevent: agent.message\ndata: {"a":1}\n\n');

    expect(messages).toEqual([{ id: '7', event: 'agent.message', data: '{"a":1}' }]);
  });

  it('defaults the event name to "message" and omits id when the block has none', () => {
    const [message] = new SseParser().push('data: hi\n\n');

    expect(message).toEqual({ event: 'message', data: 'hi' });
  });

  it('joins multi-line data with newlines', () => {
    const [message] = new SseParser().push('data: a\ndata: b\n\n');

    expect(message.data).toBe('a\nb');
  });

  it('ignores comment lines such as the keep-alive ping', () => {
    expect(new SseParser().push(': ping\n\n')).toEqual([]);
  });

  it('keeps a partial block across chunks, including a split line', () => {
    const parser = new SseParser();

    expect(parser.push('id: 3\nevent: x\nda')).toEqual([]);
    expect(parser.push('ta: {"k":')).toEqual([]);
    expect(parser.push('1}\n\n')).toEqual([{ id: '3', event: 'x', data: '{"k":1}' }]);
  });

  it('handles CRLF and a CRLF split across chunks', () => {
    const parser = new SseParser();

    expect(parser.push('data: one\r')).toEqual([]);
    expect(parser.push('\n\r\ndata: two\r\n\r\n')).toEqual([
      { event: 'message', data: 'one' },
      { event: 'message', data: 'two' },
    ]);
  });

  it('does not carry the id or event name of one block into the next', () => {
    const messages = new SseParser().push('id: 1\nevent: a\ndata: 1\n\ndata: 2\n\n');

    expect(messages).toEqual([
      { id: '1', event: 'a', data: '1' },
      { event: 'message', data: '2' },
    ]);
  });

  it('reads retry only when it is numeric and strips a single leading space from values', () => {
    const parser = new SseParser();

    expect(parser.push('retry: 1500\ndata:  x\n\n')).toEqual([{ event: 'message', data: ' x', retry: 1500 }]);
    expect(parser.push('retry: soon\ndata: y\n\n')).toEqual([{ event: 'message', data: 'y' }]);
  });

  it('dispatches nothing for a block without data', () => {
    expect(new SseParser().push('event: only\n\n')).toEqual([]);
  });
});
