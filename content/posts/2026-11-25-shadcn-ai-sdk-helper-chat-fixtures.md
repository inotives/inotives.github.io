---
title: "Designing chat UIs without a model: testing shadcn's AI SDK helper"
date: 2026-11-25
tags: [shadcn-ui, ai-sdk, ui-design, generative-ui, react, testing, ai-engineering, chat-ui]
summary: "shadcn's new @shadcn/helpers/ai-sdk lets you script a conversation in code and stream it through the AI SDK's real useChat hook, with no model, API route or key. I built a trading-desk chat in the playground on it and measured it against Claude Sonnet 5.5 on the same UI. The real model took 1.3–8.6 s to the first token, cost about $0.007 a reload, and gave 20 different answers in 20 calls, whose rendered height varied by up to 1.55×. The scripted chat streamed its first chunk in 2–14 ms, made zero network requests in 60 runs, rendered byte-identical HTML every time, and put all 11 chat states (tool errors, approvals, stream failures) on screen on demand. The token saving is small. The real wins are time, determinism and reaching the states you actually need to design."
---

I use shadcn/ui for most of my UI work, and chat is now in half of it: an agent that answers, calls tools, asks for approval, fails and retries. That kind of UI is awkward to design. The thing that fills it with content is a model: slow, paid for by the token, and different every time.

