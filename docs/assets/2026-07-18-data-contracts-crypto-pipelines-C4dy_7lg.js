var e=`---
title: "Data Contracts: The API Layer Your Crypto Pipeline Is Missing"
date: 2026-07-18
tags: [data-contracts, data-quality, crypto, dbt, data-engineering, market-data]
series: data-engineering
summary: "Data contracts turn fragile pipeline assumptions into executable rules. For crypto data, where identifiers, vendors, schemas, and freshness guarantees drift constantly, contracts are the difference between a usable warehouse and a pile of plausible-looking garbage."
---

# Data Contracts: The API Layer Your Crypto Pipeline Is Missing

Most data pipelines do not break loudly. They rot.

A vendor adds a column. A field that used to be required starts arriving as null. A timestamp quietly switches from seconds to milliseconds. A crypto asset gets renamed after a token migration. The dashboard still loads. The agent still answers. The report still goes out.

That is the dangerous part. Bad data often looks healthy until someone reconciles it against money.

Data contracts are the boring fix. They define what a dataset promises to deliver: schema, types, semantics, quality rules, freshness, ownership, and sometimes allowed use. More importantly, they make those promises executable. A contract that only lives in a wiki is just documentation with better branding.

## The API analogy is useful, but incomplete

People describe data contracts as "APIs for data." That is mostly right.

If I publish an API endpoint, consumers expect the response shape to stay stable. I cannot rename \`customer_id\` to \`user_id\` on a Tuesday and pretend downstream systems should figure it out. I need versioning, review, migration, and a breaking-change policy.

Data needs the same discipline. The difference is that data changes even when code does not. The producer can keep the same SQL and still violate the contract because the upstream feed changed underneath it.

That is common in crypto. CoinGecko, CoinMarketCap, exchange feeds, wallet providers, custody systems, and compliance tools all carry their own identifiers and timing conventions. \`BTC\`, \`XBT\`, \`bitcoin\`, contract addresses, native assets, wrapped assets, chain-specific tokens, delisted pairs, token swaps, forks. If those assumptions are not written down and tested, they live in somebody's head until they leave the company.

## Where contracts would sit in my current projects

In \`agent-pipe\`, the durable local contract is simple: records land in SQLite with a project id, entity, local id, payload, metadata, timestamps, and soft-delete state. That is a good raw event boundary. It does not need a heavy governance platform. It needs a small, explicit promise:

- every record has a deterministic identity
- \`project_id\`, \`entity\`, and \`local_id\` are present
- \`payload_json\` parses
- \`deleted_at\` is either null or a valid timestamp
- reruns are idempotent

In \`market-pipe\`, the contract gets sharper because raw local records become warehouse tables and dbt models. The project has already moved toward source-owned relation names such as \`coingecko.stg__<entity>\` and \`coingecko.mart__<entity>\`. That naming decision is a contract. It tells downstream consumers which source owns the model, which layer they are reading, and what kind of stability they can expect.

The next step is to make the important tables fail when the contract breaks.

For a crypto market pipeline, I would start with contracts around the small number of assets that everything else depends on:

- \`coingecko.stg__coins_list\`
- \`coingecko.stg__asset_platforms\`
- \`coingecko.mart__assets\`
- \`agent_pipe.raw_local__records\`

Not every table deserves a contract on day one. Raw vendor payloads are allowed to be messy. Public marts are not.

## A useful contract is smaller than you think

A bad data contract tries to describe the whole universe. It becomes a YAML swamp. Nobody reviews it. Nobody trusts it. Nobody updates it.

A useful contract starts with the columns and rules that would cause real damage if they changed.

For \`coingecko.stg__coins_list\`, the first version might be this:

\`\`\`yaml
dataset: coingecko.stg__coins_list
owner:
  team: data-engineering
  contact: data@company.example
columns:
  - name: coingecko_id
    data_type: text
    required: true
    unique: true
  - name: symbol
    data_type: text
    required: true
  - name: name
    data_type: text
    required: true
  - name: ingested_at
    data_type: timestamp
    required: true
quality:
  - row_count_min: 10000
  - freshness_hours_max: 24
semantics:
  identity: "coingecko_id is the provider-specific asset identifier, not the internal canonical asset id."
  symbol_warning: "symbol is display metadata. Do not join on it."
\`\`\`

The last line matters more than it looks. In crypto, joining on symbol is how you eventually mix up assets. Symbols are reused. They change. They collide across chains. A contract should not only say "this is a string." It should say what the field means and what it must not be used for.

That is where data contracts become more than schema checks.

## The crypto-specific rules I would encode first

Crypto data has a few failure modes that deserve contract rules early.

Asset identity should be explicit. A provider id is not a canonical asset id. A ticker is not an identity. A contract address is not enough unless the chain is included. Native ETH and bridged ETH are not interchangeable just because both say ETH on a screen.

Temporal validity should be part of mappings. If a token migrates, the old mapping should not disappear. It should get an \`effective_to\`. The new mapping gets an \`effective_from\`. Historical reports need the mapping that was true at the time, not the mapping that is true today.

Freshness should reflect the dataset. A daily coin list can tolerate a slower SLA than price candles. A compliance alert feed cannot. "Updated recently" is not a contract. "Available by 00:15 UTC after the source run" is.

Nullability should be honest. Some fields are nullable because the real world is incomplete. Others are nullable because nobody wanted to deal with failures. Contracts force that conversation.

Allowed use belongs in the contract when agents consume the data. Can this dataset be used for client-facing reporting? Can it be used for trading signals? Can it be used to train a model? OpenMetadata includes terms-of-use style fields for this reason. AI agents make this less optional. If an agent can query a table, it needs to know whether the answer is allowed to leave the building.

## dbt contracts are necessary, but not enough

dbt model contracts are a good fit for transformed models. When \`contract.enforced: true\` is set, dbt checks that a model produces the declared column names and data types before building it. For tables and incremental models, constraints can also flow into the warehouse DDL, depending on platform support.

That is exactly what I would use for stable marts in \`market-pipe\`.

But dbt contracts do not cover everything. dbt's own docs point out that model contracts are model-specific and do not apply to sources, seeds, snapshots, and other resource types. That means they are not the whole producer-consumer agreement. They are one enforcement point.

For source boundaries, use lighter checks: a small contract YAML, dbt source tests, Great Expectations, Soda, or the Data Contract CLI. The tool matters less than the habit: every important boundary gets a checked promise.

## Where to enforce

Contracts should run where bad data can still be stopped cheaply.

At ingestion, check basic shape. Did the vendor payload parse? Are required identity fields present? Is the batch wildly smaller than usual? If not, quarantine it before it enters the warehouse.

At staging, check type normalization and identity semantics. This is where \`coingecko_id\`, \`asset_platform_id\`, \`contract_address\`, and internal asset ids should stop being fuzzy.

At marts, enforce the consumer contract. These are the tables dashboards, agents, and reports depend on. Breaking changes here should fail builds or require a versioned model.

At runtime, monitor freshness and volume. CI catches code changes. It will not catch a vendor silently returning half the rows on Sunday.

The lazy version is enough to start:

\`\`\`text
raw: parseable payload + identity present
staging: typed columns + no unsafe joins
marts: dbt contract + freshness + row-count guard
\`\`\`

Do that before buying a platform.

## What this prevents

Here is the failure I want to avoid in a crypto reporting pipeline.

An agent needs to explain why a client's BTC exposure moved. It queries a warehouse mart. The mart joined exchange balances to asset metadata through \`symbol\`. One venue reports Bitcoin as \`XBT\`, another uses \`BTC\`, and a wrapped BTC token shares the same display symbol. The model returns a clean-looking number. The agent writes a clean-looking explanation. Nobody sees the bug until reconciliation.

A contract will not magically understand Bitcoin. But it can block the unsafe shape:

- balance marts must join through canonical asset id
- provider ids must be mapped through \`AssetProviderMapping\`
- mappings must include provider, external id, chain, and validity window
- symbol is display-only
- unmapped assets fail into a quarantine table, not into the mart

That is practical governance. No committee needed.

## The implementation path I would take

I would not start with a full enterprise data-contract platform. Too much ceremony too early.

For \`market-pipe\`, I would add three things:

1. dbt model contracts for stable marts
2. source-level tests for CoinGecko staging models
3. one checked-in \`contracts/\` folder for the public dataset promises

The folder can be boring:

\`\`\`text
contracts/
  coingecko/
    stg__coins_list.yml
    mart__assets.yml
  agent_pipe/
    raw_local__records.yml
\`\`\`

Each contract should answer five questions:

- Who owns this dataset?
- What fields are stable?
- Which fields are identities, and which are display metadata?
- How fresh must it be?
- What should happen when it fails?

That last question is where teams usually dodge. A contract without a failure policy is just a detector. For crypto data, I prefer boring defaults: quarantine raw rows, fail staging builds, version public marts, and alert on freshness.

## Data contracts make agents less reckless

The AI angle is simple. Agents are confident consumers of weak interfaces.

If a human analyst sees \`symbol\`, \`asset\`, \`token\`, and \`coin_id\`, they might pause and ask which one is canonical. An agent often keeps going. It will pick a plausible join path and explain the result in polished language.

Data contracts give the agent better rails. They tell it which fields are stable, which tables are public, which joins are valid, and what the dataset is allowed to support. Pair that with lineage from dbt or a catalog, and the agent has a much better chance of producing something useful.

This is why I see contracts as part of agent infrastructure, not just data governance. Agents need tools. They also need trustworthy data boundaries.

## The practical rule

Do not contract everything. Contract the places where a silent break creates downstream damage.

For crypto, that means identity mappings, prices, balances, compliance events, customer-facing marts, and any table an agent is allowed to use for reporting.

Start with one painful boundary. Write down the promise. Run it in CI. Run it after ingestion. Make failure visible.

That is enough to change the culture. The pipeline stops being a chain of assumptions and starts behaving like software.

## References

- [Data Contract CLI documentation](https://docs.datacontract.com/)
- [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/)
- [Soda Data Testing and Data Contracts](https://docs.soda.io/data-testing)
- [dbt model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)
- [OpenMetadata data contracts guide](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-contracts/spec)
- [Great Expectations documentation](https://legacy.017.docs.greatexpectations.io/docs/)
- [Crypto asset data cleanup in agentic spaces](/posts/2026-06-08-crypto-asset-data-cleanup-agentic-spaces)
- [dbt Fusion and Core v2.0](/posts/2026-07-04-dbt-fusion-core-v2-rust-rewrite)
`;export{e as default};