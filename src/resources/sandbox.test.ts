import { describe, it, expect } from 'vitest';
import {
  SandboxResource,
  SandboxFsResource,
  SandboxGitResource,
  SandboxSessionsResource,
} from './sandbox';
import { createMockHttp } from '../test/mockHttp';

const BASE = '/api/client/v1/sandbox/sandboxes';

describe('SandboxResource', () => {
  it('wires up fs, git, and sessions sub-resources', () => {
    const http = createMockHttp();
    const resource = new SandboxResource(http);

    expect(resource.fs).toBeInstanceOf(SandboxFsResource);
    expect(resource.git).toBeInstanceOf(SandboxGitResource);
    expect(resource.sessions).toBeInstanceOf(SandboxSessionsResource);
  });

  it('creates a sandbox with default (empty) data', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx1', status: 'starting' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.create();

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith('POST', BASE, { body: {} });
  });

  it('creates a sandbox with a template', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'sbx1' });
    const resource = new SandboxResource(http);

    await resource.create({ template: 'node-20' });

    expect(http.request).toHaveBeenCalledWith('POST', BASE, { body: { template: 'node-20' } });
  });

  it('lists sandboxes, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxResource(http);

    const result = await resource.list();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', BASE);
  });

  it('gets a sandbox by id', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx1', status: 'running' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.get('sbx1');

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith('GET', `${BASE}/sbx1`);
  });

  it('deletes a sandbox', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxResource(http);

    const result = await resource.delete('sbx1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', `${BASE}/sbx1`);
  });

  it('execs a shell command', async () => {
    const http = createMockHttp();
    const execResult = { exitCode: 0, stdout: 'v20.0.0', stderr: '' };
    http.request.mockResolvedValue(execResult);
    const resource = new SandboxResource(http);

    const result = await resource.exec('sbx1', { command: 'node --version' });

    expect(result).toBe(execResult);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/exec`, {
      body: { command: 'node --version' },
    });
  });

  it('runs a code snippet', async () => {
    const http = createMockHttp();
    const execResult = { exitCode: 0, stdout: 'hi', stderr: '' };
    http.request.mockResolvedValue(execResult);
    const resource = new SandboxResource(http);

    const result = await resource.code('sbx1', { language: 'python', code: 'print("hi")' } as never);

    expect(result).toBe(execResult);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/code`, {
      body: { language: 'python', code: 'print("hi")' },
    });
  });

  it('preview delegates to get() and returns its preview field', async () => {
    const http = createMockHttp();
    const preview = { enabled: true, public: false, ports: [], sharingEnabled: false, blocked: false };
    http.request.mockResolvedValue({ id: 'sbx1', preview });
    const resource = new SandboxResource(http);

    const result = await resource.preview('sbx1');

    expect(result).toBe(preview);
    expect(http.request).toHaveBeenCalledWith('GET', `${BASE}/sbx1`);
  });

  it('preview falls back to a default when the sandbox has no preview field', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ id: 'sbx1' });
    const resource = new SandboxResource(http);

    const result = await resource.preview('sbx1');

    expect(result).toEqual({ enabled: true, public: false, ports: [], sharingEnabled: false, blocked: false });
  });

  it('sets preview settings', async () => {
    const http = createMockHttp();
    const response = { enabled: true, public: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxResource(http);

    const result = await resource.setPreview('sbx1', { enabled: true, public: true });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('PATCH', `${BASE}/sbx1/preview`, {
      body: { enabled: true, public: true },
    });
  });

  it('creates a preview share link', async () => {
    const http = createMockHttp();
    const link = { url: 'https://preview.example.com/abc', expiresAt: '2025-01-01T00:00:00Z' };
    http.request.mockResolvedValue(link);
    const resource = new SandboxResource(http);

    const result = await resource.createPreviewLink('sbx1', 3000, { ttlSeconds: 300 });

    expect(result).toBe(link);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/preview-tokens`, {
      body: { port: 3000, ttlSeconds: 300 },
    });
  });

  it('lists listening ports, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxResource(http);

    const result = await resource.listeningPorts('sbx1');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', `${BASE}/sbx1/preview-listening`);
  });

  it('builds a preview URL, defaulting the path to "/"', () => {
    const http = createMockHttp();
    const resource = new SandboxResource(http);

    expect(resource.previewUrl('sbx1', 3000)).toBe(`${BASE}/sbx1/preview/3000/`);
    expect(resource.previewUrl('sbx1', 3000, '/health')).toBe(`${BASE}/sbx1/preview/3000/health`);
    expect(resource.previewUrl('sbx1', 3000, 'health')).toBe(`${BASE}/sbx1/preview/3000/health`);
  });

  it('starts a sandbox', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx1', status: 'running' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.start('sbx1');

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/start`);
  });

  it('stops a sandbox', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx1', status: 'stopped' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.stop('sbx1');

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/stop`);
  });

  it('uploads files', async () => {
    const http = createMockHttp();
    const response = { uploaded: [{ path: 'a.txt', name: 'a.txt', size: 3 }] };
    http.request.mockResolvedValue(response);
    const resource = new SandboxResource(http);
    const files = [{ path: 'a.txt', data: 'aGk=' }];

    const result = await resource.uploadFiles('sbx1', files);

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/files`, { body: { files } });
  });

  it('lists files with cursor/limit options', async () => {
    const http = createMockHttp();
    const response = { items: [] };
    http.request.mockResolvedValue(response);
    const resource = new SandboxResource(http);

    const result = await resource.listFiles('sbx1', { cursor: 'abc', limit: 20 });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('GET', `${BASE}/sbx1/files`, {
      query: { cursor: 'abc', limit: 20 },
    });
  });

  it('downloads a file as binary', async () => {
    const http = createMockHttp();
    const binary = { data: new Uint8Array([1, 2]), contentType: 'text/plain' };
    http.requestBinary.mockResolvedValue(binary);
    const resource = new SandboxResource(http);

    const result = await resource.downloadFile('sbx1', '/tmp/a.txt');

    expect(result).toBe(binary);
    expect(http.requestBinary).toHaveBeenCalledWith('GET', `${BASE}/sbx1/files/download`, {
      query: { path: '/tmp/a.txt' },
    });
  });

  it('snapshots a sandbox', async () => {
    const http = createMockHttp();
    const snapshot = { id: 'snap1' };
    http.request.mockResolvedValue(snapshot);
    const resource = new SandboxResource(http);

    const result = await resource.snapshot('sbx1', { name: 'checkpoint-1' });

    expect(result).toBe(snapshot);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/snapshot`, {
      body: { name: 'checkpoint-1' },
    });
  });

  it('forks a sandbox', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx2' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.fork('sbx1', { name: 'fork-1' });

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fork`, {
      body: { name: 'fork-1' },
    });
  });

  it('lists snapshots, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxResource(http);

    const result = await resource.listSnapshots();

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', '/api/client/v1/sandbox/snapshots');
  });

  it('restores a sandbox from a snapshot', async () => {
    const http = createMockHttp();
    const summary = { id: 'sbx3' };
    http.request.mockResolvedValue(summary);
    const resource = new SandboxResource(http);

    const result = await resource.restoreSnapshot('snap1', { name: 'restored' });

    expect(result).toBe(summary);
    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/api/client/v1/sandbox/snapshots/snap1/restore',
      { body: { name: 'restored' } },
    );
  });

  describe('waitUntilRunning', () => {
    it('resolves as soon as the sandbox reports "running"', async () => {
      const http = createMockHttp();
      const summary = { id: 'sbx1', status: 'running' };
      http.request.mockResolvedValue(summary);
      const resource = new SandboxResource(http);

      const result = await resource.waitUntilRunning('sbx1');

      expect(result).toBe(summary);
      expect(http.request).toHaveBeenCalledTimes(1);
    });

    it('throws when the sandbox enters a terminal "failed" state', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ id: 'sbx1', status: 'failed' });
      const resource = new SandboxResource(http);

      await expect(resource.waitUntilRunning('sbx1')).rejects.toThrow(
        'sandbox sbx1 entered terminal state "failed"',
      );
    });

    it('throws when the timeout elapses before the sandbox is running', async () => {
      const http = createMockHttp();
      http.request.mockResolvedValue({ id: 'sbx1', status: 'starting' });
      const resource = new SandboxResource(http);

      await expect(
        resource.waitUntilRunning('sbx1', { timeoutMs: 1, pollMs: 1 }),
      ).rejects.toThrow(/did not reach "running"/);
    });
  });
});

