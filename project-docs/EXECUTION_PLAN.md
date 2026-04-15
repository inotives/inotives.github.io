# Execution Plan: inotives.github.io Rebuild

## Phase 0 — Preparation & Scaffolding
**Goal:** Set up the new project structure alongside the existing code without breaking the live site.

### Tasks
- [ ] 0.1 — Create a `rebuild` branch from `master`
- [ ] 0.2 — Initialize Vite + React project in the repo root
  - `npm create vite@latest . -- --template react`
  - Add `package.json`, `vite.config.js`, `index.html`
- [ ] 0.3 — Install core dependencies
  ```
  npm install react react-dom react-router-dom
  npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
  npm install react-markdown remark-gfm rehype-highlight gray-matter
  ```
- [ ] 0.4 — Configure Vite to build to `/docs/`
  ```js
  // vite.config.js
  export default {
    base: '/',
    build: { outDir: 'docs' },
    plugins: [react()]
  }
  ```
- [ ] 0.5 — Set up Tailwind CSS (`tailwind.config.js`, `postcss.config.js`, `src/styles/index.css`)
- [ ] 0.6 — Create `content/` directory structure for Obsidian vault
  ```
  content/
  ├── posts/
  ├── pages/
  └── assets/images/
  ```
- [ ] 0.7 — Start `content/` fresh (no migration of old posts)
- [ ] 0.8 — Add `.obsidian/` config basics (or gitignore it)
- [ ] 0.9 — Update `.gitignore` for `node_modules/`, `.obsidian/workspace*`, build artifacts

**Deliverable:** Repo builds an empty React app to `/docs/`. Obsidian can open `content/` as a vault.

---

## Phase 1 — Core Layout & Routing
**Goal:** Basic React app with navigation and page structure.

### Tasks
- [ ] 1.1 — Create `src/main.jsx` entry point with HashRouter
- [ ] 1.2 — Create `src/App.jsx` with route definitions
- [ ] 1.3 — Build `Layout.jsx` component (header/navbar + main content + footer)
- [ ] 1.4 — Build `Navbar.jsx` with links: Home, Blog, Portfolio, About, Dashboards
- [ ] 1.5 — Build `Footer.jsx`
- [ ] 1.6 — Create stub page components: `Home.jsx`, `Blog.jsx`, `BlogPost.jsx`, `Portfolio.jsx`, `About.jsx`, `Dashboards.jsx`
- [ ] 1.7 — Verify all routes work with hash-based navigation
- [ ] 1.8 — Style navbar and layout with Tailwind (clean, minimal design)

**Deliverable:** Navigable React SPA with all routes rendering placeholder content.

---

## Phase 2 — Markdown Rendering Pipeline
**Goal:** Load and render markdown content from `content/` at build time.

### Tasks
- [ ] 2.1 — Create `scripts/generate-content-index.js`
  - Scans `content/posts/` and `content/pages/`
  - Extracts frontmatter from each `.md` file
  - Writes `src/generated/content-index.json`
- [ ] 2.2 — Configure Vite to import `.md` files as raw strings
  ```js
  // vite.config.js — use ?raw imports or a plugin
  ```
- [ ] 2.3 — Create `src/utils/content.js`
  - `getAllPosts()` — returns sorted post metadata from content-index
  - `getPostBySlug(slug)` — loads and parses a single post
  - `getPage(name)` — loads a static page markdown
- [ ] 2.4 — Create `MarkdownRenderer.jsx` component
  - Uses `react-markdown` with `remark-gfm` (tables, strikethrough)
  - Uses `rehype-highlight` for code syntax highlighting
  - Custom image resolver (maps relative paths to built asset paths)
- [ ] 2.5 — Create `useMarkdown.js` hook for loading + parsing in page components
- [ ] 2.6 — Add npm script: `"prebuild": "node scripts/generate-content-index.js"`
- [ ] 2.7 — Test with existing blog posts (`post_1.md`, `post_2.md`)

**Deliverable:** Markdown files from `content/` render as styled HTML in the React app.

---

## Phase 3 — Blog Feature
**Goal:** Full blog with index page, individual post pages, and tag filtering.

### Tasks
- [ ] 3.1 — Build `Blog.jsx` page
  - Fetches post list from content-index
  - Renders `PostCard` for each post (title, date, summary, tags)
  - Sorted by date descending
  - Filter by tag (optional)
- [ ] 3.2 — Build `PostCard.jsx` component
  - Displays post title, date, summary, featured image
  - Links to `/blog/:slug`
- [ ] 3.3 — Build `BlogPost.jsx` page
  - Loads markdown by slug from route params
  - Renders via `MarkdownRenderer`
  - Displays title, date, tags as metadata header
  - Previous/Next post navigation
