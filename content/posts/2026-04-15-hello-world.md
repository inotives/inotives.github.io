---
title: "How to Create and Publish a Blog Post"
date: 2026-04-15
tags: [meta, workflow, tutorial]
summary: "A guide on creating posts with Obsidian, the content format, and how the CI pipeline auto-deploys your changes."
---

# How to Create and Publish a Blog Post

This site is built so that writing and publishing a blog post is as simple as editing a Markdown file and pushing to git. Here's the full workflow.

## 1. Open the Obsidian Vault

The `content/` folder in this repo is an Obsidian vault. Open it directly in Obsidian:

1. Open Obsidian
2. Click **Open folder as vault**
3. Select the `content/` directory

You'll see `posts/` and `pages/` folders — blog posts go in `posts/`.

## 2. Create a New Post

Create a new `.md` file in `content/posts/`. Use the naming convention:

```
YYYY-MM-DD-your-post-slug.md
```

For example: `2026-04-15-my-new-post.md`

## 3. Add Frontmatter

Every post needs YAML frontmatter at the top:

```yaml
---
title: "Your Post Title"
date: 2026-04-15
tags: [topic1, topic2]
summary: "A brief description shown on the blog index."
draft: false
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Display title on the blog |
| `date` | Yes | Publish date (`YYYY-MM-DD`) |
| `tags` | No | Array of tags for filtering |
| `summary` | No | Preview text on the blog listing |
| `featured_image` | No | Relative path to a cover image |
| `draft` | No | Set to `true` to exclude from the site |

## 4. Write Your Content

Below the frontmatter, write standard Markdown. The site supports:

- **Headings** (`#`, `##`, `###`)
- **Bold**, *italic*, ~~strikethrough~~
- Bullet and numbered lists
- [Links](https://example.com)
- Images: `![alt](assets/images/photo.png)`
- Code blocks with syntax highlighting
- Tables (GitHub Flavored Markdown)
- Blockquotes

### Code Block Example

```python
def greet(name):
    return f"Hello, {name}!"
```

### Table Example

| Exchange | Endpoint | Refresh |
|----------|----------|---------|
| Binance | `/api/v3/ticker/price` | 5s |
| Gemini | `/v1/pubticker/:symbol` | 10s |

> **Tip:** Obsidian's live preview shows you roughly how the post will look. For an exact preview, run `npm run dev` locally.

## 5. Publish — Just Push

Once your post is ready:

```bash
git add content/posts/your-new-post.md
git commit -m "post: your post title"
git push
```

That's it. The GitHub Actions CI pipeline will:

1. Detect changes in `content/`
2. Run `npm run build` (generates content index + bundles the site)
3. Commit the updated `docs/` folder
4. GitHub Pages serves the new version

No manual build step needed. Your post goes live within a couple of minutes.

## 6. Editing Existing Posts

Just edit the `.md` file, commit, and push. The same CI pipeline rebuilds the site.

## 7. Draft Posts

Set `draft: true` in the frontmatter to write a post without publishing it:

```yaml
---
title: "Work in Progress"
draft: true
---
```

Draft posts are committed to git but excluded from the built site. Remove `draft: true` (or set it to `false`) when you're ready to publish.