describe('SandboxFsResource', () => {
  it('lists directory entries, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxFsResource(http);

    const result = await resource.list('sbx1', '/app');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/list`, {
      body: { path: '/app' },
    });
  });

  it('stats a file', async () => {
    const http = createMockHttp();
    const info = { path: '/app/a.txt', size: 3, isDirectory: false };
    http.request.mockResolvedValue(info);
    const resource = new SandboxFsResource(http);

    const result = await resource.info('sbx1', '/app/a.txt');

    expect(result).toBe(info);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/info`, {
      body: { path: '/app/a.txt' },
    });
  });

  it('reads a file, defaulting to utf8 encoding', async () => {
    const http = createMockHttp();
    const readResult = { content: 'hello', encoding: 'utf8' };
    http.request.mockResolvedValue(readResult);
    const resource = new SandboxFsResource(http);

    const result = await resource.read('sbx1', '/app/a.txt');

    expect(result).toBe(readResult);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/read`, {
      body: { path: '/app/a.txt', encoding: 'utf8' },
    });
  });

  it('reads a file with base64 encoding', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ content: 'aGk=', encoding: 'base64' });
    const resource = new SandboxFsResource(http);

    await resource.read('sbx1', '/app/a.bin', 'base64');

    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/read`, {
      body: { path: '/app/a.bin', encoding: 'base64' },
    });
  });

  it('writes a file', async () => {
    const http = createMockHttp();
    const response = { bytesWritten: 5 };
    http.request.mockResolvedValue(response);
    const resource = new SandboxFsResource(http);

    const result = await resource.write('sbx1', '/app/a.txt', 'hello');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/write`, {
      body: { path: '/app/a.txt', content: 'hello', encoding: 'utf8' },
    });
  });

  it('creates a directory', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxFsResource(http);

    const result = await resource.mkdir('sbx1', '/app/newdir');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/mkdir`, {
      body: { path: '/app/newdir', mode: undefined },
    });
  });

  it('deletes a file, defaulting recursive to false', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxFsResource(http);

    const result = await resource.delete('sbx1', '/app/a.txt');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/delete`, {
      body: { path: '/app/a.txt', recursive: false },
    });
  });

  it('moves a file', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxFsResource(http);

    const result = await resource.move('sbx1', '/app/a.txt', '/app/b.txt');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/move`, {
      body: { source: '/app/a.txt', destination: '/app/b.txt' },
    });
  });

  it('finds matches, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxFsResource(http);

    const result = await resource.find('sbx1', '/app', 'TODO');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/find`, {
      body: { path: '/app', pattern: 'TODO' },
    });
  });

  it('replaces across files, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxFsResource(http);

    const result = await resource.replace('sbx1', ['/app/a.txt'], 'foo', 'bar');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/fs/replace`, {
      body: { files: ['/app/a.txt'], pattern: 'foo', newValue: 'bar' },
    });
  });
});

