---
title: "Why banks are taking AI coding tools away from traders"
date: 2026-11-05
tags: [ai-coding, ai-governance, risk-management, vibe-coding, banking, claude-code]
summary: "In October 2026 Goldman Sachs limited Claude Code and GitHub's coding tools to engineers and strats, months after its CIO praised vibe coding by non-technical staff. Goldman only cited productivity and risk management. This note works through the risks behind that wording: untested tools nobody owns, client data in prompts, and juniors who stop learning to reason. It also covers why the line falls at engineering, and why that line is about process more than people."
---

In July, Goldman Sachs CIO Marco Argenti was talking up "vibe coding" by non-technical staff. The idea was simple: a trader or someone in asset management has an idea, builds a rough prototype with AI, and hands it to an engineer to make it production grade.

By October the internal guidance had changed. According to [Bloomberg's report on 2 November](https://www.bloomberg.com/news/articles/2026-11-02/goldman-restricts-traders-and-bankers-from-using-some-ai-tools), Anthropic's Claude Code and Microsoft's GitHub coding tools are now limited to engineers. About 12,000 engineers keep access, and so do the "strats", Goldman's hybrid roles that already mix trading, quant research and code. Traders and bankers, who had spent months using the tools to monitor client trading flows, model positions and produce written and graphic content, lost them. The firm's broader multi-model assistant is still available to everyone.

Goldman's spokesperson gave a short reason: "a variety of factors including productivity and risk management". The experiment phase was over, and the tools would stay with the people "best suited to leverage them for the long term".

That wording is short on detail. Goldman has not said publicly how many tools were built, what broke, or which data worried them. What follows is my reading of the risks a bank's control functions would weigh, not something Goldman has confirmed. The risks are not new, though. Banks have been fighting the same problem with spreadsheets for twenty years.

## The spreadsheet problem, with a faster engine

Banks have a name for software that business staff build themselves: end-user computing, or EUC. Excel models, Access databases, VBA macros. Control functions keep inventories of them because they keep causing losses.

The best-known case is JPMorgan's London Whale in 2012. The new VaR model for the synthetic credit book was computed on spreadsheets, with data uploaded by hand. JPMorgan's own task force later called the process "error prone", and the SEC settlement pointed to "spreadsheet miscalculations that caused large valuation errors". The model understated risk while the positions grew, and the losses reached about $6.2 billion.

AI coding tools take that pattern and speed it up. A trader who once spent two weekends on a VBA macro can now produce a working Python script before lunch. One person turning out a dozen tools a month means a much larger inventory to control, and the controls haven't sped up.

## Who owns the tool when the market moves?

Software inside a bank goes through a path before anyone relies on it: code review, testing, change control, a named owner, monitoring, and a record of what changed and when. For anything that counts as a model, US banks also follow model risk guidance from the Fed, OCC and FDIC. Since April 2026 that is [SR 26-2](https://www.federalreserve.gov/supervisionreg/srletters/sr2602.htm), which replaced the long-standing SR 11-7, and it expects models to be validated and monitored after they go live.

A vibe-coded tool skips all of that by default. Picture a few common cases:

- A sales trader builds a script that flags unusual client flow. It works well for six months. Then a data feed changes a field name, the script silently returns nothing, and the desk reads "nothing" as "no unusual flow".
- An operations analyst writes a reconciliation helper that hard-codes a holiday calendar. The tool still runs next year. The calendar is out of date.
- The analyst who built it moves to another desk. Nobody else knows the tool exists, but the morning process now depends on it.

None of these needs bad code. They come from the assumptions built into the code, made by someone who never had to think about how the tool would fail, and from the lack of an owner who notices when those assumptions stop being true. Engineering teams learn this the hard way and put process around it. A trader's laptop has none of that.

There is also an audit question. When a regulator asks how a number in a client report or a risk limit was produced, "a script someone on the desk generated with Claude" is a hard answer to defend.

## Client data in the prompt

The second risk is about what goes into the tool, not what comes out. Coding assistants work best with context. A trader debugging a flow monitor will paste in real trade data, client names, positions and the desk's internal logic, because that is what makes the answer useful.

In a bank, much of that is material non-public information or client confidential. Enterprise contracts with AI providers usually cover retention and training, but the contract terms still decide where data may go and who may see it. Goldman had already shown how strictly it reads those terms: in April it restricted Claude for Hong Kong staff, which Bloomberg reported came from a strict reading of its contract with Anthropic.

Coding agents add another path. They don't only answer questions; they read files, run commands and call APIs. An agent with a trader's credentials can reach whatever the trader can reach. That is a larger and harder surface to watch than a chat window.

## Juniors who stop learning to reason

The third concern is slower and harder to measure. In August, before the restriction, Chris Churchman, head of Goldman's Marquee platform, warned about it on the firm's Exchanges podcast, as [reported by CNBC](https://www.cyberdaily.au/security/14096-goldman-sachs-partner-warns-that-ai-could-erode-bankers-reasoning-skills):

> "There's a huge danger here that in the era of AI, we outsource our reasoning to these models, and we have cognitive atrophy that stops us [from] being able to reason from first principles ourselves."

His example was junior traders who learn by pricing client requests under a senior risk manager. "We can absolutely automate that," he said, "but then do we get the senior traders that fully understand?" A lot of trading knowledge, he added, "is tacit, it was never written down."

Churchman's remarks weren't about the coding-tool rollback, and Goldman hasn't linked the two. But they point the same way. A junior who has an agent write the pricing check never builds the intuition for when the price is wrong, and in five years that junior is the senior supposed to catch the model when it's confidently wrong.

## Why engineers keep access

Goldman kept the tools for engineers and strats. It's tempting to say engineers understand the danger and know what they're doing, and that is part of it. An engineer has usually been on call for something that broke at 3am, and that changes how you write code.

But knowledge alone isn't the reason. Engineers leak data too: in 2023 Samsung engineers pasted internal source code into ChatGPT, and Samsung banned generative AI tools on company devices soon after. The bigger difference is the system around the engineer:

- **Version control.** Every change is recorded and can be rolled back.
- **Code review.** A second person reads the change before it ships.
- **Tests and CI.** The code has to pass checks before it reaches production.
- **Deployment and access control.** Code runs in managed environments with scoped credentials, not on a laptop with the user's full access.
- **Ownership and monitoring.** A team owns the service, gets paged when it fails, and has a runbook.

AI-generated code from an engineer goes through all of that. AI-generated code from a trader goes straight to use. So the rule isn't really "engineers are trustworthy and traders aren't". It's "this code enters a controlled path, and that code doesn't". Strats fit the same logic: they sit inside a desk but already work in code under engineering practices.

## What I think comes next

I doubt this is the end of AI-built tools on the desk. The demand is real, and the productivity is real. The likely outcome is the same one banks reached with spreadsheets and low-code platforms: a sanctioned path.

That probably looks like:

1. Business staff can still prototype, but in a sandbox with synthetic or masked data.
2. Anything used for a real decision gets registered, with a named owner, and goes through a light review.
3. Tools that prove their value get handed to engineering to rebuild properly, which was Argenti's original July pitch.
4. Training for juniors keeps some work manual on purpose, so they still build the judgment to check the machine.

The tools themselves weren't the problem. A whole layer of non-engineers became software authors in a few months, outside the processes that make software safe to rely on. Goldman chose to pull back while it works out how to bring that work inside them. I expect other banks to follow, and the ones that get it right will be the ones that build the path, not just the ban.

## References

- [Goldman restricts traders and bankers from using some AI tools](https://www.bloomberg.com/news/articles/2026-11-02/goldman-restricts-traders-and-bankers-from-using-some-ai-tools) (Bloomberg, 2 Nov 2026)
- [Goldman Sachs pulls AI coding tools from traders and bankers](https://the-decoder.com/goldman-sachs-pulls-ai-coding-tools-from-traders-and-bankers/) (The Decoder)
- [Goldman Sachs pulls Claude Code and GitHub tools from traders and bankers](https://startupfortune.com/goldman-sachs-pulls-claude-code-and-github-tools-from-traders-and-bankers/) (Startup Fortune)
- [Governing AI coding assistants in investment banks](https://joseluischavezcalva.substack.com/p/governing-ai-coding-assistants-in) (Jose Luis Chavez Calva)
- [Goldman Sachs partner warns that AI could erode bankers' reasoning skills](https://www.cyberdaily.au/security/14096-goldman-sachs-partner-warns-that-ai-could-erode-bankers-reasoning-skills) (Cyber Daily, citing CNBC)
- [SR 26-2: Revised guidance on model risk management](https://www.federalreserve.gov/supervisionreg/srletters/sr2602.htm) (Federal Reserve, April 2026)
- [Report of JPMorgan Chase & Co. Management Task Force regarding 2012 CIO losses](https://web.archive.org/web/20140319134801/http://files.shareholder.com/downloads/ONE/2272984969x0x628656/4cb574a0-0bf5-4728-9582-625e4519b5ab/Task_Force_Report.pdf) (JPMorgan, January 2013, archived copy)
- [2012 JPMorgan Chase trading loss](https://en.wikipedia.org/wiki/2012_JPMorgan_Chase_trading_loss) (Wikipedia)
- [Samsung bans use of generative AI tools after ChatGPT data leak](https://www.bloomberg.com/news/articles/2023-05-02/samsung-bans-chatgpt-and-other-generative-ai-use-by-staff-after-leak) (Bloomberg, 2023)
