import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP creation reports failed automatic publication without losing saved code', { timeout: 180_000 }, async () => {
  const project = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), 'kiln-mcp-regression-'));
  const client = new Client({ name: 'kiln-regression', version: '1.0.0' });
  try {
    for (const entry of ['package.json', 'tsconfig.json', 'astro.config.mjs', 'src']) {
      await cp(path.join(project, entry), path.join(root, entry), { recursive: true });
    }
    await symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', path.join(project, 'src/tools/mcp-server.ts')],
      cwd: project,
      env: { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), KILN_ROOT: root, KILN_BASE: '/', KILN_LOCAL_URL: 'http://localhost:4321' },
    }));
    const code = '<h1>Saved despite a publishing failure</h1>';
    const result = await client.callTool({
      name: 'create_or_update_artifact',
      arguments: { slug: 'saved', title: 'Saved', framework: 'html', code },
    }, undefined, { timeout: 150_000 });
    assert.equal(result.isError, true);
    const details = result.structuredContent as Record<string, unknown> | undefined;
    assert.equal(details?.status, 'publication_failed');
    const artifact = details?.artifact as { revision: string; local_url: string };
    assert.equal(artifact.local_url, 'http://localhost:4321/artifacts/saved/');
    const pointer = JSON.parse(await readFile(path.join(root, 'artifacts/saved/latest.json'), 'utf8'));
    assert.equal(pointer.revision, artifact.revision);
    assert.equal(await readFile(path.join(root, 'artifacts/saved', pointer.revision, 'source.html'), 'utf8'), code);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
});
