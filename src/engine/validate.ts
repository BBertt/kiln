import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface Candidate {
  slug: string;
  revision: string;
  extension: string;
  code: string;
  manifest: object;
}
const excluded: Record<string, true> = { '.git': true, '.astro': true, '.kiln': true, node_modules: true, dist: true };
const maximumLogLength = 32_000;

async function dependencyDirectory(root: string): Promise<string> {
  let current = root;
  for (;;) {
    const directory = path.join(current, 'node_modules');
    try {
      await stat(path.join(directory, 'astro', 'package.json'));
      return directory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Astro dependencies are missing. Run npm install in the Kiln project before creating artifacts.');
    }
    current = parent;
  }
}

async function runAstro(cli: string, workspace: string, arguments_: string[]): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  let log = '';
  const child = spawn(process.execPath, [cli, ...arguments_], {
    cwd: workspace,
    env: { ...process.env, CI: 'true', ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collect = (chunk: Buffer) => {
    log = (log + chunk.toString()).slice(-maximumLogLength);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.once('error', (error) => reject(new Error(`Could not start Astro validation: ${error.message}`)));
  child.once('close', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`Artifact validation failed during astro ${arguments_[0]} (${signal ? `signal ${signal}` : `exit ${code}`}):\n${log.trim() || 'Astro returned no diagnostic output.'}`));
  });
  await promise;
}

/** Build a disposable snapshot, never running candidate code against the live artifact tree. */
export async function validateCandidate(root: string, candidate: Candidate): Promise<void> {
  const dependencies = await dependencyDirectory(root);
  const require = createRequire(path.join(root, 'package.json'));
  let cli: string;
  try {
    const packageFile = require.resolve('astro/package.json');
    const package_ = JSON.parse(await readFile(packageFile, 'utf8')) as { bin: string | Record<string, string> };
    const bin = typeof package_.bin === 'string' ? package_.bin : package_.bin.astro;
    if (!bin) throw new Error('The installed Astro package has no CLI.');
    cli = path.resolve(path.dirname(packageFile), bin);
    require.resolve('@astrojs/check');
  } catch (error) {
    throw new Error(`Astro validation dependencies are unavailable. Run npm install, including @astrojs/check and typescript. ${error instanceof Error ? error.message : String(error)}`);
  }

  const workspace = await mkdtemp(path.join(tmpdir(), 'kiln-validation-'));
  try {
    // Every snapshot shares installed dependencies, but build outputs and all source
    // files are isolated. Existing revisions remain present for the gallery globs.
    await cp(root, workspace, {
      recursive: true,
      filter: (entry) => entry === root || !Object.hasOwn(excluded, path.basename(entry)),
    });
    await symlink(dependencies, path.join(workspace, 'node_modules'), 'dir');
    const artifactDirectory = path.join(workspace, 'artifacts', candidate.slug);
    const revisionDirectory = path.join(artifactDirectory, candidate.revision);
    await mkdir(revisionDirectory, { recursive: true });
    await writeFile(path.join(revisionDirectory, 'artifact.json'), `${JSON.stringify(candidate.manifest, null, 2)}\n`);
    await writeFile(path.join(revisionDirectory, `source.${candidate.extension}`), candidate.code);
    await writeFile(path.join(artifactDirectory, 'latest.json'), `${JSON.stringify({ revision: candidate.revision })}\n`);
    await runAstro(cli, workspace, ['check', '--minimumFailingSeverity', 'error']);
    await runAstro(cli, workspace, ['build']);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
