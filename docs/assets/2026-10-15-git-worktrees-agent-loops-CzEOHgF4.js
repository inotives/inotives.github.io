var e=`---
title: "Git Worktrees for Agent Loops: Isolation, Savepoints, and Parallel Work"
date: 2026-10-15
tags: [git, git-worktree, ai-agents, agent-rig, agentic-workflows, software-development]
summary: "What Git worktrees are, how they help agent loops work safely, and practical ways to use them for parallel features, reviews, hotfixes, experiments, and resumable tasks."
series: building-ai-systems
---

I spend a lot of time working through agent loops: assign a task, let a worker make a change, review the handoff, fix what needs fixing, and repeat. One Git term keeps showing up in that work: **worktree**.

At first, I used a worktree in AgentRig in a simple way: as a safe place to hold the current phase while the loop moved forward. That was useful, but it also made me ask what else developers do with worktrees and why agent workflows seem to benefit from them so much.

The short answer: a worktree gives a branch its own working directory. That lets several pieces of work happen side by side without making agents edit the same checkout.

![Dark diagram showing a Git repository with multiple independent worktrees and branches](/assets/images/git-worktree-multiple-sessions.svg)

## What is a Git worktree?

A Git worktree is a directory attached to a repository where a particular branch or commit is checked out. A normal clone has one working directory. With \`git worktree\`, the same repository can have several working directories open at once.

Each worktree has its own files, \`HEAD\`, and index. The worktrees share the repository’s object database and most references. In practice, each directory can show a different branch and hold its own uncommitted edits, while Git avoids duplicating the full repository history.

You can create a worktree for a new branch like this:

\`\`\`bash
git worktree add ../payments-fix -b fix/payments
\`\`\`

Git creates the \`../payments-fix\` directory, creates the branch, and checks it out there. You can continue your existing work in the original directory at the same time.

To see the linked directories:

\`\`\`bash
git worktree list
\`\`\`

When the task is done, remove the linked worktree after committing or preserving any changes you still need:

\`\`\`bash
git worktree remove ../payments-fix
\`\`\`

Git’s documentation describes worktrees as multiple working trees attached to one repository and notes that a branch normally cannot be checked out in more than one worktree at a time. A worktree is a separate checkout; it is not a second independent clone.

## A worktree is not itself a savepoint

I’ve found it helpful in AgentRig to think of the worktree as a phase savepoint: work for one phase has its own place, and the next phase can start without disturbing it.

Strictly speaking, the worktree is the workspace. A commit or branch reference is what records a durable point in Git history. If the worktree has uncommitted edits and you delete it, those edits can be lost. The worktree protects the rest of your checkout from those edits, but it does not automatically preserve them.

So the practical model is:

\`\`\`text
worktree = isolated working directory
branch   = named line of development
commit   = durable snapshot of changes
\`\`\`

For our AgentRig loop, a phase-specific worktree can act as a convenient boundary. When the phase reaches a good state, commit it. That makes the “savepoint” real and gives the next worker or reviewer a clear base.

## Why agent loops benefit from worktrees

An agent loop often runs several kinds of work in sequence: implementation, tests, review, fixes, and re-review. Sometimes tasks can run in parallel. If each agent writes into the same checkout, they can overwrite one another’s changes, observe half-finished files, or leave the shared directory in a state that is hard to attribute.

Give each independent task its own worktree and branch, and each worker gets a filesystem view that it can change without stepping on another worker’s uncommitted edits. The coordinator can keep the main checkout available for planning, status, or integration.

![Animated diagram of an agent loop moving from a clean base through isolated implementation and review to an integrated commit](/assets/images/git-worktree-agent-loop.svg)

The loop then has a legible path:

1. Choose a known base commit or branch.
2. Create a worktree and a branch for the task.
3. Let the worker implement and verify its changes there.
4. Have a reviewer inspect the resulting diff and evidence.
5. Fix findings in that task context and review again.
6. Integrate the accepted change into the target branch.
7. Remove the worktree after its changes are committed or otherwise preserved.

The important word is **independent**. Two tasks that both need to change the same core files may not be good candidates for parallel worktrees. Isolation prevents file races; it does not make conflicting tasks independent.

## How developers use worktrees in real projects

### Parallel features or agent tasks

Work on separate features at the same time. One worktree can handle the API change, another the UI, and a third a test or documentation task. Each change has its own diff and branch. Once reviewed, the changes can be merged or rebased in a deliberate order.

This is also the common pattern in coding-agent tools. Claude Code documents parallel sessions in separate worktrees and supports worktree isolation for delegated subagents. Codex describes choosing a fresh worktree for a change that should stay isolated, and lists worktrees among the mechanisms that keep parallel runs reviewable.

This makes parallel agents easier to supervise: each session has a specific task, its own changed files, and a diff that can be reviewed on its own.

### An urgent hotfix while a refactor is in progress

Git’s own worktree manual gives this example: you are in the middle of a refactor when an urgent fix arrives. Instead of stashing a messy working directory and hoping it restores cleanly, create a temporary worktree for the hotfix. Commit and remove that worktree when finished, then return to the refactor.

This is a useful human workflow too. An interruption does not have to take over the checkout you were already using.

### Review or test another branch without disturbing current work

Suppose your main checkout has local edits, but you need to inspect a pull request or run the test suite against a release branch. A separate worktree lets you check out that branch in another directory and keep the current edits in place.

The review can examine the exact branch state, run tests, and produce a clear report without mixing those actions with the active feature.

### Experiments and throwaway prototypes

Try a risky migration, performance idea, or new dependency in a detached worktree. If the experiment does not pan out, remove the worktree. If it does, create a branch and carry the changes forward.

This keeps speculative work from accumulating in the main feature’s diff. For an agent, it also gives the human a cheap way to stop an experiment without asking the agent to first untangle unrelated edits.

### Long-running work that pauses for review

Some tasks need a human decision before they can continue. Keep the task’s worktree and branch while the agent waits. The human can inspect the changes, leave feedback, and resume the same context later. Other tasks can proceed in their own worktrees meanwhile.

OpenAI’s Codex documentation describes the broader loop as plan, edit, run tools, inspect results, repair, and update project state. Worktrees add a file-system boundary to that loop: the task’s changes remain together and reviewable while the work runs or pauses.

![Dark lifecycle diagram showing a worktree created from a base branch, reviewed, merged, and safely removed](/assets/images/git-worktree-lifecycle.svg)

## Worktree isolation has limits

A Git worktree isolates the checked-out files and per-worktree Git state. It does not automatically isolate everything the code might use at runtime.

Several worktrees can still collide through:

- a shared development database or mutable test data;
- the same server port;
- shared generated files or caches outside the worktree;
- credentials, cloud accounts, or external services;
- dependencies installed in a shared directory.

If two agents can run migrations against one database or start servers on the same port, separate worktrees do not prevent those conflicts. Give each task separate runtime resources when its tests or commands mutate shared state.

Worktrees also share repository metadata. Commits made on a branch are visible to the repository, and a branch can only be actively checked out in one worktree at a time under normal Git rules. Name worktrees and branches after the task, keep a list of active work, and clean up only after checking whether the directory has uncommitted changes.

## A practical pattern for an agent team

For a small agent team, I would start with one worktree per independent task rather than one per agent role. Worker and reviewer are stages in the task lifecycle; they do not always need separate copies of the repository.

\`\`\`text
task-042 / branch: task/042-auth-timeout
  worktree: .worktrees/task-042-auth-timeout
  worker: implement + run focused checks
  reviewer: inspect diff + evidence
  fix loop: address findings in the same task worktree
  integration: merge accepted commit into target branch
  cleanup: remove worktree after confirming it is clean
\`\`\`

If two genuinely independent tasks are ready, run two worktrees in parallel. If the reviewer needs a completely clean view, review the worker’s committed branch or a specific commit from a separate checkout. Avoid creating a new worktree for every tiny action; setup, dependencies, and later integration all have a cost.

In AgentRig, our current use stays deliberately simple: a worktree gives the active phase a bounded workspace, and commits provide the durable checkpoints. A larger team can extend that pattern to parallel task worktrees, isolated hotfixes, review environments, and experiments without changing the core worker-review loop.

## The takeaway

Worktrees make concurrent development practical by separating working directories while keeping one repository history. That separation is valuable for agent loops because each task can have a clean base, its own changes, and a reviewable diff.

Treat the worktree as the place where work happens. Use branches to name the work and commits to preserve progress. Then choose a separate worktree whenever another task needs to move without disturbing the checkout you are using now.

## References

- [Git documentation: \`git worktree\`](https://git-scm.com/docs/git-worktree)
- [Claude Code: Common workflows, parallel sessions with worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-sessions-with-worktrees)
- [OpenAI Codex: Run long-horizon tasks with Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)
- [OpenAI Codex: Mastering remote engineering work](https://developers.openai.com/blog/mastering-codex-remote-for-engineering)
- [Previous article: AgentRig and filesystem-first multi-agent workspaces](https://inotives.github.io/posts/2026-07-06-agent-rig-filesystem-first-multi-agent-workspaces/)
`;export{e as default};