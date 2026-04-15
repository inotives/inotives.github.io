# Project Context

## User
- GitHub: inotives / inotives@gmail.com (personal account)
- Work account: tonilim-fd / toni.lim@flowdesk.co (Flowdesk)
- SSH config: `github-personal` host alias for personal GitHub SSH key (~/.ssh/id_ed25519_inotives)
- Interests: crypto dashboards, real-time data from public APIs, portfolio/blog site
- Prefers practical, no-waste approach

## Project Stack
Site rebuilt in April 2026 from Python static generator to React 18 + Vite + Tailwind CSS.

- Content in `content/` (Obsidian vault) — posts and pages as markdown with YAML frontmatter
- Build: `npm run build` (prebuild generates content-index.json, then Vite bundles)
- Deploy: GitHub Actions workflow builds and deploys to GitHub Pages (source: GitHub Actions, not branch)
- Legacy freeboard dashboards in `public/dashboards/` served as-is
- `inotives_banks/` in `public/` — intentionally unlisted, accessible only by direct URL
- Git remote uses `github-personal` SSH host alias

## Preferences
- Do not add Co-Authored-By lines in commits
