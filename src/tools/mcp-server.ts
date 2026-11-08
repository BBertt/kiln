import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { artifactInputSchema, createOrUpdateArtifact, listArtifacts, withArtifactMutation, type ArtifactResult } from '../engine/artifacts.js';
import { publishArtifacts } from '../engine/publish.js';

const server = new McpServer({ name: 'kiln', version: '0.1.0' });

function success(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: error instanceof Error ? error.message : String(error),
    }],
  };
}

server.registerTool('create_or_update_artifact', {
  title: 'Create or update an artifact',
  description: 'Validate, save, commit, and immediately push a complete HTML, React, Vue, or Svelte artifact to GitHub. This also publishes any other pending artifact changes. Supply code, not a patch. React code must default-export a component. Installed npm packages may be imported. Each changed input creates an immutable revision; rejected code leaves the live workspace unchanged. If publishing fails, the local artifact is preserved and the tool reports an error. A successful push starts asynchronous GitHub Pages deployment. Trusted local code only.',
  inputSchema: artifactInputSchema.shape,
}, async (input) => {
  let artifact: ArtifactResult | undefined;
  try {
    artifact = await createOrUpdateArtifact(input);
    const publication = await withArtifactMutation(() => publishArtifacts(`feat(artifacts): update ${input.slug}`));
    return success({ ...artifact, publication });
  } catch (error) {
    if (!artifact) return failure(error);
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: `Artifact saved locally but publication failed. Retry publish_artifacts after fixing the error.\n${error instanceof Error ? error.message : String(error)}\n${JSON.stringify({ artifact }, null, 2)}`,
      }],
      structuredContent: { status: 'publication_failed', artifact },
    };
  }
});

server.registerTool('list_artifacts', {
  title: 'List artifacts',
  description: 'List each artifact’s current revision, metadata, source file path, local latest URL, and immutable revision URL.',
  inputSchema: {},
}, async () => {
  try {
    return success(await listArtifacts());
  } catch (error) {
    return failure(error);
  }
});

server.registerTool('publish_artifacts', {
  title: 'Publish artifacts',
  description: 'Retry a failed automatic publication or publish pending artifact files edited directly on disk. Builds, commits all pending artifact changes, and pushes to GitHub. A successful push starts asynchronous GitHub Pages deployment. Requires a configured Git remote and working GitHub credentials.',
  inputSchema: {
    commit_message: z.string().trim().min(1).default('Publish Kiln artifacts'),
  },
}, async ({ commit_message }) => {
  try {
    const result = await withArtifactMutation(() => publishArtifacts(commit_message));
    return success({ ...result });
  } catch (error) {
    return failure(error);
  }
});

// stdout is exclusively the MCP transport. Diagnostics and startup failures go to stderr.
try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  process.stderr.write(`Kiln MCP server failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
