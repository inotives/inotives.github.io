---
title: "Designing against cognitive surrender: mirrors, not willpower"
date: 2026-11-09
tags: [cognitive-surrender, cognitive-debt, ai-agents, critical-thinking, agentic-coding, engineering-practice, research]
summary: "A follow-up to the cognitive surrender note, covering what the research added this year. AI advice nearly wipes out people's willingness to say 'I don't know' while doubling their confidence. Students now spend about a quarter less time on maths problems that AI can solve, and remember less. The heaviest AI users deliberately work without it. The most useful finding is that a short 'here is how you used the assistant' feedback message reduced offloading and improved test scores, while paying people for effort did nothing. So the fix is a mirror built into the workflow, not more willpower."
---

Three days ago I wrote about [cognitive surrender](/notes/2026-11-06-cognitive-surrender): the point where an agent's answer quietly becomes yours without you ever forming a view of your own. That note was mostly Addy Osmani's framing plus a long list of habits for staying in the loop.

A list of habits has an obvious weakness. It relies on willpower, and willpower is exactly what runs out late in a long agent session. So I went looking for what else has been published on this since then, especially anything that tests *what actually works*. There is more than I expected, and one result changes how I think about the fix.

Short version:

1. **Surrender feels fine for ordinary reasons**, so you will not notice it from the inside.
2. **AI advice crowds out "I don't know"**: people answer more, are right far less often, and feel more confident.
3. **Learning time is already shrinking** where AI can do the work, and so is what people remember.
4. **The heaviest AI users protect their own thinking on purpose.**
5. **A mirror beats a carrot**: showing people how they used the assistant worked, rewarding effort did not.

## 1. Why surrender feels alright

![Three ordinary tendencies pull toward accepting the first AI answer: the need for closure, a confident tone that reads as a cue to accept, and the fact that hard thinking is unpleasant while approving is cheap. On the right, counter-moves: ask for the other side, read the sources, treat confidence like a sales pitch, practise hard thinking on purpose, and tell the AI to help you not surrender.](/assets/images/cognitive-surrender-2-why-it-feels-alright.svg)

