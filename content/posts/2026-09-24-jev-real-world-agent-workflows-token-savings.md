---
title: "Jev in real agent workflows: decision layers, context compaction, and token savings"
date: 2026-09-24
tags: [ai-agents, jev, system-one-models, llm, context-engineering, token-optimization]
summary: "How Jev-style System One decisions can sit beside frontier LLMs in browser agents, context compaction, support routing, and pre-trade gates, with a careful look at where token savings are real."
series: building-ai-systems
---

The first article on Jev covered the basic boundary: it is a decision layer, not an LLM replacement. The more interesting question is where that boundary changes a real agent workflow.

The answer is not "replace the frontier model." Let the frontier LLM plan, write, interpret ambiguous documents, and speak to people. Use Jev where the system already knows the allowed outcomes and needs a fast answer it can branch on: choose a tool route, score evidence quality, decide whether a trace is still relevant, or send a risky case to review.

That split is starting to show up in open repositories. Browser agents use it to select DOM actions. Coding tools use it to decide which tool results survive compaction. Open-source projects are reproducing the typed-decision interface locally. A trading platform uses it as a pre-trade filter while keeping actual execution policy in code.

## What changes when Jev sits beside a frontier LLM

TypeSafe describes Jev as a System One model: structured state and declared questions go in; typed choices, scores, yes/no decisions, probabilities, and confidence come out. The model is designed for bounded decisions rather than autoregressive text generation.

That is useful only when the workflow has a real action vocabulary. A support system can offer `reply`, `request_evidence`, `freeze_card`, and `human_review`. A browser agent can offer `CLICK`, `TYPE_TEXT`, `SELECT`, `WAIT`, and `DONE`. A compactor can offer `keep`, `truncate`, and `drop`. If the agent needs to invent a remediation plan or explain a policy exception, the LLM still owns that part.

![A frontier LLM handles planning and text generation while Jev selects among declared decisions before code performs a bounded action.](/assets/images/jev-frontier-llm-decision-layer.png)

The implementation rule is simple: code owns deterministic rules and execution, Jev handles a narrow judgment over messy state, and the LLM handles open-ended generation. A valid Jev choice is not automatically a correct business decision. It still needs good state, an appropriate option set, action thresholds, and a human path for uncertainty.

## Why this can improve an agent workflow

Frontier LLMs are very capable, but a lot of agent work is not prose generation. Consider an agent loop after a tool call. It may need to decide:

- Is the result sufficient to continue?
- Which one of 40 visible controls is the intended target?
- Is the evidence strong enough to automate a low-risk step?
- Does this old tool result still belong in context?
- Should this trace be escalated to an operator?

Each question has a bounded output. Asking a chat model to write JSON for every one adds output tokens, parsing, schema recovery, and latency. A Jev-style call can pack independent questions against shared state, return typed decisions together, and give code confidence values to route on.

The gain compounds in a multi-step workflow. If a browser agent takes 15 actions, a small delay or output-generation cost on every decision becomes visible. If a coding agent carries 100 old tool results, retaining an irrelevant 20,000-character log can become more expensive than the original tool call because it is repeatedly sent to the frontier model later.

## Where the token savings are real

"Jev saves tokens" is true only when stated precisely. It does not reduce the source state the system must understand. It changes how much generative output is produced and how much stale context is repeated.

| Saving mechanism | What changes | What does not disappear |
| --- | --- | --- |
| Typed decision instead of JSON/prose | The decision call avoids a generative explanation that code would immediately parse. | The state and decision criteria still need to be sent. |
| Many decisions over shared state | Independent checks can be asked together rather than through separate LLM turns. | More questions still increase request size and evaluation work. |
| Relevance-based compaction | Stale tool results stop being carried into later frontier-LLM turns. | The compactor needs enough historical state to judge relevance safely. |
| LLM only when language is needed | A system can call the LLM to write the customer reply after routing, rather than asking it to route and write. | The final reply still needs an LLM or a fixed template. |

The most practical saving usually appears in the *next* LLM call. A coding agent may use Jev to preserve an exact compiler error, constraint, file path, and recent edits while dropping an obsolete 80-page dependency tree. The expensive model then sees a smaller, higher-signal transcript.

![Jev can decide which tool evidence stays in a transcript before the next frontier LLM turn, reducing repeated context without rewriting essential details.](/assets/images/jev-context-cost-compaction.png)