describe('SandboxGitResource', () => {
  it('clones a repository', async () => {
    const http = createMockHttp();
    const response = { ok: true, path: '/app/repo' };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.clone('sbx1', { url: 'https://github.com/x/y.git', path: '/app/repo' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/clone`, {
      body: { url: 'https://github.com/x/y.git', path: '/app/repo' },
    });
  });

  it('gets repo status', async () => {
    const http = createMockHttp();
    const status = { branch: 'main', clean: true };
    http.request.mockResolvedValue(status);
    const resource = new SandboxGitResource(http);

    const result = await resource.status('sbx1', '/app/repo');

    expect(result).toBe(status);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/status`, {
      body: { path: '/app/repo' },
    });
  });

  it('lists branches, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxGitResource(http);

    const result = await resource.branches('sbx1', '/app/repo');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/branches`, {
      body: { path: '/app/repo' },
    });
  });

  it('creates a branch', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.createBranch('sbx1', '/app/repo', 'feature-x');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/branch`, {
      body: { path: '/app/repo', name: 'feature-x' },
    });
  });

  it('deletes a branch', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.deleteBranch('sbx1', '/app/repo', 'feature-x');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/branch/delete`, {
      body: { path: '/app/repo', name: 'feature-x' },
    });
  });

  it('checks out a branch', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.checkout('sbx1', '/app/repo', 'main');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/checkout`, {
      body: { path: '/app/repo', branch: 'main' },
    });
  });

  it('stages files, defaulting to an empty array', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.add('sbx1', '/app/repo');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/add`, {
      body: { path: '/app/repo', files: [] },
    });
  });

  it('commits staged changes', async () => {
    const http = createMockHttp();
    const response = { hash: 'abc123' };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.commit('sbx1', {
      path: '/app/repo',
      message: 'feat: x',
      author: 'Bot',
      email: 'bot@example.com',
    });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/commit`, {
      body: { path: '/app/repo', message: 'feat: x', author: 'Bot', email: 'bot@example.com' },
    });
  });

  it('pushes commits', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.push('sbx1', { path: '/app/repo' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/push`, {
      body: { path: '/app/repo' },
    });
  });

  it('pulls commits', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxGitResource(http);

    const result = await resource.pull('sbx1', { path: '/app/repo' });

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/pull`, {
      body: { path: '/app/repo' },
    });
  });

  it('reads commit log, defaulting limit to 30', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxGitResource(http);

    const result = await resource.log('sbx1', '/app/repo');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/git/log`, {
      body: { path: '/app/repo', limit: 30 },
    });
  });
});

describe('SandboxSessionsResource', () => {
  it('creates a session without a sessionId', async () => {
    const http = createMockHttp();
    const response = { sessionId: 'sess_1' };
    http.request.mockResolvedValue(response);
    const resource = new SandboxSessionsResource(http);

    const result = await resource.create('sbx1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/sessions`, { body: {} });
  });

  it('creates a session with a given sessionId', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({ sessionId: 'sess_1' });
    const resource = new SandboxSessionsResource(http);

    await resource.create('sbx1', 'sess_1');

    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/sessions`, {
      body: { sessionId: 'sess_1' },
    });
  });

  it('lists sessions, defaulting to an empty array', async () => {
    const http = createMockHttp();
    http.request.mockResolvedValue({});
    const resource = new SandboxSessionsResource(http);

    const result = await resource.list('sbx1');

    expect(result).toEqual([]);
    expect(http.request).toHaveBeenCalledWith('GET', `${BASE}/sbx1/sessions`);
  });

  it('deletes a session', async () => {
    const http = createMockHttp();
    const response = { ok: true };
    http.request.mockResolvedValue(response);
    const resource = new SandboxSessionsResource(http);

    const result = await resource.delete('sbx1', 'sess_1');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('DELETE', `${BASE}/sbx1/sessions/sess_1`);
  });

  it('execs a detached command in a session', async () => {
    const http = createMockHttp();
    const response = { commandId: 'cmd_1' };
    http.request.mockResolvedValue(response);
    const resource = new SandboxSessionsResource(http);

    const result = await resource.exec('sbx1', 'sess_1', 'npm test', '/app');

    expect(result).toBe(response);
    expect(http.request).toHaveBeenCalledWith('POST', `${BASE}/sbx1/sessions/sess_1/exec`, {
      body: { command: 'npm test', cwd: '/app' },
    });
  });

  it('fetches command logs', async () => {
    const http = createMockHttp();
    const logs = { stdout: 'ok', stderr: '', exitCode: 0, done: true };
    http.request.mockResolvedValue(logs);
    const resource = new SandboxSessionsResource(http);

    const result = await resource.logs('sbx1', 'sess_1', 'cmd_1');

    expect(result).toBe(logs);
    expect(http.request).toHaveBeenCalledWith(
      'GET',
      `${BASE}/sbx1/sessions/sess_1/commands/cmd_1/logs`,
    );
  });
});
