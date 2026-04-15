# inotives.github.io

Personal portfolio and blog site built with React, Vite, and Tailwind CSS. Content is authored in Markdown via Obsidian and deployed as a static site on GitHub Pages.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS
- **Content:** Markdown with YAML frontmatter, rendered via react-markdown
- **Authoring:** Obsidian (open `content/` as a vault)
- **Hosting:** GitHub Pages (static files in `docs/`)
- **CI:** GitHub Actions auto-builds on push to master

## Project Structure

```
├── content/              # Obsidian vault — all markdown content
│   ├── posts/            # Blog posts (.md)
│   ├── pages/            # Static pages (about, portfolio)
│   └── assets/images/    # Images referenced in markdown
├── src/                  # React application source
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level page components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Content loading utilities
│   └── data/             # Dashboard metadata
├── public/               # Static files served as-is
│   ├── dashboards/       # Legacy freeboard.js crypto dashboards
│   └── inotives_banks/   # Banking dashboards (unlisted)
├── scripts/              # Build-time scripts
│   └── generate-content-index.js
├── docs/                 # Build output (GitHub Pages root)
└── project-docs/         # Project specs and execution plan
```

## Local Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production (outputs to docs/)
npm run build
```

## Content Authoring

1. Open `content/` folder in Obsidian
2. Create or edit `.md` files with frontmatter:
   ```yaml
   ---
   title: "Post Title"
   date: 2026-04-15
   tags: [crypto, tutorial]
   summary: "Brief description"
   ---
   ```
3. Push to master — GitHub Actions builds and deploys automatically

## Deployment

Pushing to `master` triggers a GitHub Actions workflow that:
1. Runs `npm run build` (generates content index + Vite build)
2. Commits the updated `docs/` folder
3. GitHub Pages serves from `docs/`

No manual build step needed — just push your content.

## Features

- Blog with search, tag filtering, and infinite scroll
- Markdown rendering with syntax highlighting and GFM support
- About and Portfolio pages driven by markdown
- Legacy crypto dashboards embedded via iframe
- Responsive design with mobile navigation
- 404 catch-all page
