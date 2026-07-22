var e=`---
title: "The Minimum Viable Data Catalog for a Solo Crypto Project"
date: 2026-07-22
tags: [data-catalog, crypto, data-engineering, dbt, mcp, metadata]
series: data-engineering
summary: "A solo crypto project does not need an enterprise data catalog. It needs a small, searchable source of truth built from dbt schema files, contracts, README notes, dbt docs, and metadata an MCP tool can expose to agents."
---

# The Minimum Viable Data Catalog for a Solo Crypto Project

Most data catalog advice is written for companies with committees.

That is not where a solo crypto project starts.

You do not need a catalog platform on day one. You need a small place to answer boring questions:

\`\`\`text
What tables exist?
Which fields are safe to join on?
How fresh should this data be?
Which source owns this model?
Can an agent query this table?
Where is the contract?
\`\`\`

If those answers are scattered across SQL files, old notes, and your memory, the catalog already exists. It is just trapped in places tools cannot use well.

## A catalog is a map, not a product

A useful data catalog does three jobs.

It names the datasets.

It explains what the fields mean.

It tells consumers how safe the data is to use.

For a crypto project, that safety part matters. A catalog should say that \`display_symbol\` is not a join key. It should say that \`canonical_asset_id\` is the stable mart identity. It should say which timestamp controls freshness. It should say whether a table is raw, staging, mart, or agent-facing.

That is enough for the first version.

## Start with files you already maintain

The minimum viable catalog should be assembled from files that already belong in the project:

\`\`\`text
models/schema.yml
contracts/
README.md
docs/pipeline.md
dbt docs artifacts
agent metadata endpoint
\`\`\`

Do not create a second documentation system. Duplicate docs rot.

The catalog should reuse the source of truth.

If a field description lives in dbt \`schema.yml\`, read it from there. If freshness lives in a contract file, link to it. If agent access rules live in a view contract, expose that metadata through the tool boundary.

## \`schema.yml\` is the center

For dbt projects, \`schema.yml\` is the cheapest catalog seed.

It can describe models:

\`\`\`yaml
models:
  - name: mart__asset_prices
    description: "Consumer-facing crypto price mart."
    columns:
      - name: canonical_asset_id
        description: "Stable internal asset identifier. Use this for joins."
      - name: display_symbol
        description: "Human-readable symbol. Do not use for joins."
      - name: observed_at
        description: "Timestamp when the price was observed at the source."
      - name: freshness_status
        description: "Whether this row is fresh enough for consumer use."
\`\`\`

That is not busywork. It is agent context.

When an agent sees both \`display_symbol\` and \`canonical_asset_id\`, the description tells it which one to use.

## Contracts fill the gaps

dbt descriptions explain shape. Contracts explain promises.

A small contract can carry the parts a column description should not:

\`\`\`yaml
dataset: mart__asset_prices
layer: mart
owner: market-data
identity:
  join_key: canonical_asset_id
freshness:
  timestamp: observed_at
  max_age_minutes: 15
agent_access:
  allowed: true
  stale_behavior: refuse_current_price_answer
failure_policy:
  blocking_when:
    - freshness_sla_failed
    - unmapped_major_asset
\`\`\`

Now the catalog can answer operational questions instead of stopping at "what columns exist?"

That is the difference between a dictionary and a useful catalog.

## README is for the human path

Keep a short human README.

It should say:

\`\`\`text
What the project does
How to run ingestion
How to run transforms
How to run tests
Where raw data lands
Where marts live
Where contracts live
Which tables agents can query
\`\`\`

Do not make the README a second catalog. Make it the entry point.

The README should point to the catalog files. The catalog files should carry the details.

## dbt docs are already a catalog

dbt can generate docs from models, descriptions, tests, and lineage.

For a solo project, that may be enough.

You get:

- model list
- column descriptions
- tests
- lineage graph
- source definitions

That is useful for humans. It is also useful for agents if the artifacts are accessible.

The trick is to avoid treating dbt docs as a website only. The metadata behind it can be read, indexed, searched, and exposed through a tool.

## MCP metadata makes it agent-readable

If agents query the project, give them metadata before data.

A small MCP tool can expose:

\`\`\`text
list_datasets()
describe_dataset(name)
list_agent_safe_datasets()
get_freshness_contract(name)
get_join_keys(name)
\`\`\`

The responses should be boring JSON:

\`\`\`json
{
  "dataset": "mart__asset_prices",
  "layer": "mart",
  "agent_access": true,
  "join_key": "canonical_asset_id",
  "display_fields": ["display_symbol", "display_name"],
  "freshness": {
    "timestamp": "observed_at",
    "max_age_minutes": 15
  }
}
\`\`\`

That gives the agent a map before it writes a query.

This is much safer than letting the agent infer table meaning from names alone.

## What belongs in the minimum catalog

For a solo crypto project, I would track this:

\`\`\`text
dataset name
layer: raw, staging, mart, agent
owner
source system
description
primary key
join keys
display fields
freshness rule
contract path
agent access policy
known caveats
\`\`\`

That is plenty.

Do not start with tags for every business domain, certification workflows, approval states, PII classifiers, and lineage screenshots unless the project actually needs them.

The catalog should fit the project.

## The crypto-specific fields

Crypto needs a few extra warnings.

For asset tables, the catalog should say:

\`\`\`text
display_symbol is not an ID
canonical_asset_id is the mart join key
provider IDs are scoped to provider
contract_address requires chain_id
delisted assets remain queryable for history
\`\`\`

For price tables:

\`\`\`text
observed_at controls freshness
ingested_at is pipeline timing
negative prices are invalid
stale prices block agent use
\`\`\`

For quarantine tables:

\`\`\`text
rows are not consumer-safe
failure_reason is machine-readable
source_payload_json preserves provider truth
retry_status controls replay
\`\`\`

These notes prevent the common agent mistakes: joining on symbols, treating stale values as current, and using quarantine rows as if they were clean data.

## Generate what you can

The catalog should not require much manual work.

Generate from:

\`\`\`text
dbt schema.yml
contract YAML files
dbt manifest/catalog artifacts
README links
MCP metadata config
\`\`\`

Then publish a simple markdown or JSON view:

\`\`\`text
docs/catalog.md
metadata/catalog.json
\`\`\`

Markdown is for humans. JSON is for tools.

That is enough.

## The practical rule

A solo crypto project needs a catalog when tables start having different meanings for different consumers.

Do not buy a platform first. Write good \`schema.yml\` descriptions. Add small contract files. Keep a short README. Generate dbt docs. Expose the safe metadata through MCP.

The catalog should answer the agent's first question before it touches the data:

\`\`\`text
What am I allowed to trust here?
\`\`\`

## References

- [dbt docs](https://docs.getdbt.com/docs/collaborate/documentation)
- [dbt model properties](https://docs.getdbt.com/reference/model-properties)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- [Data Contracts: The API Layer Your Crypto Pipeline Is Missing](/posts/2026-07-18-data-contracts-crypto-pipelines)
- [Why dbt Makes Sense Even for Small Crypto Projects](/posts/2026-07-20-dbt-small-crypto-projects)
- [Agent-Readable Data Pipelines](/posts/2026-07-21-agent-readable-data-pipelines)
- [The Crypto Asset Mapping Table](/posts/2026-07-21-crypto-asset-mapping-table)
- [Why Raw Data Should Stay Raw](/posts/2026-07-22-why-raw-data-should-stay-raw)
`;export{e as default};