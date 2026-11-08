# Kiln

Kiln gives local coding agents a shared place to create, preview, and publish web artifacts.
It supports React, Vue, Svelte, and HTML. Your agent supplies the code through MCP tools.
Kiln does not run a model and does not need a model API key.

## Requirements

Use Node.js 22.12 or newer and Git. Connect an agent that supports MCP over standard input and output.
Use trusted code only. Compilation runs code on your machine. Preview frames are not a security boundary.
GitHub Pages serves static files. Artifacts cannot depend on a private server or hide secrets in browser code.

## Local use

```sh
npm ci
npm run dev
```

Open http://localhost:4321/ for the gallery. Keep the development server running while your agent creates artifacts.
Each successful MCP create or update saves the artifact, commits pending artifact changes, and immediately pushes to GitHub.
The response includes local preview links and a `publication` result with public links and deployment status.
Kiln checks types and builds a temporary copy before it replaces the latest revision.
This validation takes longer than the browser refresh. The refresh target is not a timing guarantee.

## Connect your agent

Add this server to your agent's MCP configuration. Replace the absolute path if you move the project.
The `KILN_ROOT` variable makes the server independent of the agent's working directory.

```json
{
  "mcpServers": {
    "kiln": {
      "command": "npm",
      "args": ["--prefix", "/home/bertrand/Projects/personal/kiln", "run", "--silent", "mcp"],
      "env": {
        "KILN_ROOT": "/home/bertrand/Projects/personal/kiln"
      }
    }
  }
}
```

Ask the agent to read `AGENTS.md`. Then ask it to create an artifact with Kiln.
For example: “Use Kiln to make and publish an interactive expense dashboard.”
Your agent decides how to write the interface. Kiln handles files, validation, preview routes, and publishing.

## Tools

`create_or_update_artifact` accepts `slug`, `title`, `framework`, `code`, and optional `metadata`.
Creation and updates automatically publish all pending artifact changes. There is no local-only mode for this MCP tool.
If publication fails, the tool returns an error with the saved artifact details. The local artifact remains available.
Fix the publishing error, then retry `publish_artifacts`. Invalid code is rejected before any save or push.
The framework is `react`, `vue`, `svelte`, or `html`.
Metadata supports a description and an array of tags.
React code exports a default component. Vue and Svelte use complete single-file components.
HTML code supplies the page body, with optional styles and scripts.
Components can import installed packages. They cannot depend on sibling files.

```json
{
  "slug": "hello",
  "title": "Hello",
  "framework": "html",
  "code": "<h1>Hello from Kiln</h1>",
  "metadata": { "description": "A first artifact", "tags": ["example"] }
}
```

`list_artifacts` returns the current artifacts and their local preview links.
`publish_artifacts` accepts a `commit_message`. Use it to retry failed publication or publish direct file edits.
Both publication paths build the site, commit pending artifact changes, and push to `origin/main`.
They preserve unrelated staged files. A push starts deployment but does not prove that deployment succeeded.

## Revisions

Each accepted input gets a content-based revision identifier.
Kiln stores the source and metadata under `artifacts/<slug>/<revision>/`.
The `latest.json` file selects the current revision.
The latest route is `/artifacts/<slug>/`. A revision route is `/artifacts/<slug>/revisions/<revision>/`.
Kiln never overwrites an existing source revision. It keeps old revisions when you change frameworks.
Revision links preserve source, not an isolated dependency environment. Changes to packages or the rendering code can affect old revisions.
Do not delete revision directories if you need their links to keep working.

## GitHub Pages

This project is published at https://bbertt.github.io/kiln/.
The public template repository is https://github.com/BBertt/kiln.

Sign in with `gh auth login`. Create a GitHub repository and set it as the `origin` remote.
The repository needs an initial commit on `main` that contains the complete Kiln project, including its lockfile and deployment workflow.
The publishing tool only commits files under `artifacts/`. Commit intentional changes to the project code separately.
Enable GitHub Pages with GitHub Actions as its build source.
Free Pages hosting generally requires a public repository. A public repository exposes artifact source as well as the rendered pages.
MCP creates and updates publish automatically. Direct file edits do not trigger a push until you call `publish_artifacts`.

The workflow builds on pushes to `main`. It calculates the site origin and repository base path through GitHub Pages.
Use the workflow link returned by the publishing tool to inspect deployment status.
The expected address is `https://<owner>.github.io/<repository>/`.
A custom domain is optional and is not configured by default.

## Configuration

`KILN_ROOT` selects the project directory for MCP tools.
`KILN_LOCAL_URL` selects the preview origin. Its default is `http://localhost:4321`.
`KILN_SITE` sets the site origin during builds. `KILN_BASE` sets the path prefix, such as `/kiln/`.
Local use defaults to the root path. All gallery links include the configured path prefix.

## Verification

```sh
npm test
npm run build
```

The regression test uses a temporary project. It checks that a rejected update preserves the latest revision and that a framework change retains old source.

Smoke checks exercised all three MCP tools and browser interactions for all four frameworks.
A revision update refreshed the local preview without manual navigation.
A build under `/kiln/` served working links, React interaction, and separate latest and historical HTML pages.
A temporary local Git remote received artifact commits while an unrelated staged file stayed out of the commit.
GitHub Actions completed the Pages deployment. Browser checks on the public site exercised search and all four frameworks.
Public latest and historical HTML links served their separate revisions.

No project license is selected yet.
