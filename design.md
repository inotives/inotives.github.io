# inoTives Design Direction

Reference: https://aiengineeringfromscratch.com/

This site uses a dark technical field-manual aesthetic: dense, readable, direct, and built around documents, notes, project artifacts, research reports, and portfolio records. The target feeling is not a startup landing page. It should feel like a working notebook, lab manual, market research archive, and crypto/data operations console sharing one visual system.

## Design Principles

- Prioritize text, structure, and scanability over decoration.
- Use page sections as document bands, not floating marketing cards.
- Make status, progress, dates, and metadata visible with small mono labels.
- Prefer square edges, hard rules, and simple blocks over soft rounded surfaces.
- Let one strong accent color carry interaction and state.
- Keep the interface compact enough for repeated use, especially projects, notes, research reports, and resume content.

## Visual Language

The reference site uses an off-white paper surface, black ink, blueprint-blue accents, fixed header, mono metadata labels, uppercase display headings, dotted/grid texture, thin rules, square controls, and document-like section breaks.

For inoTives, adapt that into a "market manual" theme:

- Background: dark neutral gray, not pure black and not saturated slate.
- Surfaces: slightly lighter dark gray panels for records, forms, and framed tools.
- Accent: neon cyan (`#1fefd7`) for links, active nav, labels, headings, focus states, and primary actions.
- Ink: near-white text with cool muted gray metadata.
- Texture: subtle radial-dot or grid background, low contrast.
- Edges: 0-4px radius for controls and panels; avoid pill buttons and soft cards.
- Separators: thin horizontal rules, ASCII-like dividers, table borders, and explicit section labels.

## Design Tokens

Suggested CSS variables:

```css
:root {
  --font-display: "VT323", "Source Code Pro", ui-monospace, monospace;
  --font-body: "Open Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "Source Code Pro", ui-monospace, Consolas, monospace;

  --bg: #0f1115;
  --surface: #171b22;
  --surface-hover: #202631;
  --surface-strong: #12151b;
  --ink: #f8fafc;
  --ink-soft: #cbd5e1;
  --ink-muted: #94a3b8;
  --rule: rgba(248, 250, 252, 0.16);
  --paper-rule: rgba(248, 250, 252, 0.07);
  --accent: #1fefd7;
  --accent-hover: #7ffbef;
  --accent-soft: rgba(31, 239, 215, 0.14);
  --title-accent: var(--accent);
  --warning: #f6c453;
}
```

Tailwind equivalents should be centralized through theme variables or reusable component classes rather than repeated literal `gray-*`, `slate-*`, and `blue-*` utilities.

## Typography

- Page titles: uppercase display mono, large, tight line-height, accent color.
- Section titles: uppercase display mono, accent color, with a mono subtitle below.
- Body copy: Open Sans, 16-18px, relaxed line height.
- Metadata: mono, uppercase, 11-13px, increased letter spacing.
- Code, dates, tags, dashboard labels: mono with tabular numerals.

Avoid heavy `font-bold` as the default signal. Use hierarchy, spacing, labels, and rules first.

## Layout

- Global max width: `1200px` for indexes and dashboard lists.
- Reading max width: `720px-820px` for notes/article content.
- Header: sticky or fixed, translucent dark-gray background, thin bottom rule.
- Main spacing: generous section padding on desktop, compact on mobile.
- Section structure:
  - mono figure or section label
  - uppercase title
  - short explanatory line
  - content grid, list, table, or prose
- Avoid nested cards. Use rows, tables, panels, and bordered modules instead.

## Components

### Header

- Brand: `inoTives` as uppercase/manual-style wordmark.
- Nav links: mono uppercase, no rounded pills.
- Active nav: accent color or thin underline/rule.
- Mobile nav: compact dropdown with rule-separated rows.

### Links and Buttons

- Links use accent color and a thin underline on hover.
- Primary buttons are square, mono uppercase, accent fill.
- Secondary buttons are transparent or dark-surface with light ink border.
- Icon-only buttons should be square and have accessible labels.

### Cards and Panels

Use cards only for repeated objects such as posts, projects, or dashboard entries. Cards should feel like catalog records:

- thin border
- dark gray surface
- 0-4px radius
- mono metadata row
- title
- short description
- tags/status line
- hover changes border/background, not scale or shadow

### Notes

Notes pages should read like reference entries:

- date and category above title
- clear title and deck
- prose with readable sans body text
- code blocks on dark muted surface
- headings in display mono
- callouts as bordered notes, not colored cards
- note detail pages can include an "On This Page" index generated from `h2` and `h3` headings
- the table of contents should be sticky beside long articles on desktop and stack above content on mobile
- note content is markdown-backed from `content/posts` and indexed during `npm run build`

Current note categories include:

