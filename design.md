# inoTives Design Direction

Reference: https://aiengineeringfromscratch.com/

This site uses a dark technical field-manual aesthetic: dense, readable, direct, and built around documents, dashboards, notes, and project artifacts. The target feeling is not a startup landing page. It should feel like a working notebook, lab manual, and crypto operations console sharing one visual system.

## Design Principles

- Prioritize text, structure, and scanability over decoration.
- Use page sections as document bands, not floating marketing cards.
- Make status, progress, dates, and metadata visible with small mono labels.
- Prefer square edges, hard rules, and simple blocks over soft rounded surfaces.
- Let one strong accent color carry interaction and state.
- Keep the interface compact enough for repeated use, especially dashboards and blog indexes.

## Visual Language

The reference site uses an off-white paper surface, black ink, blueprint-blue accents, fixed header, mono metadata labels, uppercase display headings, dotted/grid texture, thin rules, square controls, and document-like section breaks.

For inoTives, adapt that into a "market manual" theme:

- Background: dark neutral gray, not pure black and not saturated slate.
- Surfaces: slightly lighter dark gray panels for records, forms, and framed tools.
- Accent: soft blueprint blue for links, active nav, progress, labels, and primary actions.
- Ink: near-white text with cool muted gray metadata.
- Texture: subtle radial-dot or grid background, low contrast.
- Edges: 0-4px radius for controls and panels; avoid pill buttons and soft cards.
- Separators: thin horizontal rules, ASCII-like dividers, table borders, and explicit section labels.

## Design Tokens

Suggested CSS variables:

```css
:root {
  --font-display: "VT323", ui-monospace, "JetBrains Mono", monospace;
  --font-body: "Source Serif 4", "Iowan Old Style", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, Consolas, monospace;

  --bg: #0f1115;
  --surface: #171b22;
  --surface-hover: #202631;
  --surface-strong: #12151b;
  --ink: #f8fafc;
  --ink-soft: #cbd5e1;
  --ink-muted: #94a3b8;
  --rule: rgba(248, 250, 252, 0.16);
  --paper-rule: rgba(248, 250, 252, 0.07);
  --accent: #8ea2ff;
  --accent-hover: #b7c3ff;
  --accent-soft: rgba(142, 162, 255, 0.14);
  --warning: #f6c453;
}
```

Tailwind equivalents should be centralized through theme variables or reusable component classes rather than repeated literal `gray-*`, `slate-*`, and `blue-*` utilities.

## Typography

- Page titles: uppercase display mono, large, tight line-height, accent color.
- Section titles: uppercase display mono, accent color, with a mono subtitle below.
- Body copy: serif, 17-19px, relaxed line height.
- Metadata: mono, uppercase, 11-13px, increased letter spacing.
- Code, dates, tags, dashboard labels: mono with tabular numerals.

Avoid heavy `font-bold` as the default signal. Use hierarchy, spacing, labels, and rules first.

## Layout

- Global max width: `1200px` for indexes and dashboard lists.
- Reading max width: `720px-820px` for blog/article content.
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

### Blog Posts

Blog pages should read like reference entries:

- date and category above title
- clear title and deck
- prose with serif body text
- code blocks on dark muted surface
- headings in display mono
- callouts as bordered notes, not colored cards

### Dashboards

Dashboards can keep a technical console tone while matching the manual theme:

- Use dense tables and status rows.
- Show source, update cadence, asset pair, and health state as mono metadata.
- Use accent for active/healthy signals and warning amber for degraded signals.
- Keep embedded dashboard frames rectangular and rule-bound.

### Portfolio

Portfolio items should look like build records:

- project code or date label
- project title
- role/stack/status metadata
- concise outcome
- link row for demo, repo, write-up, or dashboard

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

- "Dashboards" instead of "Explore dashboards"
- "Recent Notes" instead of "Latest from the blog"
- "Build Log" instead of "Portfolio"
- "Status" instead of "Current Progress" when referring to live systems

Copy should be plain and specific. Avoid promotional language, oversized hero claims, and feature explanations inside the UI.

## Implementation Path

1. Add global design tokens in `src/index.css`.
2. Convert `Layout` and `Navbar` from rounded Tailwind defaults to the dark manual shell.
3. Update `Home` to use a document-style hero, three catalog rows or panels, and recent posts as records.
4. Update `PostCard`, `Blog`, `Portfolio`, and `Dashboards` to use shared record styles.
5. Tune markdown typography last, after the shell and record components are stable.

## Do Not Do

- Do not copy the reference site's exact branding or curriculum-specific language.
- Do not introduce large gradient hero sections.
- Do not use pill-shaped nav/buttons as the primary pattern.
- Do not make the whole site a one-color blue/slate theme; keep it dark neutral gray with blue accents.
- Do not bury useful metadata inside hover states.
