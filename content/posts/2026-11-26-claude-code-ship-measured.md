---
title: "Claude Code's /ship, measured: from branch to merge-ready PR"
date: 2026-11-26
tags: [claude-code, ship, pull-requests, code-review, ci-cd, ai-agents, ai-engineering]
series: ai-engineer-with-claude
draft: false
summary: "Second entry in the AI engineer with Claude series. /ship takes a committed branch to a pull request that's ready to merge: Claude Code pushes and opens the PR, a /code-review agent reviews it, and a watch loop fixes failing checks, merges in conflicts and answers comments. On three kinds of change in this blog's repo it caught and fixed every planted bug and never tried to merge, but it was slower and cost three to six times as much as asking Claude to push and fix by hand. What it buys is not having to be there."
---

This is the second note in the **AI engineer with Claude** series. Each entry tests one Claude Code feature or habit with real runs and reports what it actually changed. The [first one](/notes/2026-11-25-claude-code-mode-tokens-and-time) measured Code Mode.

This one tests **`/ship`**, a built-in command that takes a branch from "work done" to "ready to merge":

```text
/ship
```

My normal loop looks like this. I ask Claude to "commit, push and open a PR", wait for CI, read the diff, ask for fixes, wait again, merge, pull, and delete the branch. `/ship` claims to do everything in that list except the merge, and to keep doing it while I'm away. I wanted to know how much time and money that costs, how good the review is, and what it does when something breaks.

Short version:

1. **It's slower to a green PR when you're sitting there.** `/ship` had the PR open about 10 s after I pressed Enter, and CI on the final commit was green after 3.3–5.0 minutes. My manual loop got there in 1.1–1.7 minutes. The extra time is the review and the fixes it led to.
2. **The review caught every planted bug, and so did plain Claude.** In both `/ship` runs of the planted-bug case, the review found all three problems and fixed them in one commit before I'd looked at the PR. But when I just said "push and open a pr", Claude ran lint first, refused to push, and named the same three problems in two of my three runs.
3. **It costs three to six times as much.** A `/ship` run cost $1.10–1.61 at Opus 5.5 list prices, against $0.26–0.46 for the manual loop. About $0.37 of that is a fixed opening turn, and $0.20–0.55 is the review. One idle wakeup that fired late cost another $0.50–0.56 on its own.
4. **The watch works.** It fixed a failing CI run, merged in a conflicting change to `master`, and answered review comments in about two minutes, each time without me.
5. **The guardrails held, but they're narrower than "never merges".** Claude Code blocks merge, approve, auto-merge and force-push commands while Claude acts on its own. That block is the only thing stopping a merge in a repo with no branch protection, like this one. And a message you type into the session lifts it for that turn.

## What /ship is

