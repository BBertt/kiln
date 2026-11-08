import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOrUpdateArtifact, listArtifacts } from '../src/engine/artifacts.js';

test('invalid updates preserve latest; framework changes retain previous revisions', { timeout: 240_000 }, async () => {
  const project = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), 'kiln-regression-'));
  const oldRoot = process.env.KILN_ROOT;
  try {
    for (const entry of ['package.json', 'tsconfig.json', 'astro.config.mjs', 'src']) {
      await cp(path.join(project, entry), path.join(root, entry), { recursive: true });
    }
    await symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    process.env.KILN_ROOT = root;
    const first = await createOrUpdateArtifact({ slug: 'preserved', title: 'Original', framework: 'html', code: '<h1>Original content</h1>' });
    const pointerPath = path.join(root, 'artifacts/preserved/latest.json');
    const pointer = await readFile(pointerPath, 'utf8');
    await assert.rejects(createOrUpdateArtifact({ slug: 'preserved', title: 'Broken', framework: 'react', code: 'export default function Broken( {' }));
    assert.equal(await readFile(pointerPath, 'utf8'), pointer);
    const second = await createOrUpdateArtifact({ slug: 'preserved', title: 'Changed', framework: 'react', code: 'export default function Changed() { return <h1>Changed content</h1>; }' });
    assert.notEqual(first.revision, second.revision);
    assert.equal(await readFile(path.join(root, `artifacts/preserved/${first.revision}/source.html`), 'utf8'), '<h1>Original content</h1>');
    assert.equal(JSON.parse(await readFile(pointerPath, 'utf8')).revision, second.revision);
    const listed = await listArtifacts();
    assert.equal(listed.artifacts.find((item) => item.slug === 'preserved')?.framework, 'react');
    await assert.rejects(createOrUpdateArtifact({ slug: '../escape', title: 'No', framework: 'html', code: '<p>No</p>' }));
  } finally {
    if (oldRoot === undefined) delete process.env.KILN_ROOT;
    else process.env.KILN_ROOT = oldRoot;
    await rm(root, { recursive: true, force: true });
  }
});
