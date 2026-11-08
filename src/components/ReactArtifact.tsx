import { Component, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

const sources = import.meta.glob<{ default: ComponentType }>('/artifacts/**/source.tsx');

class ArtifactBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Artifact render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <div className="artifact-status artifact-status--error" role="alert"><strong>This artifact could not render.</strong><pre>{this.state.error}</pre></div>;
    }
    return this.props.children;
  }
}

export default function ReactArtifact({ source }: { source: string }) {
  const [Artifact, setArtifact] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = sources[source];
    if (!load) {
      setError('The source module is missing.');
      return;
    }
    load().then((module) => {
      if (active) setArtifact(() => module.default);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [source]);

  if (error) return <div className="artifact-status artifact-status--error" role="alert"><strong>This artifact could not load.</strong><pre>{error}</pre></div>;
  if (!Artifact) return <div className="artifact-status" role="status"><span className="artifact-spinner" />Loading artifact…</div>;
  return <ArtifactBoundary><Artifact /></ArtifactBoundary>;
}