- site workflow and Markdown/Obsidian CMS notes
- market research pipeline methodology
- AI-agent and developer-tool notes such as CodeGraph, graphify, agent harnesses, and skills evaluation

### Projects

Project entries should look like build records:

- project code or repo slug label
- project title
- role/stack/status metadata
- concise outcome or purpose
- link row or clickable record for repo, write-up, demo, or artifact

The Projects page is split into sections:

- **Public Repos**: GitHub repositories and open build artifacts.
- **Research Reports**: generated market research projects and report collections.

Public repo records should keep external GitHub links. Research-report records can link to internal project detail pages when there are multiple generated artifacts or methodology notes behind the project.

### Research Reports

Research report pages should feel like a live archive, not a static article. The current stock pre-open project lives at:

```text
/projects/research-stocks-pro-open-price
```

There is also a corrected spelling alias:

```text
/projects/research-stocks-pre-open-price
```

The page should include:

- a concise explanation of the agentic research workflow
- methodology links to related Notes articles
- a GitHub-contribution-style activity map for available report dates
- a fuzzy search input for filtering generated reports by date, title, tag, or description
- a dated record list where each report links to its generated HTML artifact

Research Reports are broader than pre-market stock reports. The section copy should allow for:

- stock market pre-open and post-close research
- crypto market analysis
- macroeconomic overview
- FX/currency pricing
- gold and commodities analysis
- other cross-asset signals used for monitoring, analysis, and decision support

Report HTML files should be treated as static source artifacts under:

```text
public/reports/stocks/researches/
```

They are published to:

```text
docs/reports/stocks/researches/
```

Filenames for stock pre-open reports currently follow:

```text
YYYY-MM-DD-pre-market-summary.html
```

`scripts/generate-content-index.js` scans `public/reports/stocks/researches` and writes report metadata into `src/generated/content-index.json`. `scripts/sync-static-reports.js` exists to preserve reports that were previously placed under `docs/reports` by syncing them into `public/reports` before the Vite build clears and regenerates `docs/`.

### Portfolio

Portfolio items should look like build records:

- project code or date label
- project title
- role/stack/status metadata
- concise outcome
- link row for demo, repo, write-up, or dashboard

### Resume

Resume content is markdown-backed and exposed at `/resume`, but not shown in the main navbar. It should remain professional and exportable:

- Use clear personal information and professional summary sections at the top.
- Prefer action-led bullets with concrete outcomes and metrics.
- Keep headings readable; h4 role titles must be larger than body text.
- Add separators between h2 sections for scanability.
- The `Export PDF` button uses browser print; print styles hide navigation, footer, and button chrome.

## Interaction

- Hover: border changes to accent, background shifts to accent-soft.
- Focus: visible accent outline, never removed.
- Motion: subtle fade or translate only; no bouncy transitions.
- Progress/status: use bars, square markers, and mono counters.

## Responsive Rules

- Mobile header height should be around `56px`.
- Hide nonessential nav links behind the menu below `768px`.
- Keep tap targets at least `40px`.
- Do not let long titles force horizontal scroll; wrap or truncate metadata only.
- Preserve the document rhythm on mobile: label, title, content, rule.

## Content Tone

Use direct, concrete labels:

- "Projects" instead of "Explore projects"
- "Recent Notes" instead of "Latest from the blog"
- "Build Log" instead of "Portfolio"
- "Status" instead of "Current Progress" when referring to live systems

Copy should be plain and specific. Avoid promotional language, oversized hero claims, and feature explanations inside the UI.

## Implementation Path

1. Maintain global design tokens in `src/index.css`.
2. Keep `Layout` and `Navbar` aligned to the dark manual shell.
3. Use record styles for `Home`, `Projects`, notes listings, and repeated content.
4. Keep markdown pages (`About`, `Portfolio`, `Resume`) readable and export-friendly.
5. Keep static report artifacts in `public/reports` so Vite publishes them into `docs/reports`.
6. Tune generated `docs/` output with `npm run build` before publishing.

## Runtime and CI

- Target Node.js 24 LTS for local development and CI.
- Keep `.nvmrc` as the single source of truth for the Node major version.
- `package.json` should declare compatible `engines` for Node and npm.
- GitHub Actions should use `actions/setup-node` with `node-version-file: .nvmrc`.
- `npm run build` first syncs static reports, then generates the content index, then builds `docs/`.
- `postbuild` copies `docs/index.html` to `docs/404.html` for GitHub Pages SPA fallback.
- The generated content index contains markdown posts/pages and dynamically discovered stock pre-open reports.

## Do Not Do

- Do not copy the reference site's exact branding or curriculum-specific language.
- Do not introduce large gradient hero sections.
- Do not use pill-shaped nav/buttons as the primary pattern.
- Do not make the whole site a one-color blue/slate theme; keep it dark neutral gray with neon cyan accents.
- Do not bury useful metadata inside hover states.
