import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { artifactInputSchema, createOrUpdateArtifact, listArtifacts, withArtifactMutation, type ArtifactResult } from '../engine/artifacts.js';
import { publishArtifacts } from '../engine/publish.js';

const guideUri = 'kiln://guide/authoring';
const guideFile = new URL('../guide/authoring.md', import.meta.url);

const instructions = `Kiln publishes web artifacts (HTML, React, Vue or Svelte) to a public GitHub Pages site. Every create or update is pushed immediately, so never include secrets or private data, and tell the user the artifact is public.

Before you write an artifact, read the full guide resource ${guideUri}. In short:
- Call list_artifacts first. Reuse the slug to edit; send complete code, not a patch.
- HTML is the default for plans, trackers and reports. React default-exports a component. Vue and Svelte only on request.
- Every artifact must work in light and dark themes. Kiln draws a System/Light/Dark switch (System is the default) and sets data-theme="light" or "dark" on the root element. Never draw your own switch. Take colors from the --kiln-* tokens or Tailwind dark: classes; define any extra colors for both themes.
- Inter is the default font (--kiln-font-sans); use --kiln-font-mono for labels, dates, IDs and pills.
- Use one column, put status and decisions first, and keep data in one list drawn by a script.
- Check the preview in both themes and try every control before reporting. A push starts deployment; it does not prove the site is live.`;

const server = new McpServer({ name: 'kiln', version: '0.2.0' }, { instructions });

server.registerResource('authoring-guide', guideUri, {
  title: 'Kiln artifact guide',
  description: 'How to build Kiln artifacts: formats, light and dark themes, design tokens, Inter typography, templates, and checks before reporting.',
  mimeType: 'text/markdown',
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await readFile(guideFile, 'utf8') }],
}));

async function guidePrompt(template: string, subject: string, notes?: string) {
  const guide = await readFile(guideFile, 'utf8');
  const request = `Build a Kiln artifact about: ${subject}.${notes ? `\nNotes: ${notes}` : ''}`;
  return {
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `${request}\nUse the "${template}" template and follow every rule in the Kiln artifact guide below, including light and dark themes.\n\n${guide}`,
      },
    }],
  };
}

server.registerPrompt('work-tracker', {
  title: 'Work tracker artifact',
  description: 'Plan and track work in the order it ships: now, decisions, work sequence, and log.',
  argsSchema: { subject: z.string().describe('What the tracker covers, such as an issue or project.'), notes: z.string().optional().describe('Facts, links, decisions and progress to include.') },
}, ({ subject, notes }) => guidePrompt('Work tracker', subject, notes));

server.registerPrompt('findings-report', {
  title: 'Findings report artifact',
  description: 'Report a test, comparison or spike: summary, results table, failures, recommendation, method, and sources.',
  argsSchema: { subject: z.string().describe('What was tested or compared.'), notes: z.string().optional().describe('Results, method and sources to include.') },
}, ({ subject, notes }) => guidePrompt('Findings report', subject, notes));

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
  description: `Validate, save, commit, and immediately push a complete HTML, React, Vue, or Svelte artifact to GitHub. Read the guide resource ${guideUri} first: artifacts must support Kiln's light and dark themes and use its design tokens. This also publishes any other pending artifact changes. Supply code, not a patch. React code must default-export a component. Installed npm packages may be imported. Each changed input creates an immutable revision; rejected code leaves the live workspace unchanged. If publishing fails, the local artifact is preserved and the tool reports an error. A successful push starts asynchronous GitHub Pages deployment. Trusted local code only.`,
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