Psychologist Patrick Gallagher published [Why Cognitive Surrender Feels Alright](https://www.psychologytoday.com/us/blog/behavioral-science-irl/202611/why-cognitive-surrender-feels-alright) in Psychology Today on 9 November. It explains the part of my last note I only described: *why* the slide from offloading to surrender is so smooth.

He points to three tendencies we all have:

- **Need for closure.** Not knowing is uncomfortable. An answer ends that discomfort, and in the moment it hardly matters whether the answer is right.
- **Confident tone.** We read fluent, certain language as a sign that something is true. AI is always fluent and usually certain. As he puts it, "most AIs are trained to deliver what users most like, not necessarily what's most accurate."
- **Thinking is effortful.** Hard thinking is genuinely unpleasant, and approving is cheap.

None of these is a character flaw. That is the point: surrender is the default outcome of normal psychology meeting a fluent machine. His counter-moves overlap with Osmani's: do not take the first answer, ask for the other side and the sources (and read them), treat AI confidence like a salesperson's pitch, keep doing hard thinking on purpose, and tell the AI outright to help you avoid surrender.

## 2. AI advice crowds out "I don't know"

![Indexed bar chart, no-AI condition equals 100. With wrong AI advice available, willingness to say "I don't know" was nearly eliminated, correct answers fell to about a third, and confidence nearly doubled.](/assets/images/cognitive-surrender-2-i-dont-know.svg)

The Wharton study behind the term showed people accepting wrong AI answers. A July paper by Marcoccia, Quattrociocchi and Capraro, [AI advice suppresses people's willingness to say "I don't know"](https://arxiv.org/abs/2607.13562), tests something more subtle: what happens to your ability to *not answer*.

Across five experiments with 3,132 participants, people answered hard questions and could always decline. The AI advice was designed to be wrong. The result, from the abstract: **"Merely having access to AI nearly eliminated participants' willingness to suspend judgment."** People answered more questions, were correct about a third as often as without AI, and their confidence nearly doubled. That held whether they asked for the advice or it was just shown to them. Paying for accuracy and penalising errors helped a little, but abstention stayed far below the no-AI level.

This matters for engineering more than it first looks. Much of good engineering judgment is saying "I don't know yet": I don't know why this test is flaky, I don't know if this migration is safe, I don't know what this field means downstream. An agent always has an answer. If its presence quietly removes "I don't know" from your vocabulary, you lose the habit that triggers investigation.

## 3. Faster completion, less learning

The Anthropic study I cited last time (17% lower comprehension scores when learning a library with AI-generated code) was a small, controlled experiment. A May paper, [Faster Completion, Less Learning](https://arxiv.org/abs/2605.21629), looks at the same effect at a very different scale: millions of student interactions on the ALEKS maths platform from 2015 to 2025.

The authors compare problems AI can easily solve (text word problems) with ones it struggles with (graphs and plots), before and after ChatGPT's release. On the AI-susceptible problems, **college students' time spent fell 2.8% per quarter, or 26.9% over eleven quarters**, and high schoolers' fell 31.3%. When tests were proctored the speed-up disappeared entirely, which suggests the time saved was AI doing the work. On proctored, randomly assigned retention questions, **the odds of a correct answer were about 25% lower.**

Two caveats: it is observational rather than a randomised trial, and four of the five authors work at McGraw Hill, which runs ALEKS. Still, the direction matches every other study: when AI does the step, you finish faster and keep less. In a codebase, "keep less" is the comprehension debt from my last note.

A related April study by Muhammad Ovais Ahmad, [Comprehension Debt in GenAI-Assisted Software Engineering Projects](https://arxiv.org/abs/2604.13277), read 621 reflective diaries from 207 students on an eight-week software project. It names four ways comprehension debt builds up: **black-box acceptance of AI code, context mismatch, dependency-induced atrophy and verification bypass**. It also names one pattern that worked the other way: **using the AI as a comprehension scaffold**, to understand code rather than to replace understanding it. The author's point that this debt "resides in the collective cognition of development teams rather than in the codebase itself" is a useful reminder: you cannot lint for it.

## 4. The heaviest AI users protect their own thinking

![From Microsoft's 2026 Work Trend Index. Frontier Professionals are more likely to intentionally do some work without AI, 43 percent versus 30 percent, and to pause before starting to decide what AI should do versus a human, 53 percent versus 33 percent. Quality control of AI output and critical thinking were ranked the top human skills, at 50 and 46 percent.](/assets/images/cognitive-surrender-2-frontier-habits.svg)

You could read all this as a case for using AI less. Microsoft's [2026 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/agents-human-agency-and-the-opportunity-for-every-organization), a survey of 20,000 AI users in 10 countries, points the other way. Its "Frontier Professionals", the most advanced 16% of users, are the people who get the most from AI. They are also the most protective of their own thinking:

- **43% intentionally do some work without AI to keep their skills sharp**, against 30% of other users.
- **53% pause before starting work to decide what AI should do and what a human should do**, against 33%.

Asked which human skills matter more as AI takes on more work, respondents put **quality control of AI output (50%)** and **critical thinking (46%)** first and second. The report's summary: "Frontier Professionals refuse to outsource their thinking."

These are self-reported associations, not causal findings. But it is a nice counter to the idea that caring about surrender means being an AI sceptic. The people furthest ahead treat their own judgment as something to maintain, the same way they maintain their tools.

## 5. A mirror beats a carrot

![Results from a preregistered experiment with 704 participants. Share of learning items where people asked for the full answer: AI only 18 percent, feedback 13 percent, reward 15 percent, both 10 percent. Unaided test score: no AI 65 percent, AI only 62 percent, feedback 67 percent, reward 58 percent, both 64 percent.](/assets/images/cognitive-surrender-2-mirror-vs-carrot.svg)

This is the result I found most useful. In September, a team at LMU Munich published [Designing Against Deskilling](https://arxiv.org/abs/2609.20143), a preregistered experiment with 704 people learning fraction arithmetic alongside an LLM assistant. The assistant gave hints freely, but complete answers only when asked. The researchers tested two ways of discouraging people from just asking for the answer:

- **Metacognitive feedback.** After each problem, a short message described *how* the person had used the assistant, what that meant for their practice, and a prompt to check their own understanding. Essentially a mirror.
- **Effort-based reward.** Points for solving without help (10), fewer for an intermediate result (5), almost none for asking for the full answer (1). A carrot.

The mirror worked. **Feedback cut the odds of answer-offloading roughly in half (OR = 0.47) and raised the odds of a correct answer on the later unaided test by about half (OR = 1.51).** People with feedback actually scored higher than the group with no AI at all (67% vs 65%). The carrot did not: the authors found "no evidence that the reward affected either outcome". The rewarded group even scored lowest on the test.

The design lessons the authors draw are worth copying directly:

1. **Show people the consequences of how they are using the tool, by default.**
2. **Make offloading deliberate**: guidance first, the full solution only on request.
3. **Scaffold engagement** ("check my attempt", "explain this step") rather than penalising help.

Caveats: it is maths, not software; the test came right after learning, so we do not know whether the gains last; and the points were symbolic. Still, it is the first controlled evidence I have seen that a cheap, automatic design change shifts behaviour, and that the obvious alternative of incentives may not.

## What I am changing: build the mirror into the loop

![Five steps around each delegated task: predict, guidance first, allow I don't know, evidence first, and the mirror, which reports what you accepted unchecked, what was not verified, and which decisions the agent made for you. An arrow loops back to the next prediction.](/assets/images/cognitive-surrender-2-mirror-loop.svg)

Put together, the new research reframes my last note. The "Five questions to ask yourself" list is still right, but it is a willpower tool, and willpower is exactly what Gallagher's three tendencies wear down. The LMU result says the stronger move is to **make the environment reflect your behaviour back to you automatically**.

With coding agents this is easy, because the agent can be the mirror. These are the changes I am making to my own setup:

**1. Ask the agent to report how I used it, not just what it did.** Agent summaries describe the work. I want a second section describing my part. Something like this in a project's `CLAUDE.md` (or `AGENTS.md`):

```markdown
## End-of-task report
After the summary of what you changed, add a short "Your part" section:
- Decisions I made for you: defaults, names, timeouts, error handling,
  anything you did not specify.
- Not verified: claims in this summary that no test, log or command
  output actually confirms.
- Accepted without discussion: suggestions you approved without
  asking a question or changing them.
Keep each list to three items or fewer. If a list is empty, say so.
```

The third list is the uncomfortable one. If it grows over a session, that is the slide from offloading to deferral, made visible.

**2. Make "I don't know" normal on both sides.** The Marcoccia result shows AI pushes us away from abstaining. So I give the agent explicit permission to say "unknown, here is how to find out" rather than guess, and I hold myself to the same rule. When I catch myself about to approve something I could not explain, "I don't know yet" goes into the PR description instead.

**3. Guidance first when I am learning.** On a codebase or library I want to understand, I ask for a plan, a hint or a review of my own attempt before asking for the code. This is the comprehension scaffold pattern from Ahmad's study and the "explain before generate" finding from Anthropic's.

**4. Evidence before the summary.** This one was already in my last note. It stays, because a summary is the most fluent and confident text the agent produces, which makes it exactly what Gallagher warns about.

**5. Pause before I start.** Like the Frontier Professionals, I take thirty seconds at the start of a task to decide which parts are offloading (fine to hand over), and which parts I need to understand afterwards. In my [trinary agents](/notes/2026-10-20-from-agent-rig-to-trinary-agents) setup, that is the natural place for it: the PM step already writes intent down, so it can also mark which tasks are "understand" and which are "delegate".

What I am *not* doing is setting up rewards or scorekeeping for myself, like streaks of agent-free days. The LMU result is one study in one domain, but it agrees with experience: incentives you set yourself are easy to game and quick to abandon. A mirror just keeps showing up.

## Closing thought

The first note asked whether you can still tell offloading from surrender. The research since then gives a clearer answer: from the inside, mostly you cannot. Closure feels good, confidence is contagious, and the "I don't know" that would have sent you investigating quietly disappears. So rather than relying on noticing in the moment, put a mirror where you will see it every time. The agent is very good at reporting on its own work. It can report on how you used it too.

## Sources

- Patrick Gallagher, [Why Cognitive Surrender Feels Alright](https://www.psychologytoday.com/us/blog/behavioral-science-irl/202611/why-cognitive-surrender-feels-alright), Psychology Today (9 November 2026)
- Chiara Marcoccia, Walter Quattrociocchi and Valerio Capraro, [AI advice suppresses people's willingness to say "I don't know", even when the advice is wrong and accuracy is incentivized](https://arxiv.org/abs/2607.13562), arXiv (July 2026)
- Sina Rismanchian et al., [Faster Completion, Less Learning: Generative AI Reduced Study Time on Math Problems and the Knowledge They Build](https://arxiv.org/abs/2605.21629), arXiv (May 2026, revised July 2026)
- Muhammad Ovais Ahmad, [Comprehension Debt in GenAI-Assisted Software Engineering Projects](https://arxiv.org/abs/2604.13277), EASE 2026 Companion (April 2026)
- Microsoft, [2026 Work Trend Index: Agents, human agency, and opportunity](https://www.microsoft.com/en-us/worklab/work-trend-index/agents-human-agency-and-the-opportunity-for-every-organization) (May 2026)
- Sebastian Maier, Kai Schwabe, Manuel Schneider and Stefan Feuerriegel, [Designing Against Deskilling: Metacognitive Feedback Reduces Cognitive Offloading to LLM Assistants](https://arxiv.org/abs/2609.20143), arXiv (September 2026)
- Previous note: [Cognitive surrender: when the agent's answer quietly becomes yours](/notes/2026-11-06-cognitive-surrender)
