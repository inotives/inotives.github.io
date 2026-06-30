---
title: "Before You Deploy AI, Consolidate Your Data"
date: 2026-06-30
tags: [enterprise-ai, data-consolidation, data-modeling, financial-services]
summary: "Enterprise AI fails not because the models are bad, but because the data is scattered. In financial services, customer data lives in CRM, KYC systems, exchange feeds, and blockchain analytics tools that do not talk to each other. Consolidating this data is the first real step before AI can do anything useful."
---

Everyone wants to deploy AI. Nobody wants to clean up the data first.

This is the core problem in enterprise AI adoption right now. The technology works. The models are capable. But the data they need to operate on is scattered across a dozen systems, each with its own format, schema, and update schedule. An AI agent cannot make sense of a customer if that customer's information lives in Salesforce, dotFile, Fireblocks, Chainalysis, and your internal trading database, and none of them share a common identifier.

I have worked at a firm where this was exactly the situation. Customer data sat in CRM and KYC systems. Crypto exchange data (orderbooks, OHLCV, trades) came through different APIs. Wallet and on-chain KYT data lived in Fireblocks, Chainalysis, Elliptic, SumSub, and Notabene. Each system had partial information. None of them agreed on what a "customer" even meant. Bringing AI into this environment without first consolidating the data would have been like asking a doctor to diagnose a patient without access to their medical history.

## The real barrier to enterprise AI

McKinsey's 2025 State of AI report found that only 1% of companies consider their AI adoption mature. Gartner predicts that by 2026, 60% of AI projects will fail not because of model quality but because of data readiness issues.

The Harvard Business Review described the challenge bluntly: organizations that succeed with AI do not start with the technology. They start with the data infrastructure. The firms that rush to deploy AI without fixing their data end up with expensive chatbots that hallucinate answers because they cannot find the right information.

This is not a technology problem. It is a data plumbing problem. And plumbing is unglamorous work, which is why most companies skip it.

## What data fragmentation actually looks like

In financial services, the problem is particularly severe. A single customer might have data spread across seven or more systems:

**CRM and KYC:** Salesforce holds the relationship history. dotFile stores onboarding documents and compliance records. These two systems often have different customer IDs and overlapping but inconsistent contact information.

**Crypto exchange data:** Orderbook snapshots, OHLCV candles, and individual trade records come from multiple exchanges through different APIs. Each exchange formats timestamps differently, uses different asset naming conventions, and delivers data at different intervals.

**Wallet and on-chain KYT:** Fireblocks manages wallet operations. Chainalysis, Elliptic, and other KYT providers flag transactions for compliance. SumSub handles identity verification. Notabene manages travel rule compliance. Each of these systems has its own entity graph, its own risk scoring methodology, and its own way of linking wallets to real-world identities.

**Regulatory feeds:** Different jurisdictions require different reporting formats. MiFID II, EMIR, and local regulations each demand specific data fields that may or may not map cleanly to internal data models.

The result is a web of partial views. No single system has the complete picture. An AI agent trying to assess customer risk, detect fraud, or generate a compliance report would need to query all of these systems, reconcile conflicting information, and somehow produce a coherent answer. Without consolidation, this is impossible.

## Why AI cannot work around fragmented data

Some argue that modern AI models can handle messy data. Large language models can extract meaning from unstructured text. They can reason across multiple data sources. They can learn relationships without explicit schema mapping.

This is technically true and practically insufficient.

An LLM can read a customer's name from a Salesforce record and a risk score from Chainalysis. But it cannot know that these two records refer to the same person unless someone has built that link. It cannot know that the wallet address in Fireblocks matches the one flagged by Elliptic unless the systems share identifiers. It cannot reconcile a trade timestamp from Binance (UTC+0) with a KYC record timestamp from SumSub (local timezone) unless someone has normalized the data.

The model is only as good as the connections between data points. Those connections do not exist until someone builds them.

## What data consolidation actually requires

Data consolidation is not a single step. It is a sequence of operations that must happen before AI can function.

**Step 1: Inventory the data sources.** Map every system that holds customer information. For each system, document what data it stores, what format it uses, how often it updates, and what identifiers it uses to reference entities. This sounds basic. Most firms have never done it comprehensively.

**Step 2: Establish a canonical data model.** Define what a "customer" means across the organization. This is harder than it sounds. CRM might define a customer as anyone with an open deal. KYC defines a customer as anyone who has passed identity verification. Compliance defines a customer as anyone who has made a transaction. These definitions overlap but do not match.