The [official docs](https://code.claude.com/docs/en/ship-command) describe two commands. `/ship` commits your work, pushes your branch and opens the pull request, then "Claude reviews your change with /code-review", and then "Claude keeps checking the pull request from your Claude Code session". `/steward` does only the last part, for a PR that's already open or a watch that ended. In both cases the merge is yours: "once the pull request is ready, merge it yourself."

![The five steps of /ship. You type /ship. Claude Code itself, not the model, pushes the branch and opens the pull request. A background agent runs /code-review high on the diff. A watch loop of check-ins fixes failing checks, merges in the base branch on conflicts and answers comments, then schedules the next wakeup. You merge. A band under the review and watch steps shows that Claude Code blocks merge, approve, auto-merge and force-push while Claude acts on its own.](/assets/images/ship-how-it-works.svg)

What the transcripts show about each step:

- **Push and PR are not a model step.** Claude Code does them itself and prints what it's doing: *"Pushing 1 commit on ship-test/b-ship-1 to inotives/inotives.github.io (public) and opening a pull request. Anyone can see what goes there, and it can't be taken back. Esc to cancel."* There's no confirmation prompt, only a few seconds to press Esc. Then the model gets a prompt that starts *"Claude Code itself has just pushed … and opened pull request #83"*.
- **The review is `/code-review high`** on `origin/<base>...HEAD`, run as a background agent. You can choose the effort: `/ship low`, `/ship max` and so on. The default is `high`. When it's done, it posts one summary comment on the PR: *"Claude Code reviewed this change at 0a34e1e for the author: 3 findings, 3 fixed."*
- **The watch is a `/loop` in your session.** It shows up in `/tasks` as `/steward --tend`. Each pass, which Claude calls a *check-in*, looks at checks, conflicts and comments, does what's needed, then schedules the next wakeup with `ScheduleWakeup`. In every run the gaps went 60 s, then 120 s, then 3,000 s once nothing was left to do. In the case B run where I left a comment, it stayed at 120 s until the comment was answered.
- **It reads comments** from you and from people with write access. Other bots are ignored unless you name them: `/ship +my-lint-bot`.
- **Its comments go out under your GitHub account.** Each reply starts *"Claude Code here, for the author"*, with a hidden marker so it can find its own comments again. To anyone reading the PR, it's you.

### Requirements and limits

- Claude Code v2.1.330 or later (I used 2.1.332), GitHub CLI 2.63+ signed in, and git 2.38+.
- **Auto mode for unattended work.** In default or acceptEdits mode, Claude waits at every permission prompt. In bypassPermissions mode, no watch starts.
- The terminal `claude` only: not `claude -p`, not cloud sessions, not background sessions, and no watch on native Windows.
- **The watch lives only as long as the session.** It ends when you close the terminal, `/clear`, `/resume`, start a `/loop`, or hit a usage limit. It also ends after 7 days. `claude --continue` brings back the conversation but not the watch, so you restart it with `/steward`.
- It works in your checkout, so don't switch branches there while it watches. The docs suggest a second clone for other work.
- Its work counts against your usage.

### Two things the docs say that I had wrong

My notes for this post said `/ship` "commits and pushes your work" and "never merges". Both are too simple.

- **In a public repository, "/ship doesn't commit your uncommitted changes."** If you're on a branch with commits, it pushes those and opens the PR without your uncommitted changes. Otherwise you commit first. It also never commits changes to `.gitignore`, `CLAUDE.md` or `.github/`. The secret check looks at file names only, such as `.env` or `password.txt`, not at what's inside the files. This blog is public, so every test case here was committed before `/ship` ran.
- **"Never merges" means "Claude Code blocks Claude's merge commands"**, which the troubleshooting page calls *the fence*. It blocks `gh`/`git` merge, approve, auto-merge and force-push while Claude acts on its own. Three gaps remain:
  1. If **auto-merge** is on for the PR, GitHub merges it when the checks pass, and the watch's fixes can be what makes them pass.
  2. In a repo where **branch rules let you merge without another person's approval**, the docs warn the watch "could merge a pull request" through that route.
  3. **A message you type lifts the fence for that turn.** "In auto mode, Claude may then be allowed to merge."

  The `/ship` prompt in my runs also warns that anyone who can push to your branch or land a change on the base branch "can run programs on this computer with your credentials while I watch", because the watch merges and runs their code unattended. Run it only where you trust everyone who can do that.

## The test

**Three cases** on this blog's repo (React and Vite, about 230 posts), each committed on its own branch in a fresh clone:

| case | what the branch has | what it tests |
|---|---|---|
| A: content | a draft post and an SVG chart | the easy path, false positives, a review comment left mid-watch |
| B: planted bugs | a new `relatedPosts()` helper in `src/utils/tags.js` | review quality and CI recovery |
| C: conflict | an edit to one line of a notes file | what it does when `master` changes the same line mid-watch |

Case B has three planted problems. The PR doesn't mention them:

```js
// Posts that share the most tags with `post`, best match first
export function relatedPosts(post, limit = 3) {
  const mine = new Set(postTags(post))
  const debug = []                                  // 1. unused: lint fails in CI
  return getAllPosts()
    .map((other) => ({
      other,
      shared: postTags(other).filter((t) => mine.has(t)).length,
    }))
    .filter(({ shared }) => shared > 0)             // 2. keeps the post itself
    .sort((a, b) => a.shared - b.shared)            // 3. worst match first
    .slice(0, limit)
    .map(({ other }) => other)
}
```

**CI.** This repo had no checks on pull requests, so I added one first: `npm run lint` and `npm run build` on every PR. That takes about 20 s.

**Runs.** Five `/ship` runs (two each for A and B, one for C) and three clean manual runs (two for A, one for B). I typed each `/ship` in an interactive session in auto mode. For the manual loop I used a small script (`notes/ship-runs/manual-run.sh`) that does what I'd do: it says "push and open a pr", waits for CI, says "CI failed on the PR. Check it and fix what's wrong." if it's red, and stops at green. Every run used a fresh clone, Claude Code 2.1.332 with Opus 5.5 (the default), and my normal user config. I closed each PR instead of merging it.

Three runs are left out of the time numbers. My first two manual runs sat for three hours before I came back to them. And my script sent one case B run the wrong follow-up. I mention what those runs did where it's useful.

**Measuring.** Each session writes a JSONL transcript. The review agent writes its own under `subagents/`. From those I took every API call's `usage` block, deduped by `requestId` because one call is logged once per content block, and split them into phases: the opening `/ship` turn, the review, and each check-in. From GitHub I took the PR's commits, the check runs on each commit, comments and force-push events. "Ready" means the CI run on the PR's final commit passed. The script is in the repo: `notes/ship-runs/measure.mjs`.

**Pricing.** Opus 5.5 list prices: $4 per million input tokens, $20 output, $0.20 cache read. Claude Code writes its prompt cache with a 1-hour TTL, at 2× input, so $8.

## Result 1: time to a merge-ready PR

![Bar chart of minutes from the first prompt to a green PR. Case A: manual 1.5 and 1.1 minutes, /ship 4.7 and 5.0 minutes. Case B: manual 1.7 minutes, /ship 3.5 and 3.3 minutes. Case C: /ship 3.7 minutes.](/assets/images/ship-time-to-ready.svg)

| case | mode | runs | PR open | CI green on final commit | commits |
|---|---|---|---|---|---|
| A | manual | 2 | 46–70 s | 1.1–1.5 min | 1 |
| A | `/ship` | 2 | 10–12 s | 4.7–5.0 min | 2 |
| B | manual | 1 | 80 s | 1.7 min | 2 |
| B | `/ship` | 2 | 11–12 s | 3.3–3.5 min | 2 |
| C | `/ship` | 1 | 9 s | 3.7 min | 2 (one a merge) |

`/ship` opens the PR fastest, because no model is involved in that step. Everything after that is slower than the manual loop. In the second case A run, CI was already green on the original commit 37 s after I pressed Enter. The PR was mergeable then. The next four minutes went on the review, a fix commit for its findings, and a second CI run.

Two things make this an unfair race in `/ship`'s favour and one in its disfavour:

- The manual times have no human in them. A script typed my follow-ups the moment CI finished. In real life I'd be reading something else and notice ten minutes later. That's the gap `/ship` is built to close.
- The `/ship` runs did more work: a full `/code-review high`, and in case A, edits I hadn't asked for (more on that below).
- But the manual runs got their bug fixes without a review step at all, as the next section shows.

## Result 2: review quality

| | `/ship` run 1 | `/ship` run 2 | `/code-review high` alone | manual, "push and open a pr" |
|---|---|---|---|---|
| unused `debug` (lint) | found, fixed | found, fixed | found | 2 of 3 runs found it before pushing |
| post in its own list | found, fixed | found, fixed | found | 2 of 3 |
| sorted worst first | found, fixed | found, fixed | found | 2 of 3 |
| findings in total | 5 | 3 | 4 | – |
| cost of the review | $0.29 | $0.24 | $0.28 | – |

In both `/ship` runs of case B, the review found all three planted problems, and the first check-in fixed them in one commit, pushed it, and turned CI from red to green. The extra findings in the first run were reasonable and left alone: ties keep index order, and nothing calls the helper yet.

For comparison, I ran `/code-review high origin/master...HEAD` on its own on a fresh case B clone (`claude -p`, same model). It took 29 s and cost $0.28. It found the same three problems. So the review inside `/ship` is the normal `/code-review`. What `/ship` adds is acting on the findings: the fix commit, the push and the CI loop.

The manual column is the surprise. In two of my three manual case B runs, "push and open a pr" was enough for Claude to run `npm run lint` before pushing, refuse to push a commit that would fail CI, and point out both logic bugs as well:

> I haven't pushed or opened the PR, because this commit (`c09472a`, the only one ahead of `master`) would fail the PR check. `npm run lint` fails, and the PR workflow runs lint. There are also two logic bugs in `relatedPosts` …

After one "fix it", it fixed all three, with the same diff as `/ship`. In the third run, an interactive session I left for three hours, it pushed straight away and CI failed. So plain Claude catches these bugs most of the time, but not every time. The review makes it every time, at about $0.25.

**Case A, content, is where the review oversteps.** It returned five or six findings per run. Two were real and new to me: everything in `public/` deploys on merge, so a draft post's chart goes live even though the post doesn't, and draft posts are still bundled into the site's JavaScript. It left both for me to decide, which is right. But it also *fixed* three things I hadn't asked about: it labelled my numbers as "sample data", added value labels to the chart, and in one run restyled the chart with a dark panel. Each is defensible. Together they're my blog post changing under me before I've opened the PR. On code that's what you want. On writing, it's worth reading the fix commits rather than trusting the green tick.

## Result 3: what the watch does

| event | what happened | how long |
|---|---|---|
| CI fails (B, 2 runs) | fixed in the first check-in, together with the review findings; one commit, one push | 2.3 min from the failed check to the fix commit |
| `master` changes the same line (C) | merged `origin/master` into the branch without asking; no rebase, no force-push | CI green on the merge commit about 40 s later |
| review comment: rename the chart (A) | renamed the file, updated the post, pushed, replied on the PR | 2 min 39 s from comment to reply |
| review comment: add a JSDoc (B) | added it, pushed, replied on the PR | 1 min 57 s from comment to reply |

Every event was handled in the next check-in, with no message from me. The replies say what changed and name the commit, for example *"I added a JSDoc comment above relatedPosts in 99b97dc. It explains that `limit` (default 3) caps how many posts come back…"*.

The conflict run is the one to think about. Merging the base branch in is what you'd do by hand, and here the change was trivial. But it means a watch will pull whatever lands on `master` into your branch and run CI on it, unattended. That's the trust warning from the docs in practice.

## Result 4: where the money goes

![Stacked bar chart of cost per run. Manual runs: $0.26, $0.27 and $0.46. /ship runs: $1.31 to $1.58 without a late wakeup, and $1.60 to $2.15 with one. Each /ship bar splits into an opening turn of about $0.37, a review of $0.20 to $0.55, check-ins of $0.54 to $0.71, and in the first three runs a late idle wakeup of $0.50 to $0.56.](/assets/images/ship-cost-by-phase.svg)

| phase | cost per `/ship` run | what it is |
|---|---|---|
| opening turn | $0.36–0.37 | the `/ship` instructions and first look at the PR, written to cache |
| review | $0.20–0.55 | the `/code-review` agent; more for content than for code |
| check-ins | $0.54–0.71 | three or four passes, including the fix commits and comment replies |
| a late idle wakeup | $0.50–0.56 | see below |
| **total** | **$1.10–1.61**, or up to $2.15 with the late wakeup | |
| manual loop | $0.26–0.46 | |

So `/ship` cost about **3× the manual loop on case B and 6× on case A**. The opening turn alone costs more than a whole manual run of case A.

**The late idle wakeup.** After the PR is ready, the watch schedules its next check-in 3,000 s out, just under the prompt cache's one-hour life. When that wakeup fires on time, it reads the cached context and costs about $0.03. Closing the PR also wakes the watch early: in my second batch, both watches stopped within ten minutes of the close, at about $0.03 each. In my first batch, the 3,000 s wakeups never fired. I don't know why; my laptop may have been asleep. The three watches only woke when I closed the PRs, about 80 minutes after their previous call. The cache had expired, so each one wrote its whole 61k–69k token context back to the cache at the $8 rate, just to notice the PR was closed. That's $0.50–0.56 for nothing, more than the review cost.

On the same pattern, a watch that sits on an approved-but-unmerged PR wakes about 29 times a day. At about $0.03 a wakeup that's roughly $1 a day, more if any wakeup is late. I didn't run a watch for days, so treat that as an estimate.

## Guardrails

| check | result |
|---|---|
| merge, approve or auto-merge attempted | none in 5 runs |
| force-push | none |
| a command blocked by the fence | none; it never tried |
| `Co-Authored-By` lines (this repo's CLAUDE.md rule) | none; it followed the rule |
| uncommitted changes committed in a public repo | not tested; I forgot to leave a stray file |
| watch after closing the terminal | not tested |

The fence never had to act, because Claude never tried a blocked command. That's good, but it also means I have no evidence of the fence itself working, only of the model not needing it.

All three of my first-batch runs have a typed message in them ("Note the time."), which I sent by mistake while the watch ran. Each cost about $0.04, and by the docs each lifted the fence for that turn. Nothing happened, but it's an easy way to lift it without meaning to.

One thing my own setup triggered: the `/ship` prompt warned that *"In this session there's a way around the watch's limits: a PreToolUse or PermissionRequest hook runs on shell commands"*. I have hooks in my user config. A hook that approves commands can let a blocked command through, so if you rely on the fence, check `/permissions` and your hooks.

## When /ship pays, and when it doesn't

- **It pays when you won't be there.** The watch answered CI failures, a conflict and two comments in about two minutes each, with nobody at the keyboard. If you open a PR and go to a meeting, or wait hours for a reviewer, that's the gap it closes. If you're watching the PR anyway, saying "push and open a pr" and then "fix it" is faster and a third to a sixth of the cost.
- **The review is worth its $0.25 on code.** It made the bug-catching reliable, where plain Claude caught them two times out of three. But you can get the same review with `/code-review high` and decide on the fixes yourself.
- **Read the fix commits, not just the green tick.** The review and its fixes land before you look. On my content PRs it rewrote parts of my post. That's the same cognitive-surrender risk this blog has written about before: the work is done, so it's easy not to check it.
- **Keep the session awake, or stop the watch.** A watch that wakes after more than an hour of quiet pays to rebuild its cache every time. Close or merge the PR when it's ready, or end the watch with `/ship stop`.
- **Don't use it where you don't trust everyone who can push to the branch or the base.** The watch merges their changes in and runs CI on them, as you.

## References

- Claude Code docs: [Get a pull request ready with /ship and /steward](https://code.claude.com/docs/en/ship-command)
- Claude Code docs: [Troubleshoot /ship and /steward](https://code.claude.com/docs/en/ship-command-troubleshooting)
- Previous entry: [Claude Code's Code Mode, measured](/notes/2026-11-25-claude-code-mode-tokens-and-time)
- The run kit and measurement script: `notes/ship-runs/` in this site's repo
