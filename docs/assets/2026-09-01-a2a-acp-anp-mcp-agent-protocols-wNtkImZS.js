var e=`---
title: "A2A, ACP, ANP, and MCP: Four Agent Protocols, Four Different Jobs"
date: 2026-09-01
tags: [ai-agents, mcp, a2a, acp, anp, interoperability]
summary: "A practical guide to A2A, ACP, ANP, and MCP: what boundary each protocol owns, where they overlap, and how to choose the right one for real agent systems."
series: building-ai-systems
---

# A2A, ACP, ANP, and MCP: Four Agent Protocols, Four Different Jobs

The agent-protocol alphabet soup is getting ridiculous. A2A, ACP, ANP, and MCP all involve messages, capabilities, tools, and identity. It is tempting to ask which one will win.

That is usually the wrong question.

They sit at different boundaries. MCP connects an agent to a tool or source of context. ACP connects a coding agent to the interface a developer works in. A2A lets independent agents delegate work to one another. ANP is trying to supply identity, discovery, and secure communication for agents that meet across the open network.

One warning before going further: ACP in this article means the [Agent Client Protocol](https://agentclientprotocol.com/protocol/v2/overview), the open protocol used between an agent and a client such as an IDE. There are unrelated projects called Agent Control Protocol. The shared acronym is already a small interoperability failure.

## The short version

| Protocol | Main boundary | The useful mental model | Typical job |
| --- | --- | --- | --- |
| MCP | agent ↔ tool, API, or context server | a typed tool belt | query a database, read a repo, create a ticket |
| ACP | client/IDE ↔ coding agent | a workbench control channel | show progress, ask permission, edit files, run a command |
| A2A | agent ↔ independent agent | delegation between specialists | hand a task to a research, compliance, or support agent |
| ANP | agent ↔ open agent network | identity and discovery plumbing | find, authenticate, and securely contact an unknown agent |

The arrows matter more than the names. A tool is not a peer agent. An IDE is not a tool server. A company’s internal specialist is not automatically a public network participant.

## MCP: give one agent controlled access to useful things

The [Model Context Protocol](https://modelcontextprotocol.io/specification/2026-07-28/architecture) uses a host-client-server model. The host manages the user-facing application and security boundary; its clients connect to focused servers. Those servers expose primitives such as tools, resources, and prompts.

MCP is the right answer when an agent already knows what it is trying to do but needs a bounded way to reach a system. A database server might expose \`get_market_snapshot\`; a GitHub server might expose pull requests and issues; a document server might expose approved policy pages. The agent calls a capability and receives a result. It does not need to know the vendor SDK, database credentials, or implementation details behind that server.

For a crypto-data analyst, this could be as small as:

\`\`\`text
analysis agent -> MCP market-data server -> curated ClickHouse mart
analysis agent -> MCP documentation server -> runbooks and metric definitions
\`\`\`

The server should return data with the information the agent needs to judge it: canonical asset ID, observation time, source, and freshness. \`BTC\` alone is not an identity. It can mean different assets or markets in different feeds.

MCP does not turn the database into an autonomous colleague. It is still an agent calling a controlled interface. That constraint is a feature. A narrow read-only tool is easier to audit than a general SQL escape hatch.

Use MCP when the main question is: "How does this agent safely use this capability?"

## ACP: let a coding agent live inside a client

The Agent Client Protocol has a different shape. The client is usually an IDE or another user interface. The agent is commonly a subprocess that can plan and modify code. ACP defines the session between them: initialization, prompts, progress updates, permission requests, cancellation, terminal activity, file changes, and the point at which the agent becomes idle again.

That gives an editor a way to work with many compatible coding agents without inventing a private integration for each one. The client owns the user interaction and environment. The agent does the work and asks when it needs authority it does not have.

Consider a developer asking from an editor: "Update the fee calculation and run the unit tests." An ACP session can show the agent’s plan and changed files, stream its test output, and present a permission prompt before a destructive command. The developer remains in the loop without needing to use every agent’s custom terminal UI.

ACP is not a replacement for MCP. The coding agent inside that ACP session may use MCP servers to read issues, inspect a repository, or query a staging database. In fact, ACP’s specification includes a draft native MCP-over-ACP transport for exposing an MCP server through an ACP session. That is an integration point, not evidence that the protocols have merged.

Use ACP when the main question is: "How does a user-facing client coordinate this agent’s work safely and visibly?"

## A2A: delegate a task to a peer, not a tool call

The [Agent2Agent protocol](https://a2a-protocol.org/v1.0.0/specification/) is for independent agents that need to find one another, describe what they can do, send work, and return results. An A2A Agent Card advertises an agent’s identity, skills, interfaces, and supported capabilities. The task model supports messages, artifacts, streaming updates, cancellation, and push notifications for long-running work.

That task model is the dividing line. A tool call often says, "run this operation and give me the output." An A2A request can say, "investigate this suspicious transaction cluster, preserve evidence, and return a report when the review is complete." The receiving agent can have its own tools, workflow engine, review queue, and domain policy.

Here is a realistic internal example:

\`\`\`text
portfolio-monitoring agent
  -> A2A request to an on-chain-forensics agent
  -> the specialist uses its own MCP graph and case-management servers
  -> A2A artifact: addresses, evidence links, confidence, and review status
\`\`\`

The monitoring agent should not pretend it understands wallet-clustering methodology. It hands the case to a specialist and consumes a structured return. The artifact needs a schema: chain, address, cluster method, evidence timestamp, analyst or model version, confidence, and unresolved flags. Otherwise "suspicious" becomes an untraceable string that another agent may overinterpret.

A2A’s own specification describes its relationship with MCP plainly: MCP is agent-to-tool communication; A2A is agent-to-agent communication. An A2A agent can use MCP internally, but the caller need not know which tools it used.

Use A2A when the main question is: "How does one autonomous system give a bounded job to another autonomous system?"

## ANP: make agents discoverable beyond one organisation

The [Agent Network Protocol](https://agent-network-protocol.com/docs/anp-getting-started-guide) aims at a wider and harder problem: an open network where agents can discover, authenticate, and securely communicate with agents they were not preconfigured to know.

ANP is layered. Its identity layer uses decentralized identifiers, including \`did:wba\`, and encrypted communication. Its application layer defines descriptions and discovery. ANP also specifies a meta-protocol for negotiating how two agents will communicate, but that part remains a draft in the 1.1 specification set. The [discovery design](https://agent-network-protocol.com/docs/protocols/agent-discovery-protocol) uses well-known paths and indexing services so agents can publish a description and become findable.

The practical scenario is cross-company service discovery. Imagine a travel assistant that needs to find hotel inventory agents. Rather than registering an account with every hotel platform first, it can discover an ANP-capable hotel agent, verify its identity, negotiate a compatible application protocol, and start a secured conversation. The booking rules and payments still need their own business and regulatory controls. ANP does not remove that work.

This is a much larger bet than MCP or ACP. Local MCP integrations and IDE-agent sessions can be valuable without any global identity scheme. ANP matters when your system has a real need for decentralised, cross-domain discovery and trust. Do not add it to an internal agent fleet merely because the word "network" sounds future-proof.

Use ANP when the main question is: "How do we find and establish trust with an agent outside our existing integration boundary?"

## How they fit together

These protocols can form a stack without competing for the same responsibility:

\`\`\`text
developer -> ACP client/IDE -> coding agent
                               |
                               +-> MCP -> GitHub, docs, test systems, databases

operations agent -> A2A -> independent compliance specialist
                              |
                              +-> MCP -> case system and blockchain analytics tools

unknown external specialist <- ANP -> identity, discovery, secure connection
\`\`\`

The protocols do not guarantee a safe system when composed. Each boundary still needs its own authorization, rate limits, audit trail, data classification, and human approval path. A2A delegation does not grant the caller access to every tool behind the specialist. ANP discovery does not establish commercial trust. MCP tool descriptions do not make tool output trustworthy.

## A boring selection rule

Start with the smallest boundary you actually have.

- A single agent needs access to internal data or actions: use MCP.
- A developer needs to supervise a coding agent from an IDE or another client: use ACP.
- Separate agents own distinct workflows and must hand work across a service boundary: use A2A.
- Those agents must discover and securely contact unknown parties across organisations: evaluate ANP.

Most teams should begin with MCP and an ordinary application API. Add A2A when specialisation and independently operated workflows make delegation useful. ACP matters for a coding-agent product. ANP is for a genuine open-network requirement, not a weekend architecture diagram.

The point is not to build the full alphabet. It is to make every agent boundary explicit, then choose the protocol that was designed for that boundary.

## References

- [Model Context Protocol architecture specification](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [Agent Client Protocol v2 overview](https://agentclientprotocol.com/protocol/v2/overview)
- [Agent Client Protocol prompt lifecycle](https://agentclientprotocol.com/protocol/v2/prompt-lifecycle)
- [Agent2Agent Protocol v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/)
- [A2A: how it works with MCP](https://a2a-protocol.org/v1.0.0/specification/#how-a2a-works-with-mcp)
- [Agent Network Protocol getting started guide](https://agent-network-protocol.com/docs/anp-getting-started-guide)
- [ANP Agent Discovery Protocol](https://agent-network-protocol.com/docs/protocols/agent-discovery-protocol)
`;export{e as default};