**Step 3: Build identity resolution.** Create a mapping between customer identifiers across systems. Salesforce account ID to dotFile entity ID to Fireblocks vault ID to Chainalysis entity ID. This is the connective tissue that lets an AI agent pull a complete picture from scattered sources.

**Step 4: Normalize the data.** Align formats, timestamps, asset naming, and risk scoring methodologies. Convert everything to a common representation. This is tedious, error-prone, and absolutely necessary.

**Step 5: Establish synchronization.** Determine how often each data source updates and build pipelines that keep the consolidated view current. Stale data is worse than no data because AI will confidently act on outdated information.

## A concrete example

Here is what this looks like in practice. A compliance analyst at a crypto firm needs to investigate a suspicious transaction. Without data consolidation:

1. Open Fireblocks to see the wallet transaction history
2. Open Chainalysis to check the counterparty risk score
3. Open the trading database to see related exchange activity
4. Open Salesforce to check the customer relationship context
5. Open dotFile to review the KYC documentation
6. Cross-reference timestamps and addresses manually
7. Synthesize findings into a report

This process takes hours. The analyst is doing data integration work that should have been done before the investigation started.

With data consolidation:

1. Open a single dashboard that shows the consolidated customer view
2. See the wallet activity, risk scores, exchange history, relationship context, and KYC documents in one place
3. Investigate and report in minutes

The difference is not AI. The difference is that the data was already connected before the analyst needed it.

## Business logic conversion

Even after data is consolidated, there is another layer of work: converting business logic into AI-understandable workflows.

Business rules in financial services are often implicit. A compliance officer knows that certain transaction patterns require escalation, but that knowledge lives in their head, not in a documented rule set. An experienced trader knows that specific market conditions warrant specific position adjustments, but the reasoning is not written down anywhere.

Converting this tacit knowledge into explicit, machine-readable rules is a separate and equally important task. It requires working with domain experts to extract decision trees, define boundary conditions, and establish guardrails for where AI can operate autonomously versus where human oversight is needed.

For financial services, this includes risk assessment algorithms, compliance checks, transaction monitoring rules, and customer relationship management processes. Each of these has explicit rules (documented policies) and implicit rules (experienced judgment that has never been formalized).

## The human-in-the-loop problem

Data consolidation and business logic conversion enable AI workflows. But certain processes still require human oversight regardless of how good the AI gets.

Financial reporting mandates human review in most jurisdictions. Regulatory requirements are explicit about this. Complex decision-making involving judgment calls or ethical considerations needs human involvement. Exception handling for edge cases that fall outside normal training parameters requires human judgment. And high-touch customer interactions involving empathy and nuance are not suitable for full automation.

The practical implication: AI deployment in financial services is not about replacing humans. It is about giving humans better tools. The AI consolidates data, surfaces patterns, and drafts recommendations. The human reviews, adjusts, and signs off.

## What this means for AI adoption timelines

The Gartner prediction about 60% of AI projects failing due to data readiness is not a technology forecast. It is a project management warning. Companies that start with the AI deployment will fail. Companies that start with the data infrastructure will succeed.

The sequence matters:

1. Data inventory and mapping
2. Canonical data model definition
3. Identity resolution across systems
4. Data normalization and synchronization
5. Business logic extraction and documentation
6. Guardrail design and human-in-the-loop planning
7. AI workflow integration
8. Deployment and monitoring

Steps 1 through 6 are the unglamorous foundation work. Most companies want to start at step 7. That is why most AI projects fail.

## The cost of skipping this step

Firms that deploy AI on fragmented data get one of two outcomes. Either the AI produces confident-sounding but incorrect answers because it is working with incomplete information. Or the AI correctly identifies that it does not have enough information and refuses to answer, which defeats the purpose of deploying it in the first place.

Both outcomes waste money and erode trust. The first is dangerous. The second is useless. Neither is acceptable.

The firms that get AI right are the ones that treat data consolidation as a prerequisite, not an afterthought. The AI model is the last thing you add, not the first.

---

## References

1. McKinsey & Company -- "The State of AI in 2025": https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
2. Gartner -- "GenAI Predictions for Enterprise Deployment": https://www.gartner.com/en/newsroom/press-releases/2024-03-25-gartner-predicts-genai
3. Harvard Business Review -- "The AI-Powered Organization": https://hbr.org/2024/01/the-ai-powered-organization
