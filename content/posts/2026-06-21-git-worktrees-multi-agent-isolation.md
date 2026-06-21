---
title: "Git Worktrees: The Missing Piece for Multi-Agent Development"
date: 2026-06-21
tags: [git-worktrees, multi-agent, agentic-workflow, git-conveyor, parallel-execution, developer-tools, code-isolation]
summary: "Git worktrees solve the fundamental problem of parallel agent execution: multiple agents working on the same repo without conflicts. Each agent gets its own worktree with its own HEAD, index, and working directory, while sharing the same .git object database. This is the missing infrastructure layer for our agentic stack."
---

# Git Worktrees: The Missing Piece for Multi-Agent Development

You know the problem. You have two agents — a Coder and a Reviewer — working on the same repo. The Coder modifies `src/auth.py`. The Reviewer modifies `src/auth.py`. Now what?

Without isolation, agents must take turns. Merge conflicts accumulate. Test results are unreliable. Context switching wastes tokens. The whole parallel execution promise falls apart.

Git worktrees solve this. And they're built into git — no external tools needed.

## What is a Git Worktree?

A git worktree is a working directory associated with a single git repository, allowing you to check out more than one branch at a time.

```
Repository: /path/to/project/.git (shared)
    │
    ├── Main worktree: /path/to/project (branch: main)
    │
    ├── Linked worktree: /path/to/project-feature-a (branch: feature-a)
    │
    └── Linked worktree: /path/to/project-feature-b (branch: feature-b)
```

**Key properties**:
- Each worktree has its own `HEAD`, `index`, and working directory
- All worktrees share the same `.git` object database
- Branches are exclusive — a branch can only be checked out in one worktree at a time
- Commits in one worktree are visible to all other worktrees

## Basic Commands

```bash
# Create a worktree for a new feature
git worktree add ../project-feature-login feature-login

# Create a detached worktree for experiments
git worktree add -d ../project-experiment

# List all worktrees
git worktree list

# Remove when done
git worktree remove ../project-feature-login
```

That's it. Native git. No Docker. No separate clones. No filesystem tricks.

## The Problem Without Worktrees

```
Scenario: Coder and Reviewer working on same repo

Time 0: Coder starts on feature-a
        Reviewer starts on feature-b
        
Time 1: Coder modifies src/auth.py
        Reviewer modifies src/auth.py  ← CONFLICT
        
Time 2: Coder runs tests on feature-a
        Reviewer runs tests on feature-b ← WRONG CODE
        Reviewer's tests fail because of Coder's changes
```

**Consequences**:
- Agents must take turns (serial execution)
- Merge conflicts accumulate
- Test results are unreliable
- Context switching wastes tokens
- No isolation between agents

## How Worktrees Solve It

```
Scenario: Coder and Reviewer with worktrees

Repository: /project/.git (shared objects)
    │
    ├── Coder worktree: /project-coder (branch: feature-a)
    │   └── HEAD: feature-a
    │   └── index: feature-a
    │   └── working dir: isolated
    │
    └── Reviewer worktree: /project-reviewer (branch: feature-b)
        └── HEAD: feature-b
        └── index: feature-b
        └── working dir: isolated

Time 0: Coder creates worktree for feature-a
        Reviewer creates worktree for feature-b
        
Time 1: Coder modifies src/auth.py in /project-coder
        Reviewer modifies src/auth.py in /project-reviewer
        ← NO CONFLICT (different working directories)
        
Time 2: Coder runs tests in /project-coder
        Reviewer runs tests in /project-reviewer
        ← CORRECT CODE (each sees their own branch)
        
Time 3: Coder pushes feature-a
        Reviewer pushes feature-b
        ← Clean merge at branch level
```

## Integration with Our Agentic Stack

In [My Agentic Development Stack](/posts/2026-06-19-my-agentic-development-stack), I outlined the seven-tool stack. Git worktrees fit between the orchestration layer and the agent layer:

```
┌─────────────────────────────────────────────────────────────┐
│                 Task Orchestration Layer                     │
│  git-conveyor (SQLite Kanban + task assignment)              │
├─────────────────────────────────────────────────────────────┤
│                    Isolation Layer                            │
│  git worktrees (per-agent working directories)  ← NEW       │
├─────────────────────────────────────────────────────────────┤
│                    Agent Interface Layer                     │
│  mattpocock/skills + ponytail (discipline + minimization)    │
├─────────────────────────────────────────────────────────────┤
│                    Context Management                        │
│  context-mode (98% reduction)  │  codegraph (code intel)    │
├─────────────────────────────────────────────────────────────┤
│                    External Access                           │
│  agent-reach (13+ platforms)   │  playwright-mcp (browser)  │
├─────────────────────────────────────────────────────────────┤
│                    Persistent Memory                         │
│  strata-memory (3-tier wiki + SQLite index)                 │
└─────────────────────────────────────────────────────────────┘
```

