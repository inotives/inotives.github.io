var e=`---
title: "How to Use Obsidian and Markdown as CMS for GitHub Pages"
date: 2026-04-15
tags: [meta, workflow, obsidian, tutorial]
summary: "The writing workflow, content format, and publishing steps for adding notes to the inoTives site."
---

# How to Use Obsidian and Markdown as CMS for GitHub Pages

The inoTives site is built so that writing and publishing a note is as simple as editing a Markdown file and pushing to git. The \`content/\` folder is also an Obsidian vault, so notes can be drafted locally without a web CMS, database, or publishing dashboard.

The goal is simple: fast writing, plain files, Git history, and a static site that rebuilds from Markdown.

## Why Obsidian?

- **Local-first:** files live on disk and stay version-controlled
- **Markdown-native:** the same file is used for drafting and publishing
- **Fast writing:** live preview, split panes, search, and editor workflows stay local
- **Frontmatter support:** metadata is easy to read and is used by the site index
- **AI-agent friendly:** agents can read, edit, summarize, refactor, and generate Markdown without needing a CMS API or browser automation

## Site Workflow

\`\`\`text
Open Obsidian -> write Markdown -> commit changes -> push -> site rebuilds
\`\`\`

For local preview, run:

\`\`\`bash
npm run dev
\`\`\`

For a production build check, run:

\`\`\`bash
npm run build
\`\`\`

## 1. Open the Obsidian Vault

The \`content/\` folder in this repo is an Obsidian vault. Open it directly in Obsidian:

1. Open Obsidian
2. Click **Open folder as vault**
3. Select the \`content/\` directory

You'll see \`posts/\` and \`pages/\` folders — notes go in \`posts/\`.

## 2. Create a New Note

Create a new \`.md\` file in \`content/posts/\`. Use the naming convention:

\`\`\`
YYYY-MM-DD-your-post-slug.md
\`\`\`

For example: \`2026-04-15-my-new-post.md\`

## 3. Add Frontmatter

Every note needs YAML frontmatter at the top:

\`\`\`yaml
---
title: "Your Post Title"
date: 2026-04-15
tags: [topic1, topic2]
summary: "A brief description shown on the notes index."
draft: false
---
\`\`\`

| Field | Required | Description |
|-------|----------|-------------|
| \`title\` | Yes | Display title on the notes page |
| \`date\` | Yes | Publish date (\`YYYY-MM-DD\`) |
| \`tags\` | No | Array of tags for filtering |
| \`summary\` | No | Preview text on the notes listing |
| \`featured_image\` | No | Relative path to a cover image |
| \`draft\` | No | Set to \`true\` to exclude from the site |

The build script reads this metadata and generates the content index used by the React app.

## 4. How the Site Rebuilds Automatically

The publishing flow is automated with GitHub Actions. The workflow lives in \`.github/workflows/build-and-deploy.yml\` and runs whenever changes are pushed to \`master\` for site-related paths:

- \`content/**\`
- \`src/**\`
- \`public/**\`
- \`index.html\`
- \`vite.config.js\`
- \`package.json\`

When the workflow runs, it:

1. Checks out the repository
2. Installs Node.js and project dependencies
3. Runs \`npm run build\`
4. Generates the content index from Markdown
5. Builds the React/Vite site into \`docs/\`
6. Uploads \`docs/\` as a GitHub Pages artifact
7. Deploys that artifact to GitHub Pages

This is the part that makes the Markdown-as-CMS workflow feel seamless. I only need to write or edit Markdown, commit the change, and push. GitHub handles the rebuild and deployment.

## 5. Write Your Content

Below the frontmatter, write standard Markdown. The site supports:

- **Headings** (\`#\`, \`##\`, \`###\`)
- **Bold**, *italic*, ~~strikethrough~~
- Bullet and numbered lists
- [Links](https://example.com)
- Images: \`![alt](assets/images/photo.png)\`
- Code blocks with syntax highlighting
- Tables (GitHub Flavored Markdown)
- Blockquotes

Keep the first heading aligned with the frontmatter title. The site strips a duplicate leading \`# Heading\` from the rendered article, so the page title only appears once.

### Code Block Example

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\`

### Table Example

| Exchange | Endpoint | Refresh |
|----------|----------|---------|
| Binance | \`/api/v3/ticker/price\` | 5s |
| Gemini | \`/v1/pubticker/:symbol\` | 10s |

> **Tip:** Obsidian's live preview shows you roughly how the post will look. For an exact preview, run \`npm run dev\` locally.

## 6. Add Images

Put images under \`content/assets/images/\` and reference them from the note:

\`\`\`markdown
![Dashboard screenshot](assets/images/dashboard.png)
\`\`\`

Avoid Obsidian-only embeds and wiki links unless the site renderer has been updated to support them.

## 7. Publish

Once your note is ready:

\`\`\`bash
git add content/posts/your-new-post.md
git commit -m "post: your post title"
git push
\`\`\`

That's it. The GitHub Actions CI pipeline will:

1. Detect changes in \`content/\` or the app source
2. Run \`npm run build\`
3. Upload the generated \`docs/\` folder as a Pages artifact
4. Deploy that artifact to GitHub Pages

No manual deployment step is needed. The note goes live after the GitHub Actions workflow finishes.

## 8. Editing Existing Notes

Just edit the \`.md\` file, commit, and push. The same CI pipeline rebuilds the site.

## 9. Draft Notes

Set \`draft: true\` in the frontmatter to write a note without publishing it:

\`\`\`yaml
---
title: "Work in Progress"
draft: true
---
\`\`\`

Draft notes are committed to git but excluded from the built site. Remove \`draft: true\` or set it to \`false\` when you're ready to publish.

## Tradeoffs

- Local preview requires \`npm run dev\`
- Obsidian wiki links and embeds are not site features yet
- Images need to use site-compatible Markdown paths
- Publishing depends on GitHub Actions completing successfully

For inoTives, this is a good tradeoff: the writing system stays simple, portable, and easy to rebuild.
`;export{e as default};