shadcn shipped a small helper aimed at exactly that: [**AI SDK**](https://ui.shadcn.com/docs/helpers/ai-sdk), in the `@shadcn/helpers` package. I built a [playground mock](/mocks/shadcn-ai-sdk-chat.html) on it, ran it against a real model on the same UI, and measured what changed.

Short version:

1. **It's a fixture, not a generator.** You write a conversation in code. The helper turns it into an AI SDK `ChatTransport`, and the real `useChat` hook streams it. Your components can't tell the difference.
2. **Cost: real, but small.** With a short system prompt and no tools, each reload cost about **$0.007** on Sonnet 5.5, so **$0.69 per 100 reloads**. The scripted chat costs nothing. For one designer, tokens aren't the reason to use it.
3. **Time and determinism are the reasons.** Real: **1.3–8.6 s** to the first token and **20 different answers in 20 calls**. Scripted: first chunk in **2–14 ms**, **zero network requests in 60 runs**, and **byte-identical HTML in every run**.
4. **It reaches the states you need to design.** The scripted chat put all **11** chat states on screen when I asked for them, including tool error, approval, denial and stream failure. The 20 real calls produced **2** of them.
5. **It can hide real variance.** Five real answers to the same prompt rendered **1.44–1.55×** taller in one run than in another. A script has one height. The fix I used: record real answers once and replay them through the helper.

## What it is

![Diagram: your chat UI (message bubbles, reasoning panel, tool cards, approve and deny, sources, error and retry) sits on useChat. In production its transport goes through an API route to a model: in my test 1.3–8.6 s to the first token, about $0.007 and a different answer each reload. For design, demos, docs and CI it gets a createChat script instead: no model, route, network call or key, first chunk in about 2–14 ms, same output every run, any state on demand.](/assets/images/shadcn-ai-sdk-what-it-is.svg)

The docs describe it in one line: it lets you "stream predefined conversations through useChat without a model, API route, network request, or API key". The point is to separate the chat UI from the model and backend, "so you can work on the frontend on its own".

The API is a chain:

```ts
import { createChat } from "@shadcn/helpers/ai-sdk"
import { useChat } from "@ai-sdk/react"
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"

const chat = createChat()
  .user("Buy 2 SOL at market.")
  .assistant(({ writer }) => {
    writer.text("This places a market order, so I need your confirmation first.")
    writer.tool("place_order", {
      input: { side: "buy", symbol: "SOL", qty: 2 },
      needsApproval: true,                       // pauses the turn behind Approve / Deny
      output: { orderId: "ord_7f3a91", filled: 2 },
    })
  })
  .assistant(({ toolCall, writer }) => {          // continuation: runs after the user answers
    writer.text(toolCall.approved ? "Done." : "Cancelled.")
  })

const { messages, sendMessage, addToolApprovalResponse } = useChat({
  messages: chat.get(0),
  transport: chat.transport({ delayMs: 50 }),     // production: new DefaultChatTransport({ api: "/api/chat" })
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
})
```

The writer covers the parts a modern chat UI has to render: `text`, `reasoning`, `tool` (with `.sleep()`, `.output()`, `.error()`, `.denied()`), `sourceUrl`, `file`, `data`, `error` and `sleep`. `chat.next(messages)` gives you the next scripted user message to send. It's version 0.3.0 on npm, needs `ai` 7, and has a sibling helper for TanStack AI.

It doesn't generate UI and it doesn't fake a model's intelligence. It replays exactly what you wrote, at the pace you set.

## The test

**The mock.** [AI SDK chat fixtures](/mocks/shadcn-ai-sdk-chat.html) in the playground is a trading-desk chat built on the real `useChat` (`@ai-sdk/react` 4, `ai` 7, React 19, loaded from esm.sh with no build step). The UI is shadcn/ui recreated in Tailwind. It has five scenarios:

| scenario | what the script does |
|---|---|
| Quote with a tool call | reasoning, a `get_price` tool that takes 700 ms, an answer, two sources |
| Order that needs approval | `place_order` with `needsApproval`, then a continuation turn for Approve or Deny |
| Tool failure, then retry | the first tool call fails with a 429, the agent reasons, retries on a backup feed |
| Stream error mid-answer | half an answer, then `writer.error()`; Retry fails the same way, every time |
| Recorded real answers | 20 real Claude Sonnet 5.5 answers, captured once and replayed through the helper |

The **Script** tab shows the exact code each scenario runs (the page executes that text). The **Stream** tab logs every UI message chunk with its time and counts network requests during the stream. The sidebar keeps a checklist of which chat states you've seen.

**The real-model baseline.** I sent four desk-assistant prompts to Claude Sonnet 5.5, five times each, through `claude -p` with a short custom system prompt, no tools and no MCP servers. I recorded time to first token, total time, tokens, cost and the answer. That's 20 calls costing **$0.14** in total. The [capture script](https://github.com/inotives/inotives.github.io/blob/master/scripts/mocks/shadcn-ai-sdk-chat/capture.mjs) is in the repo, and the answers are bundled with the mock.

**The fixture runs.** Playwright drove the mock in Chrome:

- Six flows (quote, approve, deny, retry, error, recorded), 5 fresh runs each at a 0 ms and a 50 ms transport delay. That's 60 runs, hashing the rendered thread's HTML and a screenshot.
- Each of the 20 recorded answers replayed, measuring how tall it renders.
- A CI-style suite of all six flows with assertions, 3 times.

## Finding 1: the design loop gets faster

![Two lanes. With a real model: edit CSS, send a prompt, wait 1.3–8.6 s (median 4.1 s) for the first token, get a new answer (20 of 20 differed), hunt for error or approval states by luck. Per 100 reloads: $0.69 and about 9 minutes of waiting. With a scripted conversation: edit CSS, press send, first chunk in about 2–14 ms, the same answer (identical HTML 30 of 30), pick any of 11 states. Per 100 reloads: $0 and zero network requests.](/assets/images/shadcn-ai-sdk-design-loop.svg)

![Log-scale dot plot. Real first token: 1.3–8.6 s. Real full answer: 3.3–8.7 s. Scripted first chunk: 1.6–13.7 ms. Scripted turn done with delays off: 21 ms to 1.1 s, the longest set by scripted tool sleeps. Scripted turn done at the default 50 ms pacing: 0.36–17.4 s; the long recorded answer took 17.4 s, slower than the real model.](/assets/images/shadcn-ai-sdk-latency.svg)

| | real model (20 calls) | scripted (60 runs) |
|---|---|---|
| time to first token or chunk | 1.3–8.6 s, median 4.1 s | 1.6–13.7 ms |
| full answer | 3.3–8.7 s | depends on the script: 21 ms–1.1 s with delays off |
| network requests during the stream | at least 1 per turn, to the model | **0** in all 60 runs |
| cost per reload | ~$0.0069 (1.7k input + ~500 output tokens) | $0 |
| identical output across runs | 0 of 20 (every answer unique) | **30 of 30** (byte-identical thread HTML) |

When you're tweaking spacing on a tool card, a 4-second wait every reload adds up. 100 reloads is about nine minutes of watching a spinner, plus $0.69. That's small money, but it's a real tax on the loop.

**Watch the pacing default.** The helper streams text word by word, 50 ms apart by default. On my longest recorded answer (2,092 characters) that took **17.4 s**, twice as long as the model that wrote it (8.5 s). The fixture's speed is a setting, not a simulation of the model. Set `delayMs` to match what you measured, use `mode: "instant"`, or use 0 in tests.

## Finding 2: you can design the states that matter

![Checklist of 11 chat states. Scripted: all 11 reached on demand in one Playwright session. Real model, 20 baseline calls with no tools: 2 of 11, streaming text and a long answer with a table.](/assets/images/shadcn-ai-sdk-coverage.svg)

This is the biggest change for UI work. The parts of an agent chat that need the most design care are the rare ones: a tool that fails, an order waiting for approval, a denial, a stream that dies halfway, a retry. With a real model you get them by luck or by building fault injection into your backend. With a script they're a few lines each. One Playwright session reached all 11 states the mock's components handle.

My 20 real calls reached 2 of them. That's partly unfair, since the baseline had no tools. A real tool backend would reach more of them, but you still wouldn't get a 429 or a 504 when you wanted one.

## Finding 3: real answers vary, and a script hides that

![Dot plot of the assistant message's height for five recorded real answers per prompt: SOL price 331–513 px (1.55×), buy 2 SOL 286–413 px (1.44×), compare table 623–917 px (1.47×), funding rates 290–420 px (1.45×).](/assets/images/shadcn-ai-sdk-layout-variance.svg)

Same prompt, same model, five runs: the answer's rendered height varied by **1.44–1.55×** on every prompt. The comparison table ranged from 623 to 917 px. A hand-written script tends to be the tidy, average-length answer you imagined, so a layout designed only against it hasn't met a real long answer.

What worked for me was the mock's **Recorded real answers** scenario: call the real model a handful of times, save the answers, and replay them through the same helper. Recording and replaying is one line, `createChat().user(prompt).assistant(recorded.text)`. You get real content variety with fixture determinism, and you only pay for the model calls once.

## Finding 4: determinism makes automated checks work

The CI-style suite ran all six flows with assertions (sources visible, order filled, order cancelled, retry succeeded, error shown, recorded answer rendered). With delays off it took **6.7–7.0 s** including fresh page loads, and **3.7 s** back-to-back on one page. It passed 3 out of 3 times. A real-model version would need a key in CI, cost a few cents a run, wait 4 s or more per turn, and assert against text that changes every run.

One caveat: **identical HTML isn't always identical pixels.** The thread's HTML matched in 30 of 30 runs. Screenshots matched in 3 of 6 flows on the first pass. After waiting for `document.fonts.ready`, two more flows became pixel-identical, but the retry flow still flipped between two pixel variants with the same DOM. Visual regression tests on a fixture still need to wait for fonts and allow a small tolerance.

This matters more now that agents write a lot of UI code. I built and checked this mock with Claude Code driving Playwright: send, wait for `data-status="ready"`, hash the DOM, compare. That only works because the stream is deterministic. An agent can't verify a chat UI against a model whose answer changes every run, but it can against a script.

## Gotchas I hit

- **`writer.tool(name, options)`: the input goes inside the options.** I first wrote `writer.tool("place_order", { side: "buy" }, { needsApproval: true })`. It didn't throw. It ignored my input, and the approval never appeared. The signature is `writer.tool(name, { input, output, needsApproval })`.
- **Loading from a CDN without a bundler:** esm.sh resolved `ai`'s `zod` dependency to a build that broke the import (`does not provide an export named 'safeParseAsync'`). Pinning `zod@3.25.76` in each import's `deps`, which is inside `ai`'s supported range, fixed it. With a normal bundler you won't hit this.
- **Continuations:** after `needsApproval`, add a continuation `.assistant(({ toolCall }) => …)`, and set `sendAutomaticallyWhen` on `useChat`. Without them the chat just stops after Approve. The helper warns about the missing continuation in development.
- **Errors are deterministic too.** `writer.error()` puts `useChat` into its `error` status, and `regenerate()` replays the same failure. That's good for designing a Retry button. It's useless for testing that retrying actually recovers, so script a second scenario for the recovery.

## Does it help UI design?

**Yes, for the parts of chat UI that are hard to reach.** That means tool cards in every state, approvals, failures, sources and long tables. You can design them in seconds instead of waiting on a model, show them in demos that look the same every time, document them, and test them in CI with no key. In an AI-heavy workflow the biggest gain is determinism, because it lets an agent or a test check the UI automatically.

**It doesn't replace the model.** It can't tell you whether answers are good, how long they really run, or how the UI feels when the first token takes 6 s. Recorded real answers, and an occasional session against the real model with realistic `delayMs` and `sleep` values, cover that.

**On cost:** the token saving is real but small for one person: $0.69 per 100 reloads with a short prompt. It grows with long system prompts, tools, a team, and tests on every push. The bigger cost it removes is the time spent waiting, and the time spent trying to make an error happen so you can style it.

## References

- shadcn/ui: [AI SDK helper](https://ui.shadcn.com/docs/helpers/ai-sdk) (`@shadcn/helpers` 0.3.0) and its sibling [TanStack AI helper](https://ui.shadcn.com/docs/helpers/tanstack-ai)
- AI SDK: [useChat reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- Playground: [AI SDK chat fixtures](/mocks/shadcn-ai-sdk-chat.html). The capture script is `scripts/mocks/shadcn-ai-sdk-chat/capture.mjs`, and the recorded answers are in `public/mocks/data/shadcn-ai-sdk-chat.json`.
