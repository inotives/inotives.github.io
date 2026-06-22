var e=`---
title: "Who Revokes the Rogue Agent? The Revocation Gap in AI Agent Identity"
date: 2026-06-17
tags: [ai-agents, blockchain, identity, revocation, agent-identity, pkli, ocsp, crl, did, solana, agent-commerce, trust]
summary: "Agent identity standards are shipping fast — SAID, SAS, Entra Agent ID, AIS-1. But a comment on my last post pointed out the gap nobody's solving well: what happens when an agent key goes rogue? There's no OCSP for agents. No revocation list. No emergency kill switch. This is the hardest unsolved piece of the agent identity stack."
---

## Who Revokes the Rogue Agent? The Revocation Gap in AI Agent Identity

[Last month I wrote about why blockchain-anchored identity is the missing layer for agentic commerce](/posts/2026-06-09-crypto-agent-identity-blockchain-anchored). The core argument: in 2-3 years, everyone's agent will need a verifiable passport, and blockchain is the right foundation for cross-organisational agent trust.

A reader pushed back with the sharpest question I've gotten on the topic:

> "Who runs revocation when an agent key goes rogue?"

It's the right question. And honestly, nobody has a clean answer yet. I spent the last few weeks digging into this, and here's where the gap sits.

---

## Why Revocation is Harder for Agents Than for Humans

In traditional PKI (public key infrastructure), revocation is already a solved-but-ugly problem. When a TLS certificate gets compromised, the Certificate Authority (CA) adds it to a **CRL (Certificate Revocation List)** — a downloadable list of revoked certificates — or you query **OCSP (Online Certificate Status Protocol)** — a real-time check against the CA's server — to see if a specific certificate is still valid.

The model works because there's a clear hierarchy: the CA issued the cert, the CA revokes it, clients check with the CA. It's centralised, but it works for HTTPS.

Agents break this model in three ways:

**1. There's no CA.** Agent identity is supposed to be decentralised. The whole point of blockchain-anchored DIDs is that you don't need a central authority. But revocation without a central authority means you need *governance* — someone or something has to decide "this key is compromised" and broadcast that decision. Who? The agent's owner? A DAO? A smart contract with automated heuristics?

**2. Agents move at machine speed.** A human whose credit card is stolen notices within hours. An agent whose key is compromised could be draining funds, signing fraudulent transactions, or impersonating its owner in thousands of conversations before anyone notices. The revocation window is orders of magnitude tighter.

**3. Agents don't have "bodies."** You can revoke a human's passport and they're still standing there — you know who they are, you just need to re-verify. You can revoke an agent's key and it's... still running. The agent keeps operating with whatever cached trust relationships it had. The revocation needs to propagate to every peer that was trusting that key, and it needs to happen fast.

---

## The Three Revocation Models (None Perfect)

### Model 1: Sponsor Revocation (Today's Default)

This is what Microsoft Entra Agent ID and Solana Attestation Service (SAS) effectively do today. Every agent has a human sponsor or owning organisation. If the key goes rogue, the sponsor revokes it — rotates the key, updates the identity record, or deletes the agent entirely.

**Pros:** Simple. Clear accountability. Works within existing identity frameworks.

**Cons:** Single point of failure. If the sponsor's own key is compromised, the attacker can revoke legitimate agents or preserve rogue ones. No emergency mechanism if the sponsor is unreachable. And it only works for agents within a known organisational boundary — the freelancer's agent in another country? You need their sponsor to cooperate.

### Model 2: On-Chain Revocation Transaction

The blockchain-native approach: revocation is just a transaction. The agent's identity is a DID document on-chain (Solana PDA, Ethereum DID). Revoking it means calling a function that marks the key as revoked or rotates it. Anyone can verify the revocation status with a single chain query.

Some projects are already building toward this. SAID's on-chain identity records could support revocation flags. EtereCitizen's three-layer architecture (identity, trust, accountability) includes an accountability layer designed for exactly this. The IETF's draft standards reference revocation as a required capability.

**Pros:** Transparent, auditable, censorship-resistant. No single point of failure. Fast propagation — every peer querying the chain sees the updated status.

**Cons:** Governance problem. Who has the authority to call the revoke function? If it's the agent's owner key, and that key is compromised, you're stuck. If it's a multi-sig or governance contract, you add complexity and latency. And on-chain revocation only works if peers actually check the chain before trusting an agent — which means they need to query it in real-time, adding latency to every interaction.

### Model 3: Automated / Heuristic Revocation

The speculative approach: a smart contract or off-chain oracle monitors agent behaviour and triggers revocation automatically when anomalous patterns are detected. Unusual transaction volumes, failed authentication attempts, deviation from stated purpose — any of these could flag a rogue agent.

**Pros:** Fast. No human in the loop. Could catch compromises before they cause damage.

**Cons:** False positives are devastating. A legitimate agent doing something unusual (scaling up operations, entering a new market) could get flagged and revoked. And defining "anomalous" for an autonomous agent that's *supposed* to be creative and unpredictable is a fundamentally hard problem. Nobody's shipping this in production yet, and for good reason.

---

## What the TLS Ecosystem Teaches Us

The PKI world solved a version of this problem decades ago, and the lessons map directly:

**CRL (Certificate Revocation List)** → Agent Revocation Registry. A periodically updated list of revoked agent identities. Anyone can download it and check locally. Problem: latency. The list is only as fresh as its last update. For agents operating at machine speed, a stale CRL is a security hole.

**OCSP (Online Certificate Status Protocol)** → Agent Status Query. A real-time API where you send an agent's DID and get back "valid," "revoked," or "unknown." Faster, but adds a live dependency and a potential surveillance vector — the querier now knows who you're talking to.

**OCSP Stapling** → Pre-signed Revocation Proof. The agent itself carries a freshly signed attestation of its own validity. No need to query a third party. This is closest to what an on-chain revocation status could provide — the agent presents its current on-chain status as part of the handshake.

The TLS ecosystem also learned that revocation checking has a adoption problem. Many clients skip OCSP checks entirely because they add latency and failure modes. The same will likely happen with agent revocation — peers will optimise for speed and skip the check unless the stakes are high enough.

The lesson from TLS: **you need both**. A real-time query mechanism (OCSP equivalent) for high-stakes interactions, and a periodic list (CRL equivalent) for background verification. Neither alone is sufficient.

---

## The Emergency Scenario

The hardest case isn't routine revocation — it's emergency revocation. Your agent's key is compromised. Right now. Today.

In the traditional model, you'd call your CA, prove ownership, and have them revoke the cert. The CA is a company with a phone number and a support team.

In a decentralised agent identity model, you need:

1. **Detection** — you need to know the key is compromised. This might be the hardest part. An agent with a stolen key looks identical to the legitimate agent until it does something visibly wrong.

2. **Authority** — you need to prove you're the legitimate owner and have the right to revoke. This is where hardware-backed tiers (IETF AIR's TPM 2.0 and YubiKey standards) become critical. If your revocation authority is a software key, and the attacker has your software keys, you're out of luck. If your revocation authority is a hardware device in your pocket, you can always recover.

3. **Propagation** — you need every peer that was trusting the revoked key to stop trusting it. On-chain revocation helps here (the chain is the source of truth), but peers need to check it. If an agent has cached a trust relationship and doesn't re-verify, the revocation is invisible to it.

This is the gap nobody's shipping a complete solution for. Pieces exist — hardware keys, on-chain registries, multi-sig governance — but nobody's assembled them into a coherent emergency revocation protocol for agents.

---

## What Would a Good Solution Look Like?

If I were designing agent revocation from scratch, I'd want:

**Tiered revocation authority.** The agent's owner can revoke by default. But if the owner's key is compromised, a pre-registered recovery key (hardware-backed) can override. If both are compromised, a social recovery mechanism (M-of-N trusted contacts) can intervene. This is the same pattern crypto wallets use — and for good reason. Agent identity is a key management problem, and crypto wallets have been solving key management for a decade.

**On-chain status as the source of truth.** The revocation status lives on-chain. Every agent identity document includes a "valid until" timestamp or a revocation flag that any peer can check with a single transaction. No centralised OCSP responder to call.

**Revocation attestation propagation.** When an agent's identity is revoked, a revocation attestation is emitted (via SAS or equivalent) that peers can subscribe to. Think of it as a push notification: "key X just got revoked." This solves the propagation problem without requiring every peer to poll the chain constantly.

**Time-locked revocation for high-value actions.** For transactions above a certain threshold, the agent presents not just its identity but a freshness proof — a recent on-chain attestation that the identity is still valid, signed within the last N minutes. This limits the window of exploitation after a key compromise.

**Revocation transparency log.** Every revocation is logged on-chain with a timestamp and reason code (compromised, owner-initiated, governance-action, expired). This creates an audit trail. If someone revokes an agent maliciously, the transparent log makes it visible and contestable.

---

## Who's Closest?

Nobody has all five pieces. But a few projects are assembling fragments:

- **AIS-1** has the bonded identity pair model with tiered verification (Basic, Verified, Sovereign). The Sovereign tier's hardware-backed bond is essentially a revocation authority anchored in physical custody.
- **SAID** has the on-chain identity anchor that could support revocation flags — the program is extensible.
- **EtereCitizen** has the explicit accountability layer — their three-layer architecture (identity, trust, accountability) was designed with revocation in mind.
- **IETF AIR** has the hardware trust tiers that solve the emergency recovery problem. TPM 2.0 and PIV smart cards provide the "key in your pocket" recovery mechanism.
- **SAS** has the attestation infrastructure that could carry revocation attestations alongside identity attestations.

The piece that's missing is the glue — a protocol that connects all of these into a coherent revocation flow. Nobody's shipping that yet.

---

## The Market Will Force This

The revocation gap isn't just an academic concern. As agent-to-agent commerce scales, the financial stakes of a compromised agent key go up fast. If an agent can send payments, sign contracts, or access sensitive data, a rogue key isn't an inconvenience — it's a liability event.

The payment networks know this. Mastercard Agent Pay and Visa Trusted Agent Protocol both have revocation requirements baked into their specifications. They've seen what happens when certificate revocation is an afterthought (it was, in early PKI deployments), and they're not repeating the mistake.

The revocation protocol will likely emerge from the payment network side first, driven by commercial necessity, and then get generalised for non-financial agent interactions. It's the same pattern that drove TLS adoption — the browsers demanded it for e-commerce, and then it became the universal standard.

---

## Bottom Line

Agent identity is necessary but not sufficient. Without a clean revocation story, an agent identity is a key that can never be untrusted — and that's a liability, not a feature.

The pieces exist: on-chain registries, hardware-backed recovery, attestation services, governance frameworks. What's missing is the assembly — a protocol that ties them together into a coherent emergency and routine revocation flow.

The projects that figure this out first won't just have a better identity layer. They'll have the *trust layer* — the thing that makes agent-to-agent commerce actually safe. And in a world where everyone's agent is transacting with everyone else's agent, that trust layer is the real moat.
`;export{e as default};