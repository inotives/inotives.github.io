---
title: "Elephants, Goldfish and my trinary workflows"
date: 2026-11-02
tags: [ai-agents, elephant-goldfish-model, trinary-agents, agent-rig, design-docs, code-review, agentic-workflows]
series: building-ai-systems
summary: "Notes on Dave Rensin's Elephant-Goldfish Model, which treats design documents as the new source code and tests them with zero-context AI sessions before writing code, and how it compares with my AgentRig, trinary-agents and trinary-rapid workflows: where we already agree, where we deliberately differ, and the one gap worth closing."
---

I recently read Dave Rensin's [Elephants, Goldfish and the New Golden Age of Software Engineering](https://drensin.medium.com/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874). It is a long essay about how a Google team learned to build with AI coding assistants without "mass-producing our mistakes." In October, Google open-sourced the team's method as a plugin at [egm.dev](https://egm.dev).

The essay interested me because it argues for much of what I have been building into [AgentRig](https://github.com/inotives/agent-rig) and [Trinary Agents](https://github.com/inotives/trinary-agents), from a different starting point. These notes summarise Rensin's argument first, then compare it with my own workflows, and end with what I want to change.

## Part 1 of the essay: use the AI as an interrogator, not a researcher

Rensin opens with an everyday example: buying a car. The usual approach is to write a paragraph about what you want, put a chatbot in research mode, and ask for a comprehensive report. You get an impressive-looking report and a confident recommendation. In Rensin's words, "we used a very powerful tool like a toy and got a toy result."

The better approach has three steps:

1. **Victory loves preparation.** Ask the model to interrogate you instead of researching for you. Ask it to keep asking clarifying questions and challenging your assumptions until you say stop. Spend 15–20 minutes on this. Your paragraph becomes 2–3 pages. When the model turns sycophantic, push back: *"When you agree with me you are not being helpful."*
2. **Trust but verify.** In the same session, ask the model to play a skeptical fact-checker and help you write the **acceptance criteria** for the report before anyone produces it. That is another 2–3 pages, written as a grading rubric.
3. **Profit.** Open a *new* session, give it the problem description and the grading criteria, and only then let it run deep research.

Two ideas from this section carry through the whole essay. First, **judgment is the job**, and the model is good at "generating sequences of words that superficially resemble" judgment, so do not outsource it. Second, **save the artifacts**: the description, the criteria and the final output. Do not save the chat, which "turns out to be mostly token noise." Saved artifacts let you, and new team members, ask past reasoning why a decision was made.

## Part 2: Elephants and Goldfish

The second part comes from software. A small internal tool Rensin built grew to more than 100,000 users at Google, with dozens of contributors. AI made that speed possible. It also showed the danger: if bad code is generated faster than good code, the project eventually "collapse[s] under the weight of its own unreadable, unmaintainable slop."

Three "aha" moments shaped the response:

1. **A session crash erased an hour of context.** A written document recording intent and progress would have made recovery a 30-second job.
2. **With context back, the model ran off the rails.** It invented APIs and made architecture choices nobody asked for. Models are eager to please and need strict guardrails.
3. **`sizeof(docs) << sizeof(code)`.** Giving a model plain-English design docs is cheaper, faster and more reliable than having it read thousands of lines of code.

These lead to the essay's central claim: **design is the new code**. When people wrote code, design decisions were spread between design docs and the many small choices inside the code. When a model writes the code, a person no longer makes those small choices. Unless those choices are written into the design document *before* coding starts, the system becomes incomprehensible to the person responsible for it. Rensin expects code to become opaque, either because there is too much to review or because models eventually emit binaries. Then the design is the only artifact that matters.

The **Elephant-Goldfish Model (EGM)** is the operating method:

- **The Elephant** is a long, heavily prompted AI session with full context, plus the design document it helps you write. It remembers every argument and micro-decision.
- **The Goldfish** is a brand-new session with no memory. It knows only what you put in front of it.

The rule is: *feed the Elephant; test it against the Goldfish.*

![Animated diagram of the Elephant-Goldfish Model: a long Elephant session builds a four-section design doc, three fresh Goldfish sessions test the doc and send gaps back, then a human approves, an agent implements from the doc, and a harsh code review repeats until trivial](/assets/images/elephant-goldfish-model-flow.svg)

The process has four phases and nine steps:

- **Phase 1, grow the Elephant (no code yet).** Load the relevant docs or code and correct the model's understanding immediately (step 1). State the "no code" rule explicitly and have a 20–30 minute design argument (step 2). Break sycophancy with *"Why do you think that?"* (step 3). Then **ask the AI to propose the first technical design** in prose and block diagrams (step 4). Rensin insists the model goes first, because its proposal shows whether it understood the problem. If you propose first, you miss blind spots. This debate can last hours. Some of his sessions lasted 2–3 days.
- **Phase 2, teach the Elephant.** Build the design doc section by section in the same session: **Problem** (3–5 sentences), **Technical Plan** (prose plus a diagram), **Alternatives** (what you rejected, which guards against later hallucinations and repeated arguments), and **Detailed Implementation**, which lists *every file* that will be created or changed and why. The doc goes into the repository and becomes the new source code.
- **Phase 3, the Goldfish protocol.** Run three tests, each in a fresh session that reads only the doc and the files it references. The **comprehension test** asks it to explain the goal and how the current system works (step 5). The **critic review** asks for every gap, faulty assumption and missed edge case (step 6); about 30% of the suggestions are valuable. The **implementation-readiness check** asks whether it could build the feature correctly on the first pass (step 7). Repeat each test until only nit-picks remain, then get a human review.
- **Phase 4, implementation.** Only now does anyone write code. Tell the model to "follow the plan exactly" (step 8). If the session crashes, a new one reads the doc and continues. Finish with a deliberately harsh review: *"I have a strong intuition that this code is of poor quality. Please tear it to shreds"* (step 9). Repeat until the critiques are trivial.

For existing codebases, Rensin describes **"peanuts and hay"**: recursive README summaries. An AI writes a README for each leaf directory, an engineer spends 5–10 minutes correcting it (the AI is about 50% wrong at the leaves), and the summaries roll up level by level to the root. A fresh session can then understand the codebase from the READMEs alone. The same READMEs and docs become an onboarding notebook. A new engineer, or a product manager who wants a feature, proves they understand the system by writing a design doc that passes the Goldfish test.

## Part 3: we are all managers now

The predictions section reframes individual contributors as managers of agents. A bad manager micromanages. A good manager defines the outcome, the guardrails, the scope of authority and **the conditions under which to stop and ask**. You can measure management skill by how long you can look away before things go wrong. Rensin's practical advice is to take a basic people-management course and start with a small "team" of 3–5 agents. They also suggest training sustained concentration like a muscle, adding 5–10 minutes a week, because the time AI frees up is best spent on hard thinking. Jevons' Paradox suggests we will not work less, only produce more.

## How my workflows compare

Here is a short reminder of what I am comparing against. Earlier I wrote about [moving from AgentRig to Trinary Agents](/notes/2026-10-20-from-agent-rig-to-trinary-agents):

- **AgentRig** is a CLI that scaffolds a `.agent-rig/` workspace with editable planner, worker and reviewer profiles, shared context, task records (SQLite or Markdown) and a task board. Its planner profile uses a "grill with docs" interview skill before work is handed to a worker.
- **trinary-agents** is a skill. The main agent acts as project manager. It interviews me until the feature is decision-complete, writes an implementation plan (`IP-XXXX/README.md`), waits for my explicit approval, breaks the plan into a dependency graph of tasks, and dispatches one task at a time to a worker subagent. A *different* reviewer subagent then checks the work, and append-only Markdown handoffs record each step.
- **trinary-rapid** is the lightweight version for small, well-bounded changes. It runs at most two interview rounds, one plan approval, implementation by the main agent, one independent review, a templated report and my final acceptance.

![Grid comparing the Elephant-Goldfish Model, trinary-agents and trinary-rapid across seven stages. All three interview, plan, get human approval and review code with a separate agent; only the Elephant-Goldfish Model tests the plan itself with zero-context sessions, which is highlighted as the gap in both trinary workflows](/assets/images/fresh-eyes-checkpoints-egm-vs-trinary.svg)

### Where we already agree

**The interview comes before the code.** Rensin's "no code" rule and interrogation are at the core of both trinary skills. trinary-agents builds a decision tree, asks only the questions whose prerequisites are settled, gives a recommendation with each question, and does not create tasks or touch project files until I approve the plan. The recommended answers do some of what Rensin's step 4 does: the model proposes first, which exposes how it understands the problem.

**Acceptance criteria are agreed before the work.** Rensin's "trust but verify" rubric matches the `Acceptance checks` section in every IP and RF plan, written with commands where possible. trinary-rapid's report then shows every check as a row marked passed, failed or not run, which is close to grading the output against a rubric agreed in advance.

**A durable document replaces chat memory.** Aha moment #1 is the reason trinary's "Resuming a feature" section exists: *rebuild state from the durable records, do not rely on earlier chat context.* The plan, task READMEs and handoffs are designed so that a session with no memory can pick up the work. They also match Rensin's advice to keep the artifacts and drop the chat: decisions, criteria and outcomes are kept, and the conversation is not. Moving from SQLite in AgentRig to Markdown in trinary was partly about making those records readable and diffable, which supports the idea that the document is the thing that matters.

**There are guardrails against eager models.** Aha moment #2 corresponds to the `Scope`, `Non-goals` and `Out of scope` sections, the rule that workers implement only their assigned task, and the rule that out-of-scope ideas become backlog follow-ups instead of extra scope.

**A separate agent with fresh context reviews the code.** The trinary reviewer must be a subagent that "has not implemented the task", and it treats the worker's checks as *claims* that it reruns where practical. That is the Goldfish idea applied to code: an agent that was not part of the discussion judges the result.

**I keep the judgment.** Approval of the plan and acceptance of the result are explicit human actions in both skills, recorded with timestamps. An agent never marks a feature accepted on its own. This is Rensin's "do not outsource your judgment" written into the workflow.

**The setup is managerial.** The project-manager role, the blocker process ("state the decision needed, the impact of waiting and the options, then wait"), and capped rework rounds are close to Rensin's description of good management: define the outcome, the guardrails and when to stop and ask. trinary is even more cautious than the "start with 3–5 agents" advice, because it dispatches **one task at a time**.

### Where we deliberately differ, and why

**The amount of process depends on the size of the work.** EGM applies one thorough process to every feature: interviews that can last days and three Goldfish loops. trinary-rapid caps the interview at two rounds and then runs a fit check. If the change spans many modules or needs more than about five steps, it recommends the full workflow. *Why:* much of my work is small, and a three-day design debate for a 40-line fix costs more than the slop it prevents. I would rather choose the process size deliberately than overpay every time.

**Work is split into tasks instead of one implementation pass.** EGM gives the whole design doc to one implementation session. trinary-agents breaks the plan into a task graph, and each task gets its own worker-reviewer cycle with handoffs. *Why:* smaller units make reviews smaller and failures narrower, and the handoffs make interrupted work easy to resume. The cost is more records. trinary-rapid is close to EGM here because the main agent implements all the steps.

**The review asks for evidence, not just harshness.** Rensin's step 9 tells the model the code is bad and asks it to "tear it to shreds" until the critiques are trivial. My reviewer starts from `VERDICT: CHANGES_REQUESTED`, must check the acceptance criteria and rerun checks, and records which checks it ran and which it relied on from the worker. Rework is capped at three rounds before I am asked to decide. *Why:* an open-ended "find everything wrong" loop can keep finding complaints. A structured verdict tied to acceptance criteria tells me when to stop. The cost is that I do not explicitly ask about readability. Rensin's "flag 10 lines without a comment" is a quality bar that my reviewer prompt does not include.

**A plan is a workflow record, not a living system document.** In EGM, the design doc becomes permanent source code, and the plugin even has an `/egm-drift-report` command that compares the docs with the current code. My IP and RF plans belong to a single feature. They live in `trinary-workspace/`, are finished when the feature is accepted, and in a project that ignores the workspace in git, trinary-rapid's plan may never be committed. *Why:* trinary is a delivery process, not a documentation system, and project knowledge lives in `AGENTS.md` and the repository's own docs. Rensin's argument shows the cost: decisions made in an IP's `Design and decisions` section never become the durable system description that the next feature's Elephant could use.

**Plans do not list every file.** Rensin requires the Detailed Implementation section to name every file that will change and why. My task briefs define scope and acceptance criteria and leave the worker to find the files, with codebase investigation built into the instructions. *Why:* file lists go stale quickly, and I did not want plans to become pseudo-code. The cost is that the reviewer cannot compare the diff with an expected list of files, which would be a simple drift check.

**I use code indexes instead of README summaries for context.** I do not create Rensin's "peanuts and hay" READMEs. Instead, the trinary skills tell agents to use whatever code search or index is available, and I lean on [CodeGraph](/notes/2026-05-20-codegraph-for-agentic-codebase-work) for that. *Why:* an index stays current without anyone maintaining it. Even so, `sizeof(docs) << sizeof(code)` still applies, because an index gives the agent *code*. A README explains *intent*, which code cannot show.

### The gap that matters: nobody tests the plan with fresh eyes

Most of my differences are trade-offs I would make again. One is not. In both trinary skills, **the only zero-context check comes after the code is written.** The plan goes straight from the agent that wrote it, the Elephant, to me. That agent has all the context from our interview, so a plan that depends on that context reads as complete to both of us. A fresh reader would see the missing parts.

Rensin's Goldfish tests exist to catch this. The comprehension test checks whether the plan stands alone. The critic finds the edge cases neither of us mentioned. The readiness check asks whether a worker could build from it. Each catches a weak plan while fixing it still costs only words. In trinary-agents, the first agent to read the plan without our shared context is the worker, after approval, and by then a gap in the plan has become wasted work in code.

## What I am taking from the essay

1. **Add a Goldfish step before plan approval.** In trinary-agents, before presenting the IP, start a fresh subagent that reads only the IP and the files it references, and ask it Rensin's three questions: explain it, critique it, and say whether it is ready to build. Put real gaps back into the plan and record the rest. In trinary-rapid, make this a single optional comprehension check so the workflow stays fast.
2. **Add an `Alternatives` section to the plan templates.** `Design and decisions` records what we chose. Rensin is right that recording what we *rejected* is what stops a later session from reopening the argument.
3. **List expected touch points in task briefs.** This does not need to be every file, just the modules a worker is expected to change. The reviewer can then flag any diff outside them, which gives a cheap check for drift.
4. **Promote lasting decisions out of the workspace.** When a feature is accepted, the decisions that describe the *system*, not the workflow, should move into the project's docs or `AGENTS.md` so the next feature's Elephant can start from them.
5. **Keep sizing the process.** Choosing between rapid and full trinary, requiring evidence in reviews, capping rework and keeping explicit human gates all work. EGM's thoroughness is right for a tool with 100,000 users and dozens of contributors. A personal project needs a lighter default that can scale up.

Finally, Rensin's line that "the job is intent, the job is architecture, the job is design judgment" is the best description I have read of what the human is for in a trinary loop. The skills are there to protect that judgment. The Goldfish idea gives them a better test of whether I have actually written it down.

## References

- Dave Rensin, [Elephants, Goldfish and the New Golden Age of Software Engineering](https://drensin.medium.com/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874) (April 2026, updated October 2026)
- [Elephant-Goldfish Model plugin](https://egm.dev) and [source](https://github.com/google/elephant-goldfish-model)
- [AgentRig repository](https://github.com/inotives/agent-rig)
- [Trinary Agents repository](https://github.com/inotives/trinary-agents), including the [trinary-agents](https://github.com/inotives/trinary-agents/blob/main/skills/trinary-agents/SKILL.md) and [trinary-rapid](https://github.com/inotives/trinary-agents/blob/main/skills/trinary-rapid/SKILL.md) skills
- [From AgentRig to Trinary Agents](/notes/2026-10-20-from-agent-rig-to-trinary-agents)