**How each tool interacts with worktrees**:

**git-conveyor**: Orchestrates the pipeline. When a Coder claims a task, git-conveyor creates a worktree for that task's branch. When the Reviewer claims the review, git-conveyor creates a separate worktree for the same branch.

**mattpocock/skills + ponytail**: Each agent runs these skills in their own worktree. The Coder uses `/grill-me` and ponytail's minimization in their worktree. The Reviewer uses `/ponytail-review` in their worktree. No conflicts.

**context-mode**: Sandboxes tool output per worktree. Each agent's context is isolated — Coder's context doesn't bleed into Reviewer's.

**codegraph**: Indexes code per worktree. Each agent gets a fresh index of their branch's code. No stale cross-contamination.

**agent-reach + playwright-mcp**: Run in the agent's worktree context. If the Coder needs to research something, it happens in their isolated environment.

**strata-memory**: The exception — shared across worktrees. Knowledge is shared, implementation is isolated. This is the correct separation.

## How It Works in Practice

```
PM scopes task → SQLite Kanban → Coder claims task
    │
    ├── git worktree add /tmp/coder-T123 feature/user-auth
    │
    ├── Coder works in /tmp/coder-T123
    │     ├── /grill-me aligns on design
    │     ├── ponytail minimizes code
    │     ├── /tdd ensures tests pass
    │     └── Pushes to feature/user-auth
    │
    ├── Reviewer claims review
    │
    ├── git worktree add /tmp/reviewer-T123 feature/user-auth
    │
    ├── Reviewer works in /tmp/reviewer-T123
    │     ├── /ponytail-review checks for over-engineering
    │     ├── Runs tests in isolation
    │     └── Approves or blocks
    │
    └── Cleanup
          ├── git worktree remove /tmp/coder-T123
          └── git worktree remove /tmp/reviewer-T123
```

## Worktree Patterns for Agentic Workflows

**Pattern 1: Task Isolation**
Each task gets its own worktree. Agents work in parallel on different tasks.
```
Task T1: /tmp/agent-t1 (branch: feature-a)
Task T2: /tmp/agent-t2 (branch: feature-b)
Task T3: /tmp/agent-t3 (branch: feature-c)
```

**Pattern 2: Pipeline Isolation**
Each pipeline stage gets its own worktree.
```
Stage 1 (Code): /tmp/coder (branch: feature-x)
Stage 2 (Review): /tmp/reviewer (branch: feature-x-review)
Stage 3 (Test): /tmp/tester (branch: feature-x-test)
```

**Pattern 3: Agent Specialization**
Different agents get different worktrees based on their role.
```
Claude Code: /tmp/claude-work (branch: main)
Codex: /tmp/codex-work (branch: main)
```

## Worktrees vs Alternatives

| Approach | Isolation | Shared Objects | Complexity | Speed |
|----------|-----------|----------------|------------|-------|
| **Worktrees** | Full | Yes | Low | Fast |
| Clones | Full | No | High | Slow |
| Stash/branch switch | None | Yes | Medium | Medium |
| Containers | Full | No | High | Slow |

**Why worktrees win**:
- **Fast**: No need to clone entire repo for each agent
- **Efficient**: Shared .git object database
- **Simple**: Native git feature, no external tools needed
- **Clean**: Easy to create, manage, and remove

## The Bottom Line

Git worktrees are the missing infrastructure layer for multi-agent development. They solve the fundamental problem of parallel agent execution without external tools, Docker containers, or complex filesystem tricks.

With git-conveyor orchestrating the pipeline, worktrees providing isolation, and our stack of skills handling discipline and context, we finally have a complete multi-agent development workflow.

The best part? It's all native git. No new dependencies. No new infrastructure. Just `git worktree add` and go.

---

## References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) — Official git worktree documentation
- [My Agentic Development Stack](https://inotives.github.io/posts/2026-06-19-my-agentic-development-stack) — The seven-tool stack this integrates with
- [Ponytail: The Lazy Senior Dev Skill](https://inotives.github.io/posts/2026-06-20-ponytail-lazy-senior-dev-skill) — Code minimization discipline that runs in each worktree
- [git-conveyor](https://github.com/inotives/git-conveyor) — Multi-agent orchestration with SQLite Kanban
