var e=`---
title: "Free Comments on a Static Site: Giscus + Discussion-to-Issue Pipeline"
date: 2026-06-05
tags: [giscus, github-discussions, comments, static-site, workflow, github-actions, discussion-to-issue]
summary: "Giscus gives you a full comment system on a static site for free — backed by GitHub Discussions. Pair it with a workflow that converts bug reports from comments into issues, and you get a lightweight community feedback loop with zero infrastructure cost."
---

## Free Comments on a Static Site: Giscus + Discussion-to-Issue Pipeline

Static sites are fast, cheap, and simple. But they lack a native comments section — every visitor is a passive reader with no way to react or respond. You could bolt on a third-party comment service (Disqus, Commento), but that means ads, a monthly bill, or handing your comment data to someone else.

Giscus solves this differently: it uses **GitHub Discussions** as the comment backend. Every comment on your site is a GitHub Discussion comment. No database, no API key, no monthly fee.

This post covers the setup I use on this site, and the workflow that turns reader comments into actionable issues.

---

## How Giscus Works

Giscus loads a JavaScript widget on your page that authenticates readers via their GitHub account and maps each page URL to a GitHub Discussion thread. The flow:

1. A reader visits a note page on your site
2. Giscus checks if a Discussion exists for that page URL in your repo
3. If yes: it loads the thread as comments. If no: the widget renders an empty state (a new Discussion is auto-created when someone submits the first comment or reaction)
4. The reader signs in with their GitHub account, posts a comment, and it lands as a Discussion comment in your repo — no moderation dashboard, no spam filter, just the familiar GitHub UI

The setup cost is one configuration script tag:

\`\`\`html
<script src="https://giscus.app/client.js"
        data-repo="user/user.github.io"
        data-repo-id="MDEwOlJlcG9zaXRvcnkx..."
        data-category="General"
        data-category-id="DIC_kwDO..."
        data-mapping="url"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="dark"
        data-lang="en"
        crossorigin="anonymous"
        async>
<\/script>
\`\`\`

The only repo-side requirement: **enable Discussions** in your repo Settings tab. That's it.

## Injecting Giscus Into a React SPA

If your site is a single-page app, you can't drop the script tag into a static template and forget it — Giscus needs to re-initialise when the user navigates between pages. The solution is a React component that mounts and unmounts the script per page.

The key design decisions:

**1. Clear and recreate on navigation**
When the user navigates from one note to another, empty the container div and create a fresh script element. This forces Giscus to re-read \`data-mapping="url"\` and load the correct discussion for the new URL.

\`\`\`tsx
useEffect(() => {
  if (loading || !post) return
  
  const el = commentsRef.current
  if (!el) return
  
  el.innerHTML = ''
  
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  // ... set all data-* attributes ...
  el.appendChild(script)
}, [slug, loading, post])
\`\`\`

**2. Wait for content to render**
The comments div only exists in the DOM after the article content loads. The \`loading\` guard prevents the effect from running prematurely when the ref target isn't rendered yet.

**3. One-time bootstrap**
After Giscus loads, the widget manages its own lifecycle — resizing, re-fetching on sign-in, etc. The script injection is only needed once per page visit; Giscus handles the rest.

## Workflow: From Discussion to Issue

This is where the setup becomes more than just a comment widget. Reader comments will inevitably include bug reports, feature requests, and questions. If those stay buried in Discussion threads, they'll be forgotten. The fix: **automatically convert actionable discussions into issues.**

### The Manual Pattern

When a discussion contains a clear bug report or feature request:

1. Open the discussion in your repo's Discussions tab
2. Click **"Create issue from discussion"** (GitHub's built-in button at the bottom of every discussion)
3. The new issue links back to the original discussion, preserving context
4. Close the discussion with a note pointing to the issue
5. Work the issue normally

This takes about 10 seconds and requires no tooling. For a low-volume site (a few comments per week), this is sufficient.

### The Automated Pattern

For higher volume, use a GitHub Action that monitors discussions and auto-converts based on labels:

\`\`\`yaml
# .github/workflows/discussion-to-issue.yml
name: Discussion to Issue
on:
  discussion:
    types: [labeled]
jobs:
  convert:
    if: github.event.label.name == 'bug' || github.event.label.name == 'feature-request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const discussion = context.payload.discussion
            const label = context.payload.label.name
            
            const title = \`[\${label === 'bug' ? 'BUG' : 'FEATURE'}] \${discussion.title}\`
            const body = \`Converted from [Discussion #\${discussion.number}](\${discussion.html_url})\\n\\n---\\n\\n\${discussion.body}\`
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title,
              body,
              labels: [label],
            })
\`\`\`

This triages as soon as an author or maintainer applies a \`bug\` or \`feature-request\` label to a discussion — zero manual conversion step.

### The Triage Checklist

Whether manual or automated, the triage step needs a consistent set of labels:

| Label | Trigger | Action |
|-------|---------|--------|
| \`bug\` | Reader reports broken behaviour | Convert to issue, add to backlog |
| \`feature-request\` | Reader suggests an addition | Convert to issue, tag as enhancement |
| \`question\` | Reader asks how something works | Answer in discussion, close when resolved |
| \`duplicate\` | Same topic as another discussion | Link to the canonical thread, close |
| \`spam\` | Non-constructive or promotional | Hide or delete the discussion |

The key insight: **not every comment needs to become an issue.** Questions get answered and closed. Praise stays as-is. Only actionable reports — bugs and feature requests — cross the discussion-to-issue boundary.

## Why This Setup Works

**No infra cost.** Giscus is a CDN-served script. GitHub Discussions and Issues are free. The total cost is $0.

**No moderation burden.** Because commenters authenticate via GitHub, spam is virtually non-existent. You moderate through the same GitHub UI you already use for code.

**No data lock-in.** Every comment lives in your repo as markdown. If you stop using Giscus, the data stays in GitHub Discussions — exportable, searchable, and yours.

**The discussion-to-issue pipeline gives comments a second life.** A reader reporting a calculation error in a stock analysis post doesn't just leave a comment — they trigger a tracked issue with a fix timeline. The conversation doesn't dead-end in a widget. It feeds back into the work.

## Bridging to AI Workflows and Skills

The discussion-to-issue pipeline is useful on its own. But on a site where the articles themselves describe AI agent skills — stock analysis pipelines, skill-chaining patterns, crypto compliance workflows — comments become more than feedback. They become **training signal**.

### Direct Correction Loop

Take the skill-chaining article on this site. The stock pre-open prediction skill has explicit failure modes listed: "overnight-gap names, Trump-linked." If a reader comments that the prediction missed a gap-down on a specific ticker, that's not just a comment — it's a documented edge case. The skill's prompt can be updated to include that example as a cautionary pattern.

The pipeline: reader posts a correction comment → discussion created → issue filed → skill prompt updated → next run avoids the same mistake. The comment is the start of a skill improvement cycle, not a terminal conversation.

### AI-Classifier for Discussion Triage

The automated discussion-to-issue workflow above relies on a human applying the \`bug\` label. That step can be replaced with an AI skill that classifies new discussions:

\`\`\`
Skill: giscus_triage
Input:  discussion_title (String), discussion_body (String)
Output: label (Enum: bug | feature-request | question | duplicate | praise)
        confidence (Float 0-1)
        draft_issue_body (String, if label is bug or feature-request)
Rules:
  - Scan for keywords: "error", "wrong", "missing", "doesn't work" → bias bug
  - Scan for "would be nice", "could you add", "suggestion" → bias feature-request
  - If the author is also the repo maintainer and the body asks a question → bias question
  - If confidence < 0.6, leave unlabeled for manual review
\`\`\`

This runs as a scheduled workflow or webhook-triggered sub-agent. It reads unlabeled discussions, classifies them, and either applies the label (high confidence) or leaves a triage comment (low confidence). The human only steps in for the uncertain cases.

### Skill-Embedded Feedback Form

Going a step further: the Giscus widget can be configured per-article to ask a targeted question. For the trading pipeline article, the prompt could be: *"Did today's prediction match the actual open? If not, what did it miss?"* — turning the comments section into a structured feedback collector.

This data is then aggregated into a calibration report for the skill:

\`\`\`
In the last 30 days across 16 tickers:
- 12 comments about opening cone accuracy
- 3 mentioned sector momentum as a missing factor
- 1 reported a catalyst calendar miss
→ Next skill iteration: add sector momentum to the anchor brief
\`\`\`

### The Pattern

The common thread is that comments on a skill-documenting article are **not separate from the skill itself**. They're runtime feedback on a deployed AI workflow. Treating them as such — capturing, classifying, and feeding back into skill prompts — closes the loop between writing about agent skills and improving them.

This site's stock analysis pipeline now has a feedback channel in every article footer. The next step is wiring that channel into the skill update workflow so a comment about a missed gap-down automatically creates a skill improvement task.

---

### References

1. Giscus project: https://giscus.app
2. GitHub Discussions docs: https://docs.github.com/en/discussions
3. \`actions/github-script\`: https://github.com/actions/github-script
4. Skill chaining (this site): \`/notes/2026-06-04-skill-chaining-stock-trading-pipeline\`
`;export{e as default};