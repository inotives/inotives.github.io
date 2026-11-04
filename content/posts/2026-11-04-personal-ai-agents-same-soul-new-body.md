---
title: "Personal AI agents: the same soul.md in a new body"
date: 2026-11-04
tags: [ai-agents, personal-agents, agent-harnesses, inference-costs, agent-security, openclaw, claude-duet]
series: building-ai-systems
summary: "Gemini Spark, Grok Bot, Muse, Dots and Claude Duet all launched in 2026 as always-on personal agents. Under the branding, the persona is just a prompt, much like the architect, coder and reviewer roles we gave coding agents earlier this year. What the labs actually built is a computer for each agent, a schedule that wakes it, and a trust layer around your accounts. That loop is also why Grok and OpenAI now say the products are compute heavy, and it is why you can build one yourself but should expect to pay the same bill."
---

Between May and October 2026 every major lab shipped a personal agent:

| Agent | Lab | Launched | Built on |
| --- | --- | --- | --- |
| [Gemini Spark](https://techcrunch.com/2026/05/19/google-introduces-gemini-spark-a-24-7-agentic-assistant-with-gmail-integration/) | Google | May 19, at I/O | Gemini 3.5 and the Antigravity agent harness |
| [Grok Bot](https://x.ai/news/introducing-grok-bot) | xAI / SpaceX | Aug 11 | xAI models, sold through SuperGrok and Cursor |
| [Muse](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) | Meta | Sep 8 | Muse Spark |
| [Dots](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/) | OpenAI | Sep 29, at DevDay | GPT-6 Astra |
| [Claude Duet](https://claude.com/resources/articles/claude-duet) | Anthropic | Oct 21 | Claude Opus 5.5 |

Read the launch posts one after another and they blur together. Each one is "a teammate you message like a person", "has its own computer", "keeps working when you step away", "remembers how you like things done" and "checks with you before it acts". Each has a name and some have an avatar.

My first reaction was the same as many developers: isn't this just a system prompt with a personality? Earlier this year we gave coding agents profiles such as architect, coder, reviewer and designer ([trinary agents](/notes/2026-10-20-from-agent-rig-to-trinary-agents), [AgentRig](/notes/2026-10-10-docker-agent-and-agentrig)). The open-source [OpenClaw](https://docs.openclaw.ai/start/openclaw/index.html) project made a `SOUL.md` file famous for exactly this. So is this new at all?

This note answers three questions: how similar the five products really are, why xAI and OpenAI are now saying they are expensive to run, and whether we can build one ourselves.

## Half right: the persona really is just a prompt

Meta's own design post for Muse quotes the first line of its system prompt: *"Your purpose is to make your user's life better."* That is a soul.md. OpenClaw's workspace has the same pieces as plain files: `SOUL.md` (identity, voice, rules), `USER.md`, `TOOLS.md`, `IDENTITY.md` and `HEARTBEAT.md`. Our coding roles were the same idea: a model plus `architect.md` or `reviewer.md`.

So if "innovation" means the personality, the suspicion is right. The persona is the cheapest and least new part. It is a few hundred words, and the model already knows how to be helpful. What the launch posts describe is a stack of seven layers, and the persona is the thinnest one:

![A stack of seven layers: persona, memory, tools, triggers, runtime, trust layer and model. Persona and model are the same as our coding roles. Memory, tools, runtime and trust are partly there. Triggers are missing from coding roles. Triggers, runtime and trust are highlighted as where the products did most new work.](/assets/images/personal-agents-anatomy.svg)

Our coding setups already had the top layer (roles) and the bottom layer (the same frontier models). We had parts of memory, tools, runtime and trust. We had nothing in the triggers layer. Every session started because a person typed something.

## How similar the five products are

Put the five side by side and the middle of the table is almost the same row five times:

![A table of five agents across model, own computer, starts by itself, guardrails, reach and compute limits. The own computer, starts-by-itself and guardrails columns are boxed as nearly identical. Model, reach and compute limits differ.](/assets/images/personal-agents-matrix.svg)

**The same in all five:**

- **A computer of its own.** Muse runs on a "Muse Secure VM" with a file system, a terminal and a browser. Each dot has "its own cloud computer". Duet has "a virtual machine with its own browser". Grok Bots "share a computer of their own in the cloud". Spark keeps running on Google's cloud after you close your laptop.
- **They start work by themselves.** Duet sends a morning brief and then checks your apps every few hours. Spark watches Gmail. Muse sends messages first, with what Meta calls a high bar for interrupting you. This is the heartbeat loop that OpenClaw's `HEARTBEAT.md` runs every 30 minutes by default.
- **One long thread instead of separate chats.** Muse and Duet both chose a single ongoing conversation with memory that persists across it.
- **Approval before risky actions.** Paying, sending, signing and deleting all wait for a yes.

**Different in each:**

- **The model.** Each lab uses its own model, post-trained for long agentic runs. Meta built Muse Spark "for real-world agentic work like this". This is real work, but it is model work, not persona work.
- **The depth of the trust layer.** All five ask for approval. The defences behind that vary a lot. Muse puts a separate *Sentinel* agent on the same machine, and nothing reaches the internet unless the Sentinel approves it. Duet routes actions through Anthropic's auto-mode classifier, adds a dedicated classifier and safety prompt for sensitive data, and keeps credentials where the model never sees them (the Managed Agents design). Spark uses Google's AP2 protocol to cap spending and limit merchants.
- **Reach.** Spark has Gmail, Docs and Chrome. Muse lives in WhatsApp. Dots connect to more than 4,000 apps and Duet to more than 6,000 connectors. Grok Bot leans on computer use for "platforms with no clean API or MCP".
- **How they ration compute.** This turns out to be the most telling difference, and the next section covers it.

## What actually changed from our coding roles

Our roles and their personas are the same kind of file. What changed is everything around the file:

![Left: coding roles as three prompt files inside one terminal session that a person starts, active for a short part of the day. Right: one persona file inside a loop of heartbeat, read apps, decide, act in its VM, ask approval and write memory, active in bursts throughout the day.](/assets/images/personal-agents-vs-coding-roles.svg)

Three things shifted:

1. **Lifetime.** A coding role lives for one session. When the terminal closes, the context is gone, and only the repo and handoff files remain. A personal agent lives in a computer that does not log off.
2. **Trigger.** We started every run. Their loop is started by a timer, a new email or a calendar change. The agent decides whether anything needs doing, and most of the time the answer is no.
3. **Permissions.** Our roles could touch a repository. These agents hold your email, your calendar, your payment methods and logins to your accounts. That is why so much of each launch post is about safety.

So is it innovation? Not much in the persona, and not in the basic idea either; OpenClaw users were already running this loop on their own machines. The real work is engineering and product: a sandboxed computer per user that runs all day for millions of people, a trust layer that has been red-teamed against prompt injection while holding real credentials, OAuth integrations with thousands of apps, and models trained to keep long tasks on track. It is closer to "everyone could run a web server, and cloud hosting still mattered" than to a new research idea.

## Why they are compute heavy

The admissions came quickly. On November 1, Elon Musk said Grok Bot's cost is ["unsustainably high relative to revenue"](https://fortune.com/2026/11/03/musk-says-grok-bots-costs-are-unsustainably-high-while-openai-admits-dots-are-compute-heavy-is-the-personal-ai-agent-push-dead-on-arrival/) and cut back the weekly allowances, so paying users hit their limits early. Grok Bot had reached about 800,000 paid weekly users. OpenAI's head of ChatGPT consumer, Adam Fry, said Dots are "on the compute heavy side", and OpenAI is adding a router that sends simpler work to the smaller GPT-6.1 Terra instead of running everything on GPT-6 Astra. Anthropic says Duet's background checks count against your normal Claude plan limits.

None of this cost comes from the persona. A few hundred words of soul.md is a rounding error. The cost comes from the loop:

![Left: a bar chart of input tokens per step in a 40-step task. A fixed prompt of 20k tokens stays constant while history grows by 3k per step, reaching 140k at step 40, about 3.2 million tokens for the task. Right: one user's day. A chat assistant uses about 60k tokens and a personal agent about 9.8 million, roughly 160 times more.](/assets/images/personal-agents-token-loop.svg)

The numbers in the chart are my own illustration, not vendor figures, but the shape is what matters:

1. **Every step re-reads the whole context.** An agent step is one model call: read everything so far, choose a tool, get the result back. The history grows with each step, so a task with `n` steps reads about `n·base + Δ·n²/2` input tokens. The cost grows with the square of the task length, not in a straight line. With 40 steps, a 20k fixed prompt and 3k of new history per step, one task reads about 3.2 million tokens.
2. **Checking costs tokens even when nothing happens.** A heartbeat that reads your inbox and decides "nothing to do" still pays for a full prompt. Eight checks a day across millions of users adds up even before any real work.
3. **Computer use sends screenshots.** On sites without an API, each step adds image tokens.
4. **Safety adds model calls.** A classifier on each action, a Sentinel agent on egress, and a safety prompt checking sensitive data all run on GPUs too.
5. **A computer stays on for every user.** The VM, the browser and the stored session cost CPU, memory and storage around the clock, separate from GPU cost.
6. **There are no quiet hours.** Chat traffic follows people's days. Background agents work at night as well, so the capacity is never idle and peaks do not flatten out.

Prompt caching lowers the *price* of re-reading the same prefix, but those tokens still pass through a GPU. That is why every lab is reaching for the same levers: smaller models for routine steps (OpenAI's router to Terra), limits on background work (Duet sharing plan limits, Grok's separate weekly allowance), and premium pricing. I covered the wider economics in [why the $20 subscription is a subsidy](/notes/2026-06-01-ai-economics-frontier-inference-costs).

## Can we build one ourselves?

Yes. Most of us already have half of it. A Claude Code or OpenClaw setup with a persona file, memory, MCP connectors and a scheduled `/loop` or cron job *is* a personal agent, just a less polished one. Here is the whole build, sorted by difficulty:

![An agent loop above twelve parts in three columns. Easy: persona, model API, memory, scheduler, connectors. Medium: always-on sandbox, approval channel, audit log. Hard: credential vault, prompt-injection defence, reliable computer use, cost at 24/7. A note says a subscription buys the hard column, the integrations and rationed compute.](/assets/images/personal-agents-diy-blueprint.svg)

**Easy (a few hours, and you probably have it already):** a persona file, a model API, memory (Markdown files, a wiki, or [Postgres behind MCP](/notes/2026-10-14-postgres-mcp-team-agent-memory)), a scheduler, and MCP connectors for mail, calendar and chat. The agent loop itself comes from the Claude Agent SDK, Claude Code in headless mode, or OpenClaw.

**Medium (about a weekend each):** an always-on sandbox (a Docker container or a small cloud VM with a browser inside), an approval channel with buttons in Telegram, Slack or WhatsApp, and an audit log of every action and who approved it.

**Hard (where the labs spent their money):**

- **A credential vault the model cannot read.** Muse and Duet both stress that the agent uses your logins without seeing them. In a home-made setup, the token usually sits in an environment variable the agent could print.
- **Prompt-injection defence with real accounts.** Once your agent reads your email, anyone who emails you can try to give it instructions. That is a problem with a repo; it is a much bigger one with your bank login.
- **Reliable computer use.** Logins, captchas, two-factor prompts and redesigned pages break browser automation all the time.
- **Cost at 24/7.** You pay the same loop the labs pay, at API prices, with no subsidy.

If you build one, these habits keep the bill sane:

1. **Use a small model for the heartbeat.** "Is there anything new that needs me?" does not need a frontier model. Wake the big model only when the answer is yes. This is the same idea as OpenAI's router.
2. **Skip empty heartbeats.** OpenClaw skips the run when `HEARTBEAT.md` is effectively empty, and replies `HEARTBEAT_OK` when nothing needs attention.
3. **Prefer events to polling.** A mail webhook or calendar push notification costs nothing until something happens.
4. **Cap steps and compact the context.** Because cost grows with the square of the steps, a hard step limit and a summary of old history save more than any prompt tweak.
5. **Keep the persona short.** It is loaded on every turn. Rules the model would follow anyway are tokens you pay for forever.
6. **Start read-only.** Let it read and draft before it can send, pay or delete, and widen access only once you trust the loop. The OpenClaw docs give the same advice.

## So, innovation or packaging?

The persona is packaging: a soul.md is a system prompt, and we were already writing those for coding agents. What is new is giving that persona a body: its own computer, a schedule that wakes it, access to your accounts, and a trust layer strong enough that people let it near their email and money. Those parts are mostly engineering rather than research, but they are hard and expensive engineering, and they are exactly what makes the products cost so much to run.

You can build your own, and for a developer it is a good way to learn where the difficult parts are. The reason to pay for one is not the personality. It is the hard column in the last diagram, plus someone else rationing the compute bill.

Sources: [TechCrunch on Gemini Spark](https://techcrunch.com/2026/05/19/google-introduces-gemini-spark-a-24-7-agentic-assistant-with-gmail-integration/), [x.ai: Introducing Grok Bot](https://x.ai/news/introducing-grok-bot), [Startup Fortune on Grok Bot limits](https://startupfortune.com/elon-musk-admits-grok-bot-costs-too-much-to-run-as-users-hit-weekly-caps/), [Meta: Introducing Muse](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/), [Meta: How we designed Muse](http://introducing.muse.ai), [TechCrunch on Dots](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/), [Anthropic: Introducing Claude Duet](https://claude.com/resources/articles/claude-duet), [MacRumors on Claude Duet](https://www.macrumors.com/2026/10/21/anthropic-claude-duet/), [Fortune on compute costs](https://fortune.com/2026/11/03/musk-says-grok-bots-costs-are-unsustainably-high-while-openai-admits-dots-are-compute-heavy-is-the-personal-ai-agent-push-dead-on-arrival/), [OpenClaw docs](https://docs.openclaw.ai/start/openclaw/index.html).
