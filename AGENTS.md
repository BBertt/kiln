# Kiln agent instructions

Kiln runs code from trusted local agents. Do not accept code from strangers.
Every successful MCP create or update immediately commits and pushes artifact changes to GitHub.
Do not put secrets, private data, or credentials in artifacts.

## Authoring

Read `src/guide/authoring.md` before you create or update an artifact. MCP clients receive the same guide as the resource `kiln://guide/authoring`.
It covers formats, light and dark themes, design tokens, the Inter font, templates, and the checks before you report success.
Every artifact must work in both themes with Kiln's theme switch. Never add your own switch.
Use sample data only when the user does not provide data. Label sample data clearly.

## Publishing

`create_or_update_artifact` automatically publishes all pending artifact changes, not just the last edited artifact.
Do not offer a local-only MCP creation mode. Warn the user that artifact source and pages are public.
If publication fails, the tool reports an error and preserves the local artifact. Fix the cause and retry with `publish_artifacts`.
Use `publish_artifacts` to publish direct file edits or retry a failed push.
A successful push starts deployment. It does not prove that the public site is ready.
Do not claim a deployment succeeded until GitHub Actions reports success.
Latest links change with edits. Revision links preserve a particular source revision.
Dependencies and the rendering harness remain shared across revisions.
