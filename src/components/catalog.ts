export type ArtifactFramework = 'html' | 'react' | 'vue' | 'svelte';

export interface ArtifactRecord {
  slug: string;
  title: string;
  framework: ArtifactFramework;
  metadata: { description?: string; tags?: string[] };
  revision: string;
  updated_at: string;
}

const records = import.meta.glob<ArtifactRecord>('/artifacts/**/artifact.json', {
  eager: true,
  import: 'default',
});
const pointers = import.meta.glob<{ revision: string }>('/artifacts/*/latest.json', {
  eager: true,
  import: 'default',
});

export function getRevisions(): ArtifactRecord[] {
  return Object.values(records).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getLatestArtifacts(): ArtifactRecord[] {
  return getRevisions().filter((artifact) =>
    pointers[`/artifacts/${artifact.slug}/latest.json`]?.revision === artifact.revision,
  );
}

export function artifactUrl(artifact: ArtifactRecord, immutable = false): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = `${base}/artifacts/${encodeURIComponent(artifact.slug)}/`;
  return immutable ? `${path}revisions/${artifact.revision}/` : path;
}

export function homeUrl(): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
}
