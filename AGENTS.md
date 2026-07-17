# AGENTS GUIDELINES

## Writing Guidelines

### Article Notes Writing 

All articles notes should go in `content/posts/`. Filename format: `YYYY-MM-DD-<short-topic-title>.md`.

Required frontmatter fields:
```yaml
---
title: "Post Title"
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
summary: "One-paragraph description of the post."
---
```

Optional series field for articles that belong to a series:
```yaml
series: building-ai-systems
```
- When writing articles for a series, include the `series` field in frontmatter. This auto-populates the series listing page at `/series/<slug>`.
- Current series: `building-ai-systems` (Building AI Systems That Scale)
- To create a new series, add the slug to `SERIES_META` in `src/pages/BuildingAISystemsPage.jsx` (or create a new page component) and register the route in `src/App.jsx`.

- Use inline array format for tags: `[tag1, tag2]` (not multi-line YAML list)
- `summary` is the meta description, not `description`
- Do not include `status` or other extra fields
- Add a `## References` section at the end with links to relevant resources (GitHub repos, articles, docs, posts, etc.) mentioned in the post
- After writing or updating an article note, always run `npm run build` to rebuild the site

#### Adding Images to Articles

Store images in `public/assets/images/`. Use absolute paths in markdown:

```markdown
![Alt text](/assets/images/filename.jpeg)
```

Do NOT use relative paths like `assets/images/...` — Vite/GitHub Pages will resolve them incorrectly and the browser will 404. The `content/` directory is not served; only `public/` is.

### Humanizer Skill

When writing articles or notes, apply the humanizer skill to remove AI-generated writing patterns. The skill is located at:
`/Users/inotives/.strata-memory/3_intelligence/skill/writing/humanizer/SKILL.md`

Key rules:
- Delete filler phrases ("In order to", "It is worth noting")
- Break formulaic structures (binary contrasts, dramatic reveals)
- Vary sentence length and rhythm
- Trust the reader — state facts directly, skip softening
- Delete quotable lines — if it sounds like a pull quote, rewrite it
- Add genuine personality and voice, not just removal of bad patterns
- Use specific details instead of vague claims
- Limit em dashes to max 2 per 500 words
- Avoid rule of three, negative parallelism, synonym cycling

### Notes Writing 

Store the notes into .notes/ folder. Notes filename format: `YYYY-MM-DD--<short-topic-title>.md`.
Depend on the notes type, use the appropriate folder: `researches/`, `social_posts/`, etc. 
For example a linkedin post notes would go into `social_posts/` folder.

Required frontmatter for social posts:
```yaml
---
title: "Platform Post: Title"
date: YYYY-MM-DD
platform: linkedin
status: draft
---
```
For social post like linkedin, include hashtags at the end of the post.


---

## Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes and LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---
