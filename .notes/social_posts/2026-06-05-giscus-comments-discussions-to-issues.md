---
platform: linkedin
post_date: 2026-06-05
topic: Free Comments on a Static Site — Giscus + Discussion-to-Issue Pipeline
---

I added comments to my static site using Giscus — zero infrastructure cost, backed by GitHub Discussions.

Every comment on every article is a GitHub Discussion. Authentication is handled via GitHub OAuth. Spam is basically non-existent because commenters need an account.

But the interesting part isn't the widget. It's what happens after:

1. A reader spots an error in one of my AI-generated stock analysis posts
2. They leave a comment — that's a Discussion thread
3. Label it "bug" → auto-convert to an Issue in the repo
4. Fix the skill prompt → next run avoids the same mistake

The comments section becomes a feedback channel for deployed AI workflows, not a dead-end conversation.

I wrote up the full setup — React SPA injection, the discussion-to-issue GitHub Action, and how this feeds back into skill improvements:

https://inotives.github.io/notes/2026-06-05-giscus-comments-discussions-to-issues

#Giscus #GitHubDiscussions #StaticSite #JamStack #Comments #DevTools #OpenSource #GitHubActions #AIWorkflows #AgentSkills #FeedbackLoop #WebDev #React #GitHubPages
