# inotives.github.io

Personal portfolio, blog, and research reports site. Built with React 18 + Vite + Tailwind CSS. Content in Markdown via Obsidian, plus static HTML research reports. Deployed to GitHub Pages.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS
- **Content:** Markdown with YAML frontmatter, rendered via react-markdown
- **Authoring:** Obsidian (open `content/` as a vault)
- **Research reports:** Static HTML generated offline, synced into the build
- **Hosting:** GitHub Pages (static files in `docs/`)
- **CI:** GitHub Actions auto-builds on push to master

## Project Structure

```
├── content/                  # Obsidian vault — blog posts and pages
│   ├── posts/                # Blog articles (.md)
│   ├── pages/                # Static pages (about, portfolio)
│   └── assets/images/        # Images referenced in markdown
├── src/                      # React application source
│   ├── components/           # Reusable UI components
│   ├── pages/                # Route-level page components
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Content loading utilities
│   └── generated/            # content-index.json (auto-generated)
├── public/                   # Static files served as-is
│   ├── inotives_banks/       # Banking assets (unlisted)
│   └── reports/              # Research reports (synced from docs/)
│       ├── stocks/daily      # Daily pre-open stock reports
│       ├── stocks/weekly     # Weekly stock market summaries
│       └── researches        # Adhoc research reports (HTML)
├── scripts/                  # Build-time scripts
│   ├── generate-content-index.js   # Indexes posts + reports
│   └── sync-static-reports.js       # Copies docs/ → public/ reports
├── docs/                     # Build output (GitHub Pages root)
│   └── reports/              # Deployed static research reports
└── .notes/                   # Draft social media posts (gitignored)
```

## Local Development

```bash
npm install
npm run dev          # Dev server with hot reload
npm run content      # Sync static reports + generate content index
npm run build        # Full production build
npm run lint         # ESLint check
```

## Content Authoring

**Blog posts:** Create `.md` files in `content/posts/` with frontmatter:

```yaml
---
title: "Post Title"
date: 2026-05-12
tags: [tag1, tag2]
summary: "Brief description"
---
```

**Research reports:** Place `.html` files in `docs/reports/researches/`, then run `npm run content` to sync into `public/` and index them.

## Pages

| Route | Description |
|---|---|
| `/` | Notes index with search and tag filtering |
| `/about` | About page |
| `/projects` | Portfolio and research reports hub |
| `/projects/researches-adhoc` | Adhoc research report listing |
| `/projects/research-stocks-pre-open-price` | Daily pre-open reports |
| `/projects/research-stocks-weekly-summary` | Weekly stock summaries |

## Deployment

Push to `master` → GitHub Actions runs `npm run build` → `docs/` is served by GitHub Pages.

No manual build step needed for content-only changes.

## Features

- Blog with search, tag filtering, and pagination
- Markdown rendering with syntax highlighting and GFM
- Research reports hub (stock daily, weekly, adhoc)
- Static HTML reports served directly from the file tree
- Responsive design with mobile nav
- 404 catch-all page

## Agent Integration

This repo has a CodeGraph index for agentic codebase work. See `CLAUDE.md` for agent instructions. It integrates with `akw` (Agent Knowledge) for persistent session memory across coding sessions.
