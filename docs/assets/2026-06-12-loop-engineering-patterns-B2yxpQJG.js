var e=`---
title: "Loop Engineering: Stop Prompting Agents, Start Building Systems That Prompt Them"
date: 2026-06-12
tags: [loop-engineering, agentic-ai, coding-agents, harness-engineering, github-projects, automation, multi-agent]
summary: "Addy Osmani named it in June 2026: loop engineering is building the system that prompts your agent on a schedule, not typing each prompt yourself. I've been building exactly this with git-conveyor — a multi-agent pipeline that uses GitHub Issues and Projects kanban as the looping backbone. Here's the pattern, the building blocks, and what I learned."
---

## Loop Engineering: Stop Prompting Agents, Start Building Systems That Prompt Them

There's a shift happening right now in how people build with coding agents, and it has a name.

Addy Osmani published "Loop Engineering" on June 8, building on Peter Steinberger's observation: *"You shouldn't be prompting coding agents anymore. You should be designing loops that prompt your agents."* Boris Cherny said it even more directly: *"I don't prompt Claude anymore. I have loops running that prompt Claude... My job is to write loops."*

This hit home for me because I've been building exactly this — a multi-agent development pipeline called git-conveyor that uses GitHub Issues and Projects kanban as the looping mechanism. Not as a theoretical exercise. As a working system that runs autonomously against real repos.

Here's what loop engineering is, why it matters, and how the GitHub issue/kanban pattern maps onto it.

---

## The Three-Layer Stack

Most people are still stuck on layer one. Here's the full picture:

| Layer | What you optimize | Unit of work |
|---|---|---|
| Prompt engineering | How you phrase a single instruction | One turn you type by hand |
| Context engineering | What else goes in the window (docs, history, tool defs) | The conditions around one answer |
| Loop engineering | The system that decides what to prompt and when, and whether the result is acceptable | A self-running cycle across many turns |

Prompt engineering never goes away — a sloppy prompt inside a loop just produces sloppy work faster. Context engineering doesn't go away either — the loop still needs to inject the right files and history on each turn. Loop engineering wraps both layers in an autonomous control structure.

The one-sentence version from Lushbinary: *"Loop engineering is building a system that prompts your agent on a schedule and against a goal, instead of typing each prompt yourself."*

---

## The Five Building Blocks

A working loop needs five things, plus one place to remember state:

**1. Automations (the heartbeat).** A recurring trigger that surfaces work without you asking. In Codex: the Automations tab with project, prompt, cadence, and local/background worktree options. In Claude Code: \`/loop\` schedules a recurring prompt on an interval; \`/goal\` keeps working across turns until a verifiable condition is true.

**2. Worktrees (parallel isolation).** The moment you run more than one agent, files collide. Git worktrees provide a separate working directory on its own branch sharing the same repo history. Both Codex and Claude Code have first-class support for this.

**3. Skills (project knowledge).** How you stop re-explaining project context every session. A SKILL.md file with instructions, metadata, and optional scripts. The agent reads the skill and knows the project conventions without you repeating them.

**4. Connectors (tool access).** Built on MCP. The loop reads the issue tracker, queries databases, hits staging APIs, drops Slack messages. The difference between an agent that says "here is the fix" and a loop that opens the PR, links the ticket, and pings the channel once CI is green.

**5. Sub-agents (maker-checker split).** The most important structural move. Separate the agent that writes from the one that checks. The model that wrote the code is too generous grading its own homework.

**6. Memory (the spine).** A markdown file, Linear board, or GitHub issue list that lives outside the conversation. The model forgets everything between runs, so state lives on disk, not in the context window.

---

## How GitHub Issues + Projects Kanban Becomes the Loop

This is where it gets practical. You don't need a custom state management system to run loops. GitHub Issues and Projects V2 already provide the infrastructure — you just need to wire your agents to it.

Here's the pattern I built with git-conveyor:

\`\`\`
GitHub Issue Created (Backlog)
        |
   PM Agent (interactive) — decomposes issue into scoped tasks
        |
   [ To Do ]
        |
   Coder Agent (autonomous loop, polls every 12s)
        |
   [ In Progress ]  →  [ Review ]
        |
   Reviewer Agent (autonomous loop, polls every 15s)
        |
     hooks pass? ──no──→  [ To Do ]  (retry with failure context)
        │                          ↳ after 3 failures → [ Blocked ]
       yes
        |
      [ Done ]
        |
   Sync pushes status back to GitHub Projects
\`\`\`

### Why GitHub Issues work as the state spine

The research defines memory as "a markdown file, Linear board, or GitHub issue list that lives outside the conversation." GitHub Issues are ideal for this:

- **Issues are persistent.** They survive between agent runs. The model forgets everything each session, but the issue is still there with its labels, comments, and status.
- **Projects V2 provides the kanban.** Columns map directly to loop stages — Backlog, To Do, In Progress, Review, Blocked, Done. No custom database needed for the GitHub side.
- **Labels become signals.** You can label issues with priority, agent-assignment, or failure-count. The loop reads labels to decide what to pick up next.
- **Comments become the audit trail.** Every agent action — decomposition, implementation attempt, hook failure, rollback — gets logged as an issue comment. You can read the full history of what the loop tried.
- **PRs link back naturally.** The coder agent opens a PR that references the issue. The reviewer agent's hook results go in the PR checks. The loop has a complete paper trail without building one.

### The retry loop with failure context

The key insight in git-conveyor's loop design: when a task fails, the failure log gets injected into the next attempt's context.

\`\`\`
Task fails → retry_count increments → failure log saved to .conveyor/logs/
    → task returns to "To Do"
    → next Coder pickup includes failure log (bounded to 12KB)
    → Coder sees what went wrong and tries a different approach
\`\`\`

After 3 failures, the task moves to "Blocked" and requires human intervention. The loop doesn't spin forever — it knows when to stop and ask for help.

This maps directly onto the loop engineering pattern: the system finds work, hands it out, checks the result, writes down what happened, and decides what to do next. You designed it once. You don't prompt any of those steps by hand.

---

## The Harness vs. Loop Distinction

Harness engineering (Viv Trivedy, April 2026) is the sibling discipline. The equation: \`coding agent = AI model + harness\`. The harness is everything around the model — system prompts, AGENTS.md, skills, MCP servers, hooks, sandboxes.

Loop engineering sits one floor above:

- The **harness** makes a single agent run well
- The **loop** runs the harness on a timer, spawns helpers, and feeds itself

In git-conveyor terms:
- The \`.conveyor/profiles/coder/INSTRUCTIONS.md\` is the harness — it tells the coder agent how to behave
- The \`agent-runner.js\` polling loop, the SQLite kanban state machine, the sync daemon — that's the loop

The ratchet principle carries over: every agent mistake becomes a permanent signal. Every line in AGENTS.md traces back to a specific thing that went wrong. You only add constraints when you've seen a real failure.

---

## The Risks Nobody Talks About

Loop engineering introduces sharper failure modes than prompt engineering, and no tool solves them automatically:

**Verification debt.** A loop running unattended is also making mistakes unattended. The maker-checker split mitigates this but doesn't eliminate it. "Done" is a claim, not a proof. In git-conveyor, the reviewer agent runs hooks (test, lint, security-checks) — but if the hooks don't cover a specific edge case, the loop ships code that passes checks but doesn't work.

**Comprehension debt.** The faster the loop ships code you didn't write, the bigger the gap between what exists in the repo and what you understand. A smooth loop accelerates this unless you deliberately read what the loop produced.

**Cognitive surrender.** This is the comfortable failure. When the loop runs itself, it's tempting to stop having an opinion and accept whatever it returns. Two people can build the exact same loop and get opposite outcomes — one moves faster on work they understand deeply, the other avoids understanding the work at all. The loop doesn't know the difference. You do.

**Token costs swing wildly.** A scheduled loop with a verifier model after every turn burns tokens fast. Start with a slow cadence and tight goal condition. Watch the cost for a few days. Scale up only once the loop produces work you actually merge.

---

## What This Looks Like in Practice

Here's the concrete setup for git-conveyor:

**The agent roles:**
- **PM** (interactive) — reads GitHub Issues from Backlog, decomposes them into scoped tasks with What/Where/Done-when criteria, pushes to To Do
- **Coder** (autonomous) — polls every 12 seconds, claims tasks from To Do, implements via AI adapter (Claude, Codex, OpenCode, Pi), auto-commits, moves to Review
- **Reviewer** (autonomous) — polls every 15 seconds, runs hooks on completed code, advances to Done or rolls back to To Do

**The infrastructure:**
- SQLite with WAL mode for atomic task claiming (no race conditions between parallel agents)
- Git worktrees for parallel isolation (each agent gets its own working directory)
- Shared skills across all agents (project conventions, git rules, security rules)
- Retry with failure context injection (the agent sees what went wrong)
- Metrics logging in JSONL format (what was tried, what passed, what failed)

**The GitHub side:**
- Issues enter Backlog on the Projects V2 board
- Agent actions get logged as issue comments
- PRs link back to issues
- Status syncs between local kanban and GitHub columns

You design the system once. The agents run it. You review what they produced.

---

## The Bottom Line

Loop engineering is the natural next step after prompt engineering and context engineering. The leverage has moved from "how good is your prompt" to "how good is your system design."

If you're still typing prompts one at a time to a coding agent, you're doing layer 1 work in a layer 3 world. The tools are already there — Claude Code has \`/loop\` and \`/goal\`, Codex has the Automations tab, both support worktrees, skills, and sub-agents. GitHub Issues and Projects V2 already provide the state management layer.

The question isn't whether to build loops. It's whether you'll design them deliberately or let them evolve accidentally. One approach gives you a system that runs against a goal. The other gives you a system that runs against nothing.

Build the loop. Set the goal. Let the system prompt the agent. Your job is to design it, verify what it produces, and know when to intervene.

---

### References

1. Addy Osmani — "Agent Harness Engineering" (April 19, 2026): https://addyosmani.com/blog/agent-harness-engineering/
2. Addy Osmani — "Loop Engineering" (June 8, 2026): https://addyo.substack.com/p/loop-engineering
3. Lushbinary — "Loop Engineering: The Guide for AI Agents" (June 9, 2026): https://lushbinary.com/blog/loop-engineering-ai-coding-agents-guide
4. git-conveyor project: https://github.com/inotives/git-conveyor
`;export{e as default};