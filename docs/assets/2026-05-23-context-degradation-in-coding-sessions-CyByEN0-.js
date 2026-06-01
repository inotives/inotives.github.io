var e=`---
title: "Context Degradation in AI Coding Sessions — What It Looks Like and How We Work Around It"
date: 2026-05-23
tags: [ai-agents, context-degradation, workflow, llm, tooling, session-management]
summary: "Concrete signs of context degradation during AI coding sessions, the tools and strategies we use to detect and mitigate it, and how session structure matters more than model choice past a certain point."
---

## Context Degradation in AI Coding Sessions

When you spend hours a day working with AI code agents, you start to notice a pattern: the first 20-30 exchanges are sharp and productive. Then something shifts. The agent hesitates more, makes stranger choices, or confidently produces code that contradicts something it did ten messages ago.

This is context degradation. It is not a bug. It is a predictable consequence of how transformer attention works — the U-shaped curve where models attend best to the start and end of context, and information in the middle gets compressed or lost.

After tracking this across many sessions, here is how degradation actually shows up, what tools help catch it, and what strategies work in practice.

## How Degradation Shows Up

The research describes two failure modes: confident hallucination (Codex family) and stagnation (Claude family). In day-to-day work, the symptoms are more granular.

### Early Warning Signs (40-60% context fill)

- The agent starts doing full-file rewrites instead of targeted edits. A model that was making precise insertions suddenly replaces the whole component.

- It asks for confirmation before every step, even trivial ones. The "no-op" confirmation messages are the Claude-family stagnation signal — it is spending tokens on re-stating what it already did instead of moving forward.

- It picks the wrong tool for the job. Instead of reading a file, it tries to search for content it already has. Instead of editing a symbol, it proposes a new file.

- It adds excessive defensive code — null checks, try-catch blocks, fallback branches that were never discussed. This is the agent compensating for its uncertainty.

### Late Stage (60%+ context fill)

- The agent edits a file it already edited ten messages ago, undoing a previous change. It has lost track of what was done.

- It hallucinates file paths. It references \`src/components/Modal.jsx\` when the real file is \`src/components/ModalPopup.jsx\`. It proposes creating a file that already exists.

- It drops system prompt constraints. "Use only stdlib" becomes "import pandas." "No external dependencies" becomes a complex npm install. The model falls back to its training prior instead of following the session's rules.

- It repeats the same proposal in different words across multiple messages. The agent is cycling.

The critical insight: **by the time you notice degradation, it has been degrading for a while.** The warning signs at 40-50% fill are subtle but detectable if you know what to look for.

## Tools That Help Detect and Measure Degradation

### Context Window Awareness

The single most useful practice is knowing your context fill level. Most agent platforms do not expose this directly, but a few strategies help:

- **Monitor token usage from the provider API** if available. Watch for context approaching the model's limit.
- **Count exchanges as a proxy.** For 128K models, 30-40 exchanges is the danger zone for typical sessions. For 200K models, it is 50-60. This varies by how much file content each exchange reads.
- **Watch for tool-use quality changes.** When the agent starts choosing the wrong tool or mis-specifying arguments, that is the most reliable leading indicator.

### Session Logging

Keep a lightweight log of what each session accomplished. When performance drops, the log makes it obvious whether the agent is re-treading old ground or losing track of decisions. A simple text file per session with checkpoints works:

\`\`\`text
Session 2026-05-27-a: Add TOC sidebar to notes pages
  - Found route in App.jsx -> Note.jsx chain
  - Added heading parser to MarkdownRenderer
  - Styled sidebar in Notes.css
  - [checkpoint] TOC renders, responsive breakpoint works
\`\`\`

The checkpoint line is what survives a reset. If the agent starts degrading, the next session loads only the checkpoint, not the full conversation.

### Hard Resets as Diagnostic

When performance feels off, the fastest diagnostic is a hard reset: start a new session, hand off only the checkpoint summary, and compare the quality of the first reply. If the reset fixes it, the degradation was context-based. If it does not, the problem is something else (wrong model, bad prompt, unclear task).

## Mitigation Strategies That Work

### Context Budgeting

The highest-impact change is to stop letting context fill passively. Decide what fits before the session starts:

- **System prompt:** ~2K tokens. Fixed, stays at the start.
- **Current task:** ~5K. The specific thing being done right now.
- **Relevant files:** ~10K. Only the files needed for this step, not everything.
- **Conversation history:** ~10K. Trimmed to the last 5-10 exchanges plus summaries of older material.
- **Generated code:** ~10K. The code being produced.

This totals ~37K — well under the 55K danger zone for a 128K model. When any segment overflows, rotate old content out rather than appending.

### Session Segmentation

The research confirms what practice shows: **models return to peak performance after a hard reset.** There is no hangover. This means the right structure is multiple short sessions, not one long one.

In practice, this means:

- Each session has a single, completable goal. "Add TOC sidebar" is good. "Redesign the notes page" is too broad.
- When the goal is done, close the session and write a checkpoint.
- The next session loads the checkpoint, not the history.

This maps to the vertical-slice approach: every session produces a working increment.

### Phase-Based Compaction

Breaking implementation into independently-completable phases gives natural compaction points. When a phase finishes, summarize what was done, what was decided, and what the next phase needs. The next phase starts with only that summary — a cleaner context at full performance.

You do not need to compact after every phase. The trigger is context fill:

- **If your platform exposes context usage** (some Codex-based tools show token counts), compact when you hit 40-50% of the model's window — well before the degradation cliff.
- **If you do not have visibility into context**, count exchanges as a proxy. For 128K models, compact every 20-30 exchanges regardless of phase boundaries.
- **If a phase happens to finish early** and context is still low, keep going. No need to compact preemptively.

The compaction summary is self-validating: if you cannot write a clear one-paragraph summary of what a phase accomplished, the phase was too broad. Phase boundaries should follow actual working increments, not arbitrary planning milestones.

System prompt constraints are the first thing to degrade. The fix is to re-state them explicitly every 10-15 messages:

\`\`\`
Reminder: this project uses no external dependencies beyond React 18 + Vite.
Use only stdlib for data processing. Prefer targeted edits over file rewrites.
\`\`\`

This directly counteracts the dropout of middle-context information. For Codex-family models, where constraint drop is the leading degradation symptom, this is especially important.

### Summarization at Checkpoints

When a checkpoint is written, include four things:

1. What was decided (architectural choices, API design)
2. What files were changed (path and summary of each change)
3. What constraints are active (the system prompt rules that still apply)
4. What is next (the next task in the sequence)

The next session loads only these four items, not the raw conversation. This is the "hierarchical context" strategy from the research, adapted for everyday use.

### Which Model For Which Session

Session length determines model choice:

- **Short (<20 exchanges, <50K tokens):** Codex/GPT models. They are faster and more concise. Degradation has not started yet.
- **Medium (20-60 exchanges, 50K-200K tokens):** Claude. The broader context retention matters, and the stagnation failure mode is easier to catch than confident hallucination.
- **Long (60+ exchanges, 200K+ tokens):** Neither model performs well. This is where session structure matters more than model choice. Plan for multi-session work regardless.

## What We Use

### CodeGraph for Structural Context

CodeGraph gives the agent a fast, deterministic view of the codebase. It eliminates the need to keep file-structure information in conversational context.

When the agent asks for \`codegraph_context\` instead of reading five files, that saves 5K-10K of conversational tokens per query. The savings compound across a session. The AGENTS.md rules reinforce this: use CodeGraph first for structural questions, native search only for literal text.

### AGENTS.md as Context Anchor

The project-level AGENTS.md serves as a persistent reference anchor. It is not conversation history — it is a fixed document that the model can always retrieve. Keeping project conventions, file structure, and preferences there means they do not need to be re-stated in every session.

### Handoff Documents

For multi-session tasks, a handoff document captures the state at session boundaries. It is shorter than the raw conversation, stripped of exploration and false starts. The next session starts fresh with the handoff and returns to peak performance immediately.

### Checkpoints

After each completed subtask, we write a checkpoint. The checkpoint is what would be lost in a reset. Everything else is disposable.

## The Practical Takeaway

Context degradation is not a problem you solve. It is a constraint you design around.

The most effective strategy is not a better model or a bigger context window. It is structuring work so that each session stays within the model's safe zone, and having clear signals for when the window is getting full.

The tools that help most are simple ones: session budgeting, checkpoints, handoff documents, and a persistent project-level AGENTS.md. None of them require complex infrastructure. They just require thinking about context as a finite resource rather than an infinite scroll.
`;export{e as default};