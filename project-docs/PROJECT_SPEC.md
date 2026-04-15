# Project Spec: inotives.github.io Rebuild

## Overview

Rebuild the inotives.github.io portfolio site as a React-based single-page application (SPA) hosted on GitHub Pages. The site will render blog posts and content from Markdown files that are authored and managed via Obsidian.

## Current State

- Custom Python static site generator (Jinja2 + markdown2)
- Flask dev server with watchdog auto-regeneration
- Output to `/docs/` folder for GitHub Pages
- Content: crypto dashboards (freeboard.js), blog posts (2), portfolio page
- Frontend: Bootstrap 5, jQuery, KAI Admin theme, Chart.js
- ~500 files in `/docs/` (mostly dashboard assets and images)

## Goals

1. **React-powered frontend** — Full React app rendered client-side, deployed as static files to GitHub Pages
2. **Markdown content rendering** — Blog posts and pages authored in Markdown, rendered at runtime or build time via React components
3. **Obsidian as CMS** — Content directory structured as an Obsidian vault so posts can be created/edited in Obsidian with live preview, wiki-links, and frontmatter

## Non-Goals

- No server-side rendering (SSR) — GitHub Pages is static-only
- No backend API — all content is bundled at build time
- No migration of freeboard.js dashboards into React (Phase 1) — they will be embedded or linked as-is

---

## Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + Vite | Fast builds, native ESM, simple GitHub Pages deployment |
| Routing | React Router v6 (HashRouter) | Client-side routing compatible with GitHub Pages (no server rewrites) |
| Styling | Tailwind CSS | Utility-first, replaces Bootstrap, smaller bundle |
| Markdown | react-markdown + remark/rehype plugins | Renders `.md` files with frontmatter, code highlighting, images |
| Frontmatter | gray-matter | Parses YAML frontmatter from Obsidian-authored markdown |
| Code Highlighting | rehype-highlight or shiki | Syntax highlighting in code blocks |
| Build | Vite + vite-plugin-static-copy | Builds to `/docs/` for GitHub Pages |
| Package Manager | npm | Standard tooling |

### Project Structure

```
inotives.github.io/
├── project-docs/           # Project documentation (this folder)
├── content/                # Obsidian vault — all markdown content lives here
│   ├── .obsidian/          # Obsidian config (gitignored or committed)
│   ├── posts/              # Blog posts as .md files
│   │   ├── 2024-01-01-my-first-post.md
│   │   └── ...
│   ├── pages/              # Static pages (about, portfolio) as .md
│   │   ├── about.md
│   │   └── portfolio.md
│   └── assets/             # Images referenced in markdown (Obsidian paste target)
│       └── images/
├── src/                    # React application source
│   ├── main.jsx            # Entry point
│   ├── App.jsx             # Root component with router
│   ├── components/         # Reusable UI components
│   │   ├── Layout.jsx      # Page layout (navbar, footer)
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── PostCard.jsx    # Blog post preview card
│   │   ├── MarkdownRenderer.jsx  # Renders parsed markdown
│   │   └── DashboardEmbed.jsx    # iframe wrapper for legacy dashboards
│   ├── pages/              # Route-level page components
│   │   ├── Home.jsx
│   │   ├── Blog.jsx
│   │   ├── BlogPost.jsx
│   │   ├── Portfolio.jsx
│   │   ├── About.jsx
│   │   └── Dashboards.jsx
│   ├── hooks/              # Custom React hooks
│   │   └── useMarkdown.js  # Hook to load and parse markdown + frontmatter
│   ├── utils/              # Utility functions
│   │   └── content.js      # Content loading, frontmatter parsing, post index
│   └── styles/             # Global styles, Tailwind config overrides
│       └── index.css
├── public/                 # Static assets copied as-is to build
│   └── dashboards/         # Legacy freeboard dashboards (moved here)
├── scripts/                # Build-time scripts
│   └── generate-content-index.js  # Scans content/ and builds a JSON index
├── docs/                   # Build output (GitHub Pages root)
├── index.html              # Vite entry HTML
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .gitignore
```

### Content Authoring Flow (Obsidian)

```
Author in Obsidian → content/*.md → Build script generates index → Vite bundles → docs/
```

1. Open `content/` folder as an Obsidian vault
2. Create/edit markdown files with YAML frontmatter:
   ```markdown
   ---
   title: "My Post Title"
   date: 2024-06-15
   tags: [crypto, dashboard]
   summary: "A brief description"
   featured_image: assets/images/post-cover.png
   draft: false
   ---

   # My Post Title

   Content goes here with **full markdown** support...
   ```
3. Obsidian features that will be supported:
   - Standard markdown (headings, lists, code blocks, tables, images)
   - YAML frontmatter (parsed by gray-matter)
   - Image paste (saved to `content/assets/images/`)
   - Tags in frontmatter
4. Obsidian features that will NOT be supported (initially):
   - `[[wiki-links]]` (would need a remark plugin)
   - Obsidian callouts (would need custom remark plugin)
   - Dataview queries

### Content Index Generation

A build-time script (`scripts/generate-content-index.js`) will:
1. Scan `content/posts/*.md` and `content/pages/*.md`
2. Parse frontmatter from each file
3. Output `src/generated/content-index.json` with metadata for all posts
4. Vite imports the JSON and markdown files at build time via `import.meta.glob`

This avoids runtime file-system access (impossible on GitHub Pages).

### Routing

| Route | Component | Source |
|-------|-----------|--------|
| `/` | Home | Hardcoded + content-index for recent posts |
| `/blog` | Blog | Lists posts from content-index.json |
| `/blog/:slug` | BlogPost | Loads `content/posts/{slug}.md` |
| `/portfolio` | Portfolio | Loads `content/pages/portfolio.md` |
| `/about` | About | Loads `content/pages/about.md` |
| `/dashboards` | Dashboards | Lists available dashboards |
| `/dashboards/:name` | DashboardEmbed | Embeds legacy dashboard via iframe |

Using `HashRouter` (e.g., `https://inotives.github.io/#/blog/my-post`) for GitHub Pages compatibility without 404 hacks.

### Legacy Dashboard Strategy

The existing freeboard.js dashboards (~86 files) will be:
1. Copied to `public/dashboards/` as static files
2. Served as-is at `/dashboards/crypto/*.html`
3. Embedded in React via an `<iframe>` component on the Dashboards page
4. No rewrite needed — they continue to work independently

---

## Key Design Decisions

| Decision | Choice | Alternative Considered |
|----------|--------|----------------------|
| SPA vs SSG | SPA (client-side React) | Astro/Next.js SSG — overkill for a portfolio, adds complexity |
| Router | HashRouter | BrowserRouter — requires 404.html hack on GitHub Pages |
| CSS | Tailwind CSS | Keep Bootstrap — Tailwind is more flexible, smaller |
| Markdown | Build-time import via Vite glob | Runtime fetch — slower, no tree-shaking |
| Obsidian compat | Frontmatter + standard MD | Full Obsidian Publish parity — too complex |
| Build output | `/docs/` | `gh-pages` branch — current setup uses `/docs/`, keep it simple |

---

## Content Schema

### Blog Post Frontmatter

```yaml
---
title: string          # Required — display title
date: YYYY-MM-DD       # Required — publish date
tags: [string]         # Optional — for filtering
summary: string        # Optional — preview text on blog index
featured_image: string # Optional — relative path from content/
draft: boolean         # Optional — if true, excluded from build
slug: string           # Optional — override URL slug (default: filename)
---
```

### Page Frontmatter

```yaml
---
title: string          # Required
layout: string         # Optional — "default" | "wide"
---
```