- [ ] 3.4 — Create 1-2 sample posts in Obsidian to validate the workflow

**Deliverable:** Working blog with index, individual posts, and tag display.

---

## Phase 4 — Home, Portfolio & About Pages
**Goal:** Populate the remaining pages with real content.

### Tasks
- [ ] 4.1 — Build `Home.jsx`
  - Hero section with name/title/brief intro
  - Recent blog posts section (top 3)
  - Dashboard showcase section (cards linking to dashboards)
- [ ] 4.2 — Create `content/pages/about.md` in Obsidian
- [ ] 4.3 — Build `About.jsx` — loads and renders `about.md`
- [ ] 4.4 — Create `content/pages/portfolio.md` in Obsidian
- [ ] 4.5 — Build `Portfolio.jsx` — renders portfolio page from markdown
  - Project cards with descriptions, tech tags, links
- [ ] 4.6 — Style all pages with consistent Tailwind design

**Deliverable:** All main pages populated with content, authored from Obsidian.

---

## Phase 5 — Legacy Dashboard Integration
**Goal:** Embed existing freeboard dashboards into the new React shell.

### Tasks
- [ ] 5.1 — Copy `docs/dashboards/` to `public/dashboards/` and `docs/inotives_banks/` to `public/inotives_banks/`
- [ ] 5.2 — Build `DashboardEmbed.jsx` — responsive iframe component
- [ ] 5.3 — Build `Dashboards.jsx` page — grid of dashboard cards
  - Each card shows dashboard name, description, thumbnail
  - Clicking opens the dashboard in embedded view or new tab
- [ ] 5.4 — Create dashboard metadata (JSON or frontmatter) for the index
- [ ] 5.5 — Test that all existing dashboards load correctly in iframes
- [ ] 5.6 — Handle CORS/mixed content issues if any

**Deliverable:** All existing dashboards accessible through the new React site.

---

## Phase 6 — Polish & Deploy
**Goal:** Final styling, performance, and deployment.

### Tasks
- [ ] 6.1 — Responsive design review (mobile, tablet, desktop)
- [ ] 6.2 — Add page transitions or loading states
- [ ] 6.3 — Add meta tags / Open Graph for link previews
- [ ] 6.4 — Add a 404 page component for unknown routes
- [ ] 6.5 — Optimize images (compression, lazy loading)
- [ ] 6.6 — Build and verify output in `/docs/`
- [ ] 6.7 — Test on GitHub Pages (push `rebuild` branch, enable Pages)
- [ ] 6.8 — Clean up old Python files (`run_generator.py`, `run_server.py`, `run_watcher.py`, `templates/`)
- [ ] 6.9 — Merge `rebuild` branch to `master`
- [ ] 6.10 — Update `README.md` with new setup/development instructions

**Deliverable:** Live, rebuilt site on GitHub Pages.

---

## Phase 7 — Future Enhancements (Optional)
These are out of scope for the initial rebuild but documented for later.

- [ ] 7.1 — Obsidian `[[wiki-links]]` support via custom remark plugin
- [ ] 7.2 — Obsidian callout/admonition rendering
- [ ] 7.3 — Search functionality (client-side full-text search with Fuse.js or Pagefind)
- [ ] 7.4 — Dark mode toggle
- [ ] 7.5 — RSS feed generation at build time
- [ ] 7.6 — Rewrite dashboards as native React components (replace freeboard.js)
- [ ] 7.7 — Analytics (Plausible or simple page-view counter)
- [ ] 7.8 — Comments system (giscus — GitHub Discussions based)

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Open Obsidian on content/ folder for editing markdown
```

### Build & Deploy
```bash
# Generate content index + build
npm run build

# Output goes to /docs/ — commit and push to master
git add docs/
git commit -m "build: update site"
git push
```

### Content Authoring
1. Open `content/` in Obsidian
2. Create/edit `.md` files with proper frontmatter
3. Run `npm run build` to regenerate
4. Commit and push

---

## Estimated Effort by Phase

| Phase | Scope | Complexity |
|-------|-------|-----------|
| Phase 0 | Scaffolding | Low |
| Phase 1 | Layout & Routing | Low |
| Phase 2 | Markdown Pipeline | Medium |
| Phase 3 | Blog Feature | Medium |
| Phase 4 | Content Pages | Low |
| Phase 5 | Dashboard Integration | Low-Medium |
| Phase 6 | Polish & Deploy | Medium |

Phases 0-2 are foundational and should be done sequentially. Phases 3-5 can be worked on in parallel once Phase 2 is complete.
