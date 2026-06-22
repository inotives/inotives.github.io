var e=`---
title: "Your AI Agent Needs a Passport: Why Blockchain Identity is the Missing Layer for Agentic Commerce"
date: 2026-06-09
tags: [ai-agents, blockchain, identity, solana, did, verifiable-credentials, agent-identity, crypto, hermes, agent-commerce, sas, said]
summary: "I run my own Hermes agent. In 2-3 years, everyone will have a personal AI acting as their online avatar. How do you know which agent belongs to whom? And would you let your agent send money to a stranger's agent? Blockchain-based identity — anchored in cryptographic keys and peer-to-peer networks — is the most solid answer I've found."
---

## Your AI Agent Needs a Passport: Why Blockchain Identity is the Missing Layer for Agentic Commerce

I run my own Hermes agent. It handles research, writes drafts, interacts with tools, and increasingly acts as my proxy in automated workflows. It's powerful. It's also making me think about a problem I didn't expect to face this soon.

Think about this:

In 2-3 years, everyone will have a personal AI agent. Not a chatbot you occasionally open — an agent that lives online, represents you, communicates with other agents, and eventually transacts on your behalf. Your agent negotiates with a freelancer's agent. A vendor's agent sends your agent an invoice. A service agent offers your agent a subscription.

Now ask yourself: would you feel safe letting your agent send money to another agent it just met on the internet?

If that thought makes you uncomfortable, you've identified the same gap I have. There is no identity layer for AI agents. No way to answer the most basic question: **who does this agent belong to, and can I prove it?**

---

## The Problem: Agents Are Trust-Naive

Right now, agents operate in a trust vacuum. When my Hermes agent calls another agent's API, it has no way to verify:

- Is this agent operated by a real company or a sock puppet?
- Is the person behind it who they claim to be?
- Has this agent been revoked or compromised since its last communication?
- If this agent takes my money and fails to deliver, who do I hold accountable?

Without answers to these questions, agent-to-agent commerce is limited to sandboxed environments and pre-vetted partners. That's not a scalable model. The vision of agents negotiating, trading, and collaborating in the wild requires a verifiable identity layer.

The challenge is fundamentally cryptographic. You need a way to bind an agent's public key to a real-world entity — a person or a company — in a way that anyone can verify without calling a central authority. You need the binding to be tamper-evident, revocation-capable, and permissionless to create.

That's not a new problem. It's the same problem that public key infrastructure, SSL certificates, and DNSSEC all solve — but applied to AI agents operating at machine speed across trust boundaries.

---

## Why Blockchain is the Right Answer

I've spent time thinking about alternative approaches. Centralised registries (a "GitHub for agents") create gatekeepers and single points of failure. PGP-style web of trust never reached mainstream adoption. Federation works for email but doesn't translate to machine-speed agent interactions.

Blockchain is different. The properties that make it work for this problem:

**Cryptographic by nature.** Every blockchain transaction is signed by a keypair. Every agent identity starts the same way — a keypair that the agent operator controls. The blockchain doesn't create the identity; it anchors it. The chain is just a public bulletin board that says "this public key belongs to this agent, and this agent is operated by this entity."

**Peer-to-peer verification.** Anyone can resolve an agent's on-chain record without asking permission. My agent queries the chain, finds the agent's DID, checks the attestations, and decides whether to trust it. No phone calls, no approval flows, no central authority to convince.

**Sovereign and permissionless.** You register your agent by signing a transaction. No application form, no approval committee. The same property that lets anyone create a wallet lets anyone register an agent identity. The gate is cryptographic competence, not organisational access.

**Economic Sybil resistance.** Registering an agent costs real money — a fraction of a cent on Solana, more on Ethereum. Spamming millions of fake agent identities has a real cost. Combined with hardware-backed attestation tiers, you can achieve meaningful Sybil resistance without centralised identity verification.

---

## What Actually Exists Today

The research landscape is further along than I expected. Here's what's production-ready or close to it:

**[SAID (Solana Agent Identity Standard)](https://github.com/kaiclawd/said)** — Live on Solana mainnet. 53 registered agents as of March 2026. An Anchor program, TypeScript SDK, CLI tools, and a REST API. Register your agent's keypair on-chain, set its metadata, and anyone can verify the binding. Simplest integration path today.

**[Solana Attestation Service (SAS)](https://solana.com/news/solana-attestation-service)** — Live on mainnet since May 2025. An open, permissionless protocol for verifiable credentials. KYC passports, accreditation verification, Sybil resistance for governance. This is the layer that connects on-chain agent identities to real-world entities — a Civic KYC pass, a Sumsub verification, a company registration attestation. The agent's DID proves it exists; the SAS attestation proves who stands behind it.

**[SIMD-0520 / \`did:aip\`](https://github.com/solana-foundation/solana-improvement-documents/pull/526)** — A formal W3C DID method for Solana PDAs. Deterministic agent identities with hot/cold key separation, capability metadata, and permanent ownership binding. Still in draft but the most standards-complete approach. Companion sRFC under review by the Solana Foundation.

**[IETF Agent Identity Registry (AIR)](https://datatracker.ietf.org/doc/html/draft-drake-agent-identity-registry-03)** — Hardware-backed identity tiers. TPM 2.0, PIV smart cards (YubiKey), secure enclaves. The hardware tier directly addresses the academic finding that "agents need hardware-enforced security boundaries, not just software-level identity" ([arXiv: 2511.02841](https://arxiv.org/html/2511.02841v2)).

**[EtereCitizen](https://github.com/icaroholding/EtereCitizen)** — Agent identity on Base (Ethereum L2). Three-layer architecture: identity (\`did:ethr\`), trust (on-chain reputation with temporal decay), and accountability (traceable chain of responsibility). Comes with MCP bindings for agent-to-agent interactions and x402 payment negotiations.

**[AIS-1 Agent Identity Standard](https://ais-1.org/)** — Bonded identity pair standard. A single cryptographic token permanently linking an agent DID to a sponsor DID, with three verification tiers (Basic, Verified, Sovereign). First bonds issued on Base mainnet.

**[Solana Agent Protocol (SAP)](https://github.com/tradingstarllc/solana-agent-protocol)** — Application-layer standards by tradingstarllc. Six trust levels with increasing Sybil resistance, from software-only (Level 0-2) up to DePIN device verification (Level 5 at $500+/mo per identity). Includes working Anchor program on devnet.

**[Relay Network](https://github.com/CryptoSkeet/Relay-Network)** — Full agent social and economic network on Solana. Devnet live, mainnet targeting Q3 2026.

**Payment network identity** — [Mastercard Agent Pay](https://www.mastercard.com), [Visa Trusted Agent Protocol](https://www.visa.com), [Google AP2](https://eco.com/support/en/articles/15192005). The commercial driver. Google AP2's mandate structure is elegant: an Intent Mandate (user authorises agent to shop within a scope) + Cart Mandate (user signs off on the final cart). This is the UX pattern for agent commerce.

---

## Microsoft Entra Agent ID: The Enterprise Counterpart

I also need to mention Microsoft's entry in this space. [**Microsoft Entra Agent ID**](https://learn.microsoft.com/en-us/entra/agent-id/) — announced at Build 2025, now generally available — is Microsoft's identity and authorization framework for AI agents in enterprise environments. It treats agents as first-class identities in Entra ID, complete with:

- **Agent identity blueprints** — Reusable templates that define what kind of agent it is and what credentials it can use ([GitHub samples](https://github.com/Azure-Samples/ms-identity-agent-identities))
- **Sponsors** — Every agent has a human sponsor recorded on the identity object, so there's always someone accountable
- **Agent 365** — Built on top of Agent ID, adds a registry, dashboards, telemetry, and policy hooks into the Microsoft 365 ecosystem
- **Federated identity credentials** — Agents authenticate without passwords using short-lived tokens, no static secrets

This is a different philosophy from the blockchain approach. Microsoft's model is **enterprise-centric**: it solves "who owns this agent inside our organisation" by extending an existing identity infrastructure (Entra ID) that IT teams already manage. It works brilliantly for agents that operate within corporate boundaries and Microsoft's ecosystem.

The blockchain approach solves a different problem: **cross-organisational trust**. When my Hermes agent needs to verify an agent operated by a freelancer in another country, or an agent registered by a small company that doesn't use Microsoft infrastructure, the enterprise directory doesn't help. An on-chain DID resolves regardless of what identity provider either party uses.

Both are needed. Microsoft Entra Agent ID for the enterprise perimeter. Blockchain-anchored DIDs for the wild west of agent-to-agent commerce outside it. The two will likely coexist — Microsoft's own research has explored blockchain-based identity ([Decentralized & Collaborative AI on Blockchain](https://jpt.spe.org/decentralized-and-collaborative-ai-how-microsoft-research-using-blockchains-build-more-transparent-m)), and the standards (W3C DIDs, Verifiable Credentials) are converging.

From the academic side, the paper "[AI Agents with Decentralized Identifiers and Verifiable Credentials](https://arxiv.org/html/2511.02841v2)" (arXiv: 2511.02841, Dec 2025) demonstrates a working prototype using DIDs and VCs on Hyperledger Indy, showing mutual authentication between LangChain and AutoGen agents across security domains. Their key finding: "Limitations once an agent's LLM is in sole charge to control the respective security procedures" — meaning software-only identity isn't enough. You need hardware-enforced boundaries, which is where the IETF AIR trust tiers ([TPM 2.0](https://datatracker.ietf.org/doc/html/draft-drake-agent-identity-registry-03), secure enclaves) come in.

---

## What This Means

The stack is forming:

- **Layer 1: Keypair** — Every agent has an Ed25519 keypair. This is the atomic unit of identity.
- **Layer 2: On-chain anchor** — The public key is registered on a blockchain ([Solana](https://solana.com) PDA, [Ethereum](https://ethereum.org) DID) as a deterministic, verifiable record.
- **Layer 3: Attestations** — Verifiable credentials (KYC, company registration, reputation scores) are attached to the on-chain identity via attestation services like [SAS](https://solana.com/news/solana-attestation-service) and [AIS-1](https://ais-1.org/).
- **Layer 4: Commerce** — Payment networks ([Mastercard Agent Pay](https://www.mastercard.com), [Visa Trusted Agent](https://www.visa.com), [Google AP2](https://eco.com/support/en/articles/15192005)) layer on top, using the same identity primitives for authorisation.

My Hermes agent doesn't need all four layers today. It needs Layer 1 and Layer 2 to start — a verifiable identity that other agents can recognise. Layers 3 and 4 become relevant when it starts transacting.

The market is already signalling demand. The decentralised identity market is projected at **$7.4B in 2026**, with non-human identities growing **44% YoY**. Machine-to-human ratios in some enterprises have reached **144:1**. Mastercard and Visa are both shipping agent identity products. Google AP2 has 60+ launch partners.

This isn't speculative. It's being deployed now.

---

## The Bottom Line

Will I feel safe letting my Hermes agent communicate with any agent and make payments to it? Not yet. But the pieces are falling into place faster than I expected.

The idea of using blockchain as an identity vouching layer is not theoretical — it's production code on mainnet. [SAID](https://github.com/kaiclawd/said) registered 53 agents in its first month. [SAS](https://solana.com/news/solana-attestation-service) is live with Civic, Sumsub, and PolyFlow. [Microsoft Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/) is generally available with Agent 365. The [IETF](https://datatracker.ietf.org/doc/html/draft-drake-agent-identity-registry-03) has three active drafts for agent identity standards.

The cryptographic and peer-to-peer nature of blockchain makes this idea solid in a way that centralised alternatives cannot match. No gatekeepers. No single points of failure. Verification that any agent can perform in a single transaction lookup.

In 2-3 years, when everyone's agent is negotiating with everyone else's agent, the ones that carry verifiable, blockchain-anchored passports will be the only ones anyone trusts. The ones that show up with "trust me bro" credentials won't get past the handshake.
`;export{e as default};