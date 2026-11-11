# Kiln artifact guide

Kiln turns code from trusted local agents into web pages called artifacts. Follow this guide every time you create or update one. The guide is also served by the Kiln MCP server as the resource `kiln://guide/authoring`.

Every artifact is public. Its source code and its page are pushed to a public GitHub repository and website. Never put secrets, credentials or private data in an artifact.

## 1. Before you start

1. Call `list_artifacts` to see the existing slugs.
2. To edit an artifact, reuse its slug. To create one, choose a new lowercase, hyphenated slug, such as `checkout-flow-plan`.
3. Tell the user that the artifact will be public.

## 2. When to make an artifact

Make an artifact for substantial, self-contained content that the reader will come back to, share, or keep up to date. Good examples are implementation plans, progress trackers, test results, comparisons, dashboards, and small interactive tools.

Do not make an artifact for a short answer, a single code snippet, or anything that fits in a chat reply.

## 3. Choose a format

| Format | Use it for |
|---|---|
| `html` | Documents, plans, trackers and reports. This is the default. |
| `react` | Interactive tools with real state. |
| `vue`, `svelte` | Only when the user asks for them. |

- `html`: send the markup, `<style>` and `<script>` for the page body. Kiln places it in a frame.
- `react`: the default export must be the component.
- `vue`, `svelte`: send a complete single-file component.

## 4. What is available

- Tailwind CSS classes, including Kiln color classes such as `bg-kiln-surface`, `text-kiln-muted` and `border-kiln-line`.
- The Kiln design tokens in section 6, as CSS variables.
- The Inter font. It is the default font everywhere, so you don't need to load it.
- In React: `lucide-react` for icons, `recharts` for charts, and `framer-motion` for motion.

Import installed packages only. Do not import local files. There is no backend, so keep all state inside the artifact.

## 5. Light and dark themes

Every artifact must work in a light theme and a dark theme.

Kiln draws a theme switch in the top bar of every artifact page and in the gallery. The reader can choose System, Light or Dark. System is the default and follows the device setting. The browser remembers the choice for every artifact on the site.

Kiln marks the page with `data-theme="light"` or `data-theme="dark"` on the root `<html>` element: on the page for React, Vue and Svelte artifacts, and inside the frame for HTML artifacts. The mark changes at once when the reader switches theme.

Your artifact must not draw its own theme switch or store a theme choice. It only has to follow the mark:

- Take every color from the Kiln tokens. They already change with the theme.
- In Tailwind, use `dark:` classes. They follow Kiln's switch.
- If you need colors Kiln does not have, define them with this pattern. It matches the pattern Claude uses in its own artifacts:

```css
:root { color-scheme: light; --series-1: #2a63a3; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; --series-1: #6ea8e8; }
}
:root[data-theme="dark"] { color-scheme: dark; --series-1: #6ea8e8; }
```

HTML artifacts must also set the page colors and the color scheme, so the frame paints correctly in both themes:

```css
:root { color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; } }
:root[data-theme="dark"] { color-scheme: dark; }
body { margin: 0; background: var(--kiln-bg); color: var(--kiln-text); font-family: var(--kiln-font-sans); }
```

- Never hard-code a color outside these blocks. This includes inline `style` attributes, SVG attributes and markup built by scripts.
- SVG presentation attributes cannot read CSS variables. Use classes or `style="fill: var(--kiln-text)"`, or use `currentColor`.
- Give charts their colors from tokens.
- Keep text contrast at 4.5 to 1 or more in both themes.

## 6. Design system

Kiln's look follows Claude's artifacts. They use one sans font plus a mono font for metadata, a token block at the top, one reading column, and small status pills.

### Color tokens

| Token | Use |
|---|---|
| `--kiln-bg` | Page background |
| `--kiln-surface` | Cards, tables, panels |
| `--kiln-surface-2` | Table heads, code, quiet pills, tinted boxes |
| `--kiln-line`, `--kiln-line-strong` | Borders and dividers |
| `--kiln-text` | Main text |
| `--kiln-muted` | Secondary text, labels, captions |
| `--kiln-accent` | Clay accent for markers, progress bars and underlines. Never for small text. |
| `--kiln-accent-strong` | Focus rings and active states |
| `--kiln-accent-text`, `--kiln-accent-wash` | Accent as text, and its tint |
| `--kiln-ok`, `--kiln-ok-wash` | Done, passing, shipped, settled |
| `--kiln-warn`, `--kiln-warn-wash` | In progress, at risk |
| `--kiln-bad`, `--kiln-bad-wash` | Blocked, failing, needs the reader |
| `--kiln-info`, `--kiln-info-wash` | In review, neutral highlights, links in diagrams |

Each text token passes 4.5 to 1 on its matching wash and on the background and surfaces.

### Subject palettes

When the artifact's subject has its own brand, the artifact may use the brand's colors and fonts instead of Kiln's. Define them as local tokens, with a dark value for every color, using the pattern in section 5. Otherwise, use Kiln's tokens.

### Type

| Role | Font | Size and weight |
|---|---|---|
| Page title | `--kiln-font-sans` | 30 to 44px, weight 500, letter spacing −0.035em |
| Section title | `--kiln-font-sans` | 22 to 24px, weight 600, with a mono count beside it |
| Body text | `--kiln-font-sans` | 15 to 16px, line height 1.55 to 1.6 |
| Labels, dates, IDs, counts, pills | `--kiln-font-mono` | 12 to 12.5px |

Keep prose lines under about 68 characters.

### Layout and shape

- Use one column, 920 to 1100px wide, with about 48px between sections. Tables, diagrams and code may use the full width.
- Put what the reader must act on first.
- Use 16 to 20px corners on large panels, 10 to 12px on cards and tables, and fully round corners on pills.
- Wrap wide tables so they scroll sideways on phones.

### Parts to reuse

- **Status pill**: mono text with a small dot, colored text on its wash.
- **Count**: a mono count next to a section title, such as "2 open, 6 settled".
- **Now panel**: three columns for working on, next, and waiting on you. Waiting turns `--kiln-bad` when something needs the reader.
- **Decision card**: the question, context, options, a "Recommended:" box on `--kiln-surface-2`, and "Decided: …" with a date once settled. Open decisions come first.
- **Phase timeline**: short phase codes on a rail joined by a line. Each phase has a title, a status pill, a summary, links and its dependencies.
- **Step checklist**: a progress bar with an `aria-label` such as "3 of 5 steps done", then collapsible steps. Done steps are struck through. Active phases are open by default.
- **Log**: newest first, with the date in mono, then the phase code and one line of what happened.
- **Summary and stat cards**: key and value pairs for each option, then small cards with a label, a value and a note.
- **Results table**: sticky headers, aligned numbers, colored scores, and filter buttons with `aria-pressed`.
- **Callout**: a tinted box with an accent edge, for caveats.
- **Sources**: a numbered list, then a dated footer.

### Rules

Do:

- Put status, counts and decisions on the first screen.
- Keep data in one list or object and draw it with a script. Insert text with `textContent`, never raw HTML, and allow only `https:` links.
- Write empty, loading and failed states that say what will appear.
- Write in the reader's language and set the `lang` attribute.
- Label every control, keep focus visible, and animate only when `prefers-reduced-motion` allows it.

Avoid:

- Hard-coded colors outside the token blocks.
- Purple gradients and centered body text.
- The same card style for every block.
- Using the accent for more than one job.
- Entrance animations on every section.

## 7. Templates

### Work tracker (plans and progress)

1. Header: links to the issue and design in mono, the update time, the title, and one sentence on what the page tracks.
2. Now: working on, next, waiting on you.
3. Decisions, with a count. Open decisions come first, each with a recommendation.
4. Work sequence, with a count. Phases come in shipping order, each with its steps.
5. Log, newest first.
6. Footer: who updates the page and how.

Kiln has no live storage. To update a tracker, edit its data list and send the full code again. Each update becomes a revision that the reader can go back to.

### Findings report (tests, comparisons, spikes)

1. Header: title, one sentence, and chips for date, version and sample size.
2. Summary: one card per option, then stat cards for the winners.
3. The main results table, with filters.
4. What could not be tested, and why.
5. Recommendation.
6. Alternatives, and why they lost.
7. Method and limits.
8. Sources and a dated footer.

### HTML starter

```html
<style>
  :root { color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; } }
  :root[data-theme="dark"] { color-scheme: dark; }
  body { margin: 0; padding: 0 16px; background: var(--kiln-bg); color: var(--kiln-text); font: 15px/1.55 var(--kiln-font-sans); }
  .wrap { max-width: 920px; margin: 0 auto; padding-block: 40px 72px; display: flex; flex-direction: column; gap: 48px; }
  h1 { margin: 0; font-size: clamp(30px, 6vw, 44px); line-height: 1.08; font-weight: 500; letter-spacing: -0.035em; }
  .muted { color: var(--kiln-muted); }
  .mono { font-family: var(--kiln-font-mono); font-size: 12.5px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font: 12px var(--kiln-font-mono); background: var(--kiln-surface-2); color: var(--kiln-muted); }
  .pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .pill.ok { background: var(--kiln-ok-wash); color: var(--kiln-ok); }
</style>
<div class="wrap">
  <header>
    <p class="mono muted">Updated 11 Nov 2026</p>
    <h1>Title in sentence case</h1>
    <p class="muted">One sentence on what this page is for.</p>
  </header>
</div>
```

## 8. Create or update

- Call `create_or_update_artifact` with `slug`, `title`, `framework`, `code`, and optional `metadata` with a `description` and `tags`.
- Always send the complete code, not a patch.
- Each change creates a new revision. The latest link moves to the new revision, and revision links keep older versions.
- If the tool rejects the code, fix the reported error and call it again.

## 9. Check before reporting

1. Open the local preview link the tool returns.
2. Look at the artifact in both themes with the switch in the top bar, and try every control.
3. Give the user the `local_url` and the public links from `publication`.
4. A successful push only starts deployment. Do not say the public site is updated until GitHub Actions reports success.
