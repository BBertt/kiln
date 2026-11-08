import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validateCandidate } from './validate.js';

export const artifactInputSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case slug, such as sales-dashboard.'),
  title: z.string().trim().min(1),
  framework: z.enum(['html', 'react', 'vue', 'svelte']),
  code: z.string().min(1).refine((code) => code.trim().length > 0, 'Artifact code must not be blank.'),
  metadata: z.object({
    description: z.string().optional(),
    tags: z.array(z.string().trim().min(1)).default([]),
  }).default({ tags: [] }),
});

export type ArtifactInput = z.input<typeof artifactInputSchema>;
export type ArtifactFramework = z.infer<typeof artifactInputSchema>['framework'];
export interface ArtifactManifest {
  slug: string;
  title: string;
  framework: ArtifactFramework;
  metadata: { description?: string; tags: string[] };
  revision: string;
  updated_at: string;
}
export interface ArtifactResult extends ArtifactManifest {
  local_url: string;
  revision_url: string;
  file_path: string;
}

const extensions: Record<ArtifactFramework, string> = { html: 'html', react: 'tsx', vue: 'vue', svelte: 'svelte' };
const revisionPattern = /^[a-f0-9]{16}$/;
let mutationQueue: Promise<void> = Promise.resolve();

/** Keep the MCP process's writes and publication snapshots ordered, even after errors. */
export function withArtifactMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function artifactResult(root: string, manifest: ArtifactManifest): ArtifactResult {
  const local = new URL(process.env.KILN_LOCAL_URL || 'http://localhost:4321');
  if (!['http:', 'https:'].includes(local.protocol)) throw new Error('KILN_LOCAL_URL must be an HTTP or HTTPS URL.');
  const base = (process.env.KILN_BASE || '/').replace(/^\/+|\/+$/g, '');
  const localPath = local.pathname.replace(/\/+$/, '');
  const basePath = base && localPath !== `/${base}` && !localPath.endsWith(`/${base}`) ? `${localPath}/${base}` : localPath;
  local.pathname = `${basePath}/artifacts/${manifest.slug}/`;
  local.search = '';
  local.hash = '';
  return {
    ...manifest,
    local_url: local.href,
    revision_url: new URL(`revisions/${manifest.revision}/`, local).href,
    file_path: path.join(root, 'artifacts', manifest.slug, manifest.revision, `source.${extensions[manifest.framework]}`),
  };
}

async function readManifest(directory: string, slug: string, revision: string): Promise<ArtifactManifest> {
  const value = JSON.parse(await readFile(path.join(directory, revision, 'artifact.json'), 'utf8')) as ArtifactManifest;
  if (value.slug !== slug || value.revision !== revision || !Object.hasOwn(extensions, value.framework)) {
    throw new Error(`Artifact ${slug} has inconsistent revision metadata at ${revision}.`);
  }
  return value;
}

/** Validate before committing a new immutable revision and atomically switching latest. */
export async function createOrUpdateArtifact(input: ArtifactInput): Promise<ArtifactResult> {
  const parsed = artifactInputSchema.parse(input);
  const root = path.resolve(process.env.KILN_ROOT || process.cwd());
  return withArtifactMutation(async () => {
    // Explicit key order and normalized defaults make the revision independent of
    // the caller's JSON property order and of timestamps or filesystem paths.
    const canonical = {
      slug: parsed.slug,
      title: parsed.title,
      framework: parsed.framework,
      metadata: {
        ...(parsed.metadata.description === undefined ? {} : { description: parsed.metadata.description }),
        tags: parsed.metadata.tags,
      },
      code: parsed.code,
    };
    const revision = createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
    const artifactDirectory = path.join(root, 'artifacts', parsed.slug);
    const revisionDirectory = path.join(artifactDirectory, revision);
    let existing: ArtifactManifest | undefined;
    try {
      existing = await readManifest(artifactDirectory, parsed.slug, revision);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    const manifest: ArtifactManifest = existing || {
      slug: parsed.slug,
      title: parsed.title,
      framework: parsed.framework,
      metadata: canonical.metadata,
      revision,
      updated_at: new Date().toISOString(),
    };
    // Resolve configuration errors before any writes, including the latest pointer.
    const result = artifactResult(root, manifest);
    await validateCandidate(root, {
      slug: parsed.slug,
      revision,
      extension: extensions[parsed.framework],
      code: parsed.code,
      manifest,
    });

    const stagingRoot = path.join(root, '.kiln', 'staging');
    await mkdir(stagingRoot, { recursive: true });
    const staging = await mkdtemp(path.join(stagingRoot, 'revision-'));
    const pointer = path.join(artifactDirectory, `.latest-${randomUUID()}.json`);
    let committedRevision = false;
    let createdArtifactDirectory = false;
    try {
      if (!existing) {
        await writeFile(path.join(staging, 'artifact.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
        await writeFile(path.join(staging, `source.${extensions[parsed.framework]}`), parsed.code, { flag: 'wx' });
      }
      await mkdir(path.dirname(artifactDirectory), { recursive: true });
      try {
        await mkdir(artifactDirectory);
        createdArtifactDirectory = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }
      if (!existing) {
        await rename(staging, revisionDirectory);
        committedRevision = true;
      }
      await writeFile(pointer, `${JSON.stringify({ revision })}\n`, { flag: 'wx' });
      await rename(pointer, path.join(artifactDirectory, 'latest.json'));
    } catch (error) {
      await rm(pointer, { force: true });
      if (committedRevision) await rm(revisionDirectory, { recursive: true, force: true });
      if (createdArtifactDirectory) await rmdir(artifactDirectory);
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    return result;
  });
}

/** List the currently selected revision of every artifact, without a mutable index. */
export async function listArtifacts(): Promise<{ artifacts: ArtifactResult[]; total_artifacts: number }> {
  const root = path.resolve(process.env.KILN_ROOT || process.cwd());
  const directory = path.join(root, 'artifacts');
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return { artifacts: [], total_artifacts: 0 };
    throw error;
  }
  const results: ArtifactResult[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || !artifactInputSchema.shape.slug.safeParse(entry.name).success) continue;
    const artifactDirectory = path.join(directory, entry.name);
    let latest: { revision: string };
    try {
      latest = JSON.parse(await readFile(path.join(artifactDirectory, 'latest.json'), 'utf8')) as { revision: string };
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
    if (!revisionPattern.test(latest.revision)) throw new Error(`Artifact ${entry.name} has an invalid latest revision pointer.`);
    results.push(artifactResult(root, await readManifest(artifactDirectory, entry.name, latest.revision)));
  }
  return { artifacts: results, total_artifacts: results.length };
}
