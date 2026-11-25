---
title: "Idea: next AI engineer with Claude entry, the /ship command"
date: 2026-11-25
series: ai-engineer-with-claude
status: idea
---

# Next Claude series article: `/ship`

The first entry measured Code Mode. The next one could test `/ship`, a built-in Claude Code
command that takes a branch from local changes to a reviewed, CI-green pull request.

## What `/ship` does (verify against the docs before writing)

From the command's own description in Claude Code:

1. Commits and pushes your work, and opens a pull request if the branch has none.
2. Reviews the PR in the same session and fixes the real problems it finds.
3. Watches the PR (CI failures, merge conflicts, review comments) until it is merged or closed.
4. Never merges. Claude is told not to, so merging stays a human step.

Related commands, which the article could place `/ship` next to:

- `/steward`: only step 3. Watches an existing PR and handles CI, conflicts and comments, with no review first.
- `/code-review`: only the review step, at an effort level (low → max, or `ultra` in the cloud). `--fix` applies findings.
- Only a line the user types starts `/ship` or `/steward`. Claude can't start them itself.

## Why it's a good next entry

- My current loop is manual: "commit push and pr", wait for review, merge, pull, delete the branch.
  `/ship` automates most of that, so I can compare the two directly.
- It fits the series format: one feature, real runs, numbers.

## Questions to answer with real runs

- **Time:** wall time from "work done" to "PR ready to merge", with `/ship` and with my manual loop.
- **Review quality:** how many findings does the in-session review raise, how many are real,
  and how many fixes does it apply? Compare with a separate `/code-review` run on the same diff.
- **CI recovery:** break a build or lint step on purpose. Does it spot the failure, fix it and push again? How many tries?
- **Conflicts:** merge a conflicting change into `master` while it watches. Does it rebase or merge, and does it ask first?
- **Review comments:** leave a PR comment on GitHub. How fast does it react, and does it reply or only push a fix?
- **Cost:** tokens and dollars per shipped PR, including the time spent watching.
- **Guardrails:** confirm it never merges, never force-pushes without asking, and respects CLAUDE.md
  rules (for example, no Co-Authored-By lines in this repo).
- **Session behaviour:** what happens if I close the terminal while it's watching? Can it be resumed?

## Possible test set

Use this blog's repo, the same way as the Code Mode entry:

1. A content-only PR (a new post plus SVG charts): the easy case.
2. A playground mock PR with a script and generated data: more files, more to review.
3. A PR with a planted bug (for example a broken link or a lint error) to test review and CI recovery.
4. A PR that conflicts with `master` partway through.

Run each case with `/ship` and with the manual loop, a few times each.

## Open items before writing

- Find the official docs page for `/ship` and quote it, as the Code Mode post did.
- This repo has no PR CI: `.github/workflows/build-and-deploy.yml` runs only on pushes to `master`.
  Add a PR build check (`npm run build` on `pull_request`) so `/ship` has CI to watch, or use a repo that has one.
- Decide on the working title. Draft: "Claude Code's /ship, measured: from branch to merge-ready PR".