Do not count this as a free compaction pass. `fast-jev-compaction`, for example, deliberately gives Jev a fitted view of the whole conversation, with large results replaced by short omission notes, before asking it what to keep. That is a sensible trade: spend a cheaper decision request to avoid repeatedly paying a frontier model to read stale history. It only wins when the future reduction is larger than the decision cost and when the retained evidence remains sufficient.

## Real applications already appearing in public repositories

The repositories below are implementation examples, not independent benchmarks. Star counts change quickly; the list uses prominent public projects inspected on 24 September 2026.

| Repository | How it uses a Jev-style decision | Why the pattern is interesting |
| --- | --- | --- |
| [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) | Jev selects the browser operation and compatible DOM target from an indexed observed action space. A smaller LLM generates text only when the operation is `TYPE_TEXT`. | It removes a common agent waste: asking a general model to write a complete tool call when the legal actions and targets are already known. |
| [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | A Claude Code plugin scores tool calls and results as `keep`, truncate, or remove while keeping preserved content verbatim. | It treats compaction as relevance selection, not an LLM summary that may lose an exact error or constraint. |
| [jaredpalmer/kev](https://github.com/jaredpalmer/kev) | An Apache-licensed family of local Jev-like decision models with typed choice, score, and yes/no questions. | It makes the interface testable on local GPUs and Apple Silicon rather than tying the workflow to one hosted model. |
| [TheoLeeCJ/SemIf-OpenJev](https://github.com/TheoLeeCJ/SemIf-OpenJev) | An independent open-model experiment reads typed option logits directly, without sampling an answer string. | It makes the system-level trade-off visible: direct decision readout versus autoregressively generated JSON. |
| [OpenByteInc/QuantDinger](https://github.com/OpenByteInc/QuantDinger) | A structured Jev decision filter evaluates live-entry order context before an entry reaches an exchange. | It shows the right safety boundary: Jev can advise a bounded gate, while execution policy, emergency exits, and fallback behaviour remain in application code. |

### Browser control: choose the action, generate only the text

`browser-use/jev-ultrafast` observes the current page and turns visible controls into an indexed table. Jev chooses an operation and a compatible element target in one request. The text helper is called only when the chosen operation requires text.

That is a clean frontier-LLM split. A flight search does not need an LLM to invent the string `CLICK [7]` if the browser has already observed the allowed buttons. It needs a decision about which observed control matters. It does need generation for an unfamiliar field value, which is why the repository uses a small LLM only for text entry.

The project reports a controlled Google Flights comparison with three matched run pairs: median time fell from 9.450 seconds to 7.092 seconds and median browser protocol calls from 1,092 to 101. It also reports 17 Jev requests and two text-helper calls in the recorded run. Those are useful engineering measurements, but they are three runs of one task on one browser profile, not a general claim about browser-agent reliability or cost.

### Coding-agent compaction: delete stale evidence without inventing a summary

`fast-jev-compaction` tackles a different problem. Long coding sessions accumulate tool output that is both valuable and dangerous: a one-line test failure may matter later, while a giant earlier directory listing usually does not. Standard compaction often asks an LLM to summarize the history, which can discard the one exact path the next agent turn needs.

The plugin pairs each tool call with its result, pins the initial and recent messages, then asks Jev whether the call and its result should remain. A high keep score retains the result verbatim. A middle score retains the call and truncates the result. A low score removes both. It falls back to Claude Code's built-in compaction if Jev fails or the reduction is not worthwhile.

This is a strong use case for a decision layer because the output is not a new explanation. The application wants a bounded relevance judgment. The repository is also candid about the limitation: questions may be batched across multiple Jev requests, each with the fitted state repeated. A long history that barely fits the state limit may not be cheap to compact. Measure end-to-end token cost and the rate at which agents later need a discarded result.

### Local decision models: Kev and SemIf

Kev and SemIf make an important point: the decision-layer idea is broader than one API.

Kev packages small Jev-like models behind a System One-compatible API. Its support-ticket example asks, against one shared text, which department should own the case, whether it needs urgent escalation, and how frustrated the customer is. The response includes probabilities rather than a single opaque route. Kev's repository includes model weights, training code, calibration material, and local serving paths, including Apple Silicon support for selected models.

SemIf, formerly OpenJev, is explicit that it does not reproduce TypeSafe's undisclosed model or training. It explores the interface pattern using open models: define options at runtime and read option logits directly rather than generate JSON. Its owned 4B-model benchmark reports 21 typed binary decisions in 1.023 seconds with zero output tokens, versus 5.332 seconds for a compact generated JSON array on the same RTX 3090 setup. The repository also notes that the two paths agreed on 18 of 21 choices, so this is a systems comparison, not proof of semantic equivalence.

For a team that cannot send private workflow state to a hosted decision service, these projects point to a useful option: run a smaller decision model near the agent and keep the frontier model for the rarer tasks that need deep reasoning or language generation. That option still needs its own accuracy, calibration, latency, and hardware evaluation.

### Pre-trade gating: a useful boundary, not autonomous trading

QuantDinger sends order, strategy, exposure, position, and budget context to Jev before a live entry order. It records the provider, checks, result, confidence, latency, and reason in an audit timeline. Its README says rejected entries do not reach the exchange, while exits, stop-losses, take-profits, and emergency actions bypass the first-version filter. If Jev is unavailable, the project falls back to a configured LLM and otherwise records a fail-open result.

This example matters because it does not hand the model unrestricted control. The model operates inside a narrow gate. The application decides which evidence to supply, what choices exist, what a rejection means, what bypasses are required, and how an outage behaves. A typed decision can make that boundary easier to audit. It cannot make a speculative signal safe or turn an experimental model into investment advice.

## A design pattern for frontier-model agents

Use the LLM to make a proposal and Jev to turn that proposal into a bounded workflow decision. A customer-support agent is a useful example:

```text
1. Code loads account state, policy version, and permitted actions.
2. An LLM drafts a response and identifies possible unresolved facts.
3. Jev answers narrow questions in parallel:
   - Is duplicate billing evidenced?
   - Does the policy permit a refund?
   - Is fraud likely enough to freeze the card?
   - Is the confidence sufficient for low-risk automation?
4. Code applies deterministic rules and routes to refund, evidence request,
   human review, or another approved action.
5. The LLM writes the customer-facing explanation for the selected route.
```

This arrangement improves observability. The decision log can preserve the state version, question definitions, option set, probabilities, confidence threshold, policy version, selected action, and final outcome. When a result is wrong, the team can ask whether the facts were missing, the question was poorly decomposed, the options were incomplete, the threshold was bad, or the model made a poor judgment.

## What will not improve automatically

Jev does not remove the hard parts of agent engineering:

- A poor option set produces a confidently constrained bad outcome. Always include `unknown` or `human_review` when the agent can be outside its policy.
- Calibrated confidence is a claim to test on your own held-out cases, not a reason to automate a high-impact action immediately.
- The decision model can select a valid action for the wrong reason. Keep authoritative state, deterministic eligibility checks, and post-action audits.
- A short decision call does not solve a slow workflow whose real delay is retrieval, database work, browser loading, or a human approval queue.
- If an ordinary rule can decide the case, use ordinary code. A decision model belongs where interpretation is needed but the output space is bounded.

Jev is still early access, and TypeSafe has not published its architecture, weights, training corpus, or a peer-reviewed technical paper. Treat the vendor's latency, calibration, and cost figures as useful hypotheses. Reproduce them against the agent tasks that matter to your business, with the same state builders, confidence thresholds, and human-review criteria you would actually deploy.

## The practical takeaway

The value of a decision layer is not that it makes an agent less intelligent. It stops spending frontier-model generation on work that is structurally a choice, score, or gate.

For a browser agent, that can mean choosing from observed controls and generating text only when needed. For a coding agent, it can mean carrying exact useful evidence forward without replaying every past tool result. For an operational workflow, it can mean a fast, typed decision before code performs a narrow action.

The workflow gets cheaper only when that structure prevents repeated context, unnecessary output, retries, or expensive LLM calls. That is measurable. Start with one decision loop, run it in shadow mode, compare it with the existing LLM path, and retain a rules-based or frontier-model fallback.

## References

- [TypeSafe: Introducing System One Models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe workflow evaluations](https://evals.typesafe.ai/)
- [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast)
- [jev-ultrafast performance methodology](https://github.com/browser-use/jev-ultrafast/blob/main/docs/performance.md)
- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction)
- [jaredpalmer/kev](https://github.com/jaredpalmer/kev)
- [TheoLeeCJ/SemIf-OpenJev](https://github.com/TheoLeeCJ/SemIf-OpenJev)
- [OpenByteInc/QuantDinger](https://github.com/OpenByteInc/QuantDinger)
