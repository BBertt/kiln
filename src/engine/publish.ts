import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export interface PublishedArtifact {
  slug: string;
  url: string;
  revisions: { revision: string; url: string }[];
}

export interface PublishResult {
  status: 'deploying' | 'no_changes';
  repositoryUrl: string;
  actionsUrl: string;
  siteUrl: string;
  artifacts: PublishedArtifact[];
  commit?: string;
}

async function run(cwd: string, command: string, args: string[], env = process.env): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (data: string) => { stdout += data; });
  child.stderr.setEncoding('utf8').on('data', (data: string) => { stderr += data; });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve(stdout.trim());
    else reject(new Error(`${command} ${args.join(' ')} failed (${code ?? 'signal'}):\n${stderr || stdout}`));
  });
  return promise;
}

function githubRepository(remote: string): { owner: string; repo: string } {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+)\/([^/\s]+?)\/?$/.exec(remote);
  if (!match) throw new Error('origin must be a GitHub HTTPS or SSH repository URL.');
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

async function publicArtifacts(root: string, siteUrl: string): Promise<PublishedArtifact[]> {
  const directory = path.join(root, 'artifacts');
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const artifacts: PublishedArtifact[] = [];
  for (const entry of entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const revisions = (await readdir(path.join(directory, entry.name), { withFileTypes: true }))
      .filter((revision) => revision.isDirectory() && /^[a-f0-9]{16}$/.test(revision.name))
      .map((revision) => revision.name).sort();
    if (revisions.length === 0) continue;
    const url = `${siteUrl}artifacts/${encodeURIComponent(entry.name)}/`;
    artifacts.push({ slug: entry.name, url, revisions: revisions.map((revision) => ({ revision, url: `${url}revisions/${revision}/` })) });
  }
  return artifacts;
}

/** Requires the generated harness to already be committed on main; publishes only artifacts. */
export async function publishArtifacts(commitMessage: string): Promise<PublishResult> {
  if (!commitMessage.trim()) throw new Error('A non-empty publish commit message is required.');
  const root = path.resolve(process.env.KILN_ROOT || process.cwd());
  const git = (...args: string[]) => run(root, 'git', args);
  const repositoryRoot = await git('rev-parse', '--show-toplevel');
  if (path.resolve(repositoryRoot) !== root) throw new Error('KILN_ROOT must be the Git repository root.');
  if (await git('branch', '--show-current') !== 'main') throw new Error('Publishing requires the main branch.');
  try {
    await git('rev-parse', '--verify', 'HEAD');
  } catch {
    throw new Error('Before publishing, create an initial commit on main containing the complete Kiln harness (including package-lock.json and the Pages workflow). Publishing commits artifacts only.');
  }
  for (const file of ['package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json', '.github/workflows/deploy.yml']) {
    try {
      await git('cat-file', '-e', `HEAD:${file}`);
    } catch {
      throw new Error(`Commit the complete Kiln harness before publishing: ${file} is missing from HEAD. Publishing commits artifacts only.`);
    }
  }
  await git('cat-file', '-e', 'HEAD:src');
  const { owner, repo } = githubRepository(await git('remote', 'get-url', '--push', 'origin'));
  const repositoryUrl = `https://github.com/${owner}/${repo}`;
  const siteUrl = `https://${owner}.github.io/${repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : `${encodeURIComponent(repo)}/`}`;

  // A failed build must never stage, commit, or push artifact changes.
  await run(root, process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    ...process.env,
    KILN_SITE: `https://${owner}.github.io`,
    KILN_BASE: repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${repo}/`,
  });
  const result = {
    repositoryUrl,
    actionsUrl: `${repositoryUrl}/actions/workflows/deploy.yml`,
    siteUrl,
    artifacts: await publicArtifacts(root, siteUrl),
  };
  // Limit both staging and committing to artifacts, preserving unrelated index entries.
  if (result.artifacts.length > 0 || await git('ls-files', '--', 'artifacts')) {
    await git('add', '--all', '--', 'artifacts');
  }
  const changes = await git('diff', '--cached', '--name-only', '--', 'artifacts');
  if (changes) await git('commit', '--only', '-m', commitMessage, '--', 'artifacts');
  const commit = await git('rev-parse', 'HEAD');
  const remoteHead = (await git('ls-remote', 'origin', 'refs/heads/main')).split(/\s/)[0];
  if (remoteHead === commit) return { status: 'no_changes', ...result, commit };
  await git('push', 'origin', 'HEAD:refs/heads/main');
  // A successful push starts Pages deployment; it does not prove deployment completed.
  return { status: 'deploying', ...result, commit };
}
