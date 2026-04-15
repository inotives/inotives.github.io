---
title: "Using Obsidian as a CMS"
date: 2026-04-12
tags: [obsidian, workflow, meta]
summary: "Why I chose Obsidian for writing blog content and how the workflow works."
---

# Using Obsidian as a CMS

When rebuilding this site, I wanted the writing experience to be as frictionless as possible. No web-based editor, no CMS login, no database.

## Why Obsidian?

- **Local-first** — files live on disk, no cloud dependency
- **Markdown-native** — what you write is what gets deployed
- **Great editor** — live preview, vim mode, split panes
- **Frontmatter support** — YAML metadata rendered nicely in reading view

## The Workflow

```
Open Obsidian → Write .md file → npm run build → git push → Live
```

That's it. The `content/` folder in this repo *is* the Obsidian vault. I open it directly in Obsidian and start writing.

## Frontmatter Convention

Each post needs this at the top:

```yaml
---
title: "Post Title"
date: 2026-04-12
tags: [tag1, tag2]
summary: "Brief description"
---
```

The build script reads these fields and generates a JSON index that React uses to list and filter posts.

## Tradeoffs

- No live preview of the rendered site (need to run `npm run dev`)
- No wiki-links or Obsidian-specific features in the output (yet)
- Images need to be in `content/assets/images/`

For my use case, this is a good tradeoff. Fast writing, simple deployment.
