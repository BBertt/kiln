# Kiln agent instructions

Kiln runs code from trusted local agents. Do not accept code from strangers.
Artifacts become public only when the user asks you to publish them.
Do not put secrets, private data, or credentials in artifacts.

## Authoring

1. Call `list_artifacts` before you choose a slug.
2. Call `create_or_update_artifact` with `slug`, `title`, `framework`, and `code`.
3. Give the user the returned `local_url`.
4. Open the preview and exercise its controls before you report success.
5. If the tool rejects the code, fix the reported error and call it again.

Use lowercase hyphenated slugs. Reuse the slug when the user requests an edit.
Supported frameworks are `react`, `vue`, `svelte`, and `html`.
React code must export a component as its default export.
Vue and Svelte code must contain a complete single-file component.
HTML code contains the markup, style, and script for the artifact body.
Use self-contained components. Import installed packages, not local relative files.
Use Tailwind classes or component styles. Use `lucide-react` for React icons.
The installed UI packages include `framer-motion` and `recharts`.

## Design

Use a mobile-first layout with readable type, clear spacing, and visible focus states.
Include meaningful empty, loading, and error states when the interface needs them.
Keep state inside the component. Do not require a backend server.
Respect reduced-motion preferences. Label inputs and interactive controls.
Use sample data only when the user does not provide data. Label sample data clearly.

## Publishing

Call `publish_artifacts` only after the user asks to publish.
This tool publishes all pending artifact changes, not just the last edited artifact.
Describe that scope before you publish if several artifacts changed.
A successful push starts deployment. It does not prove that the public site is ready.
Do not claim a deployment succeeded until GitHub Actions reports success.
Latest links change with edits. Revision links preserve a particular source revision.
Dependencies and the rendering harness remain shared across revisions.
