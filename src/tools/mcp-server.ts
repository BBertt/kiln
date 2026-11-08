import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { artifactInputSchema, createOrUpdateArtifact, listArtifacts, withArtifactMutation } from '../engine/artifacts.js';
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
  description: 'Validate and save a complete HTML, React, Vue, or Svelte artifact. Supply code, not a patch. React code must default-export a component. Installed npm packages may be imported. Each changed input creates an immutable revision; a rejected artifact leaves the live workspace unchanged. Trusted local code only: validation executes a real Astro build.',
  inputSchema: artifactInputSchema.shape,
}, async (input) => {
  try {
    return success({ ...await createOrUpdateArtifact(input) });
  } catch (error) {
    return failure(error);
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
  description: 'Commit the artifact workspace and push it to the configured GitHub repository. The GitHub Pages workflow builds and deploys the site. Requires a configured Git remote and working GitHub credentials.',
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
