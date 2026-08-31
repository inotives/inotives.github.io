var e=`---
title: "Archivy for Data Engineering: Turn Runbooks, Decisions, and Pipeline Evidence into a Searchable Knowledge Base"
date: 2026-08-31
tags: [data-engineering, knowledge-management, documentation, archivy, operations]
summary: "Archivy is a self-hostable, file-backed wiki with bookmarks, bidirectional links, tags, full-text search, a web API, and plugins. This article explains how its durable Markdown model can support data contracts, runbooks, incidents, and lineage in a data engineering workflow."
series: building-ai-systems
---

Data engineering teams already have a knowledge base. It is just scattered across pull requests, Slack threads, warehouse comments, dashboards, tickets, and the memory of the person who was on call last Tuesday.

[Archivy](https://github.com/archivy/archivy) is a self-hostable knowledge repository built around a useful default: the knowledge lives in files. Notes and saved bookmarks are extended Markdown documents with YAML front matter. The web application, search index, API, and plugins are layers around those files, not a replacement for them.

That is a good fit for data work. A pipeline needs code and tables, but it also needs decisions: why an incremental model has a seven-day lookback, why a provider field was quarantined, how an incident was resolved, and which dashboard number is approved for a business question. These are durable operating facts. They should be searchable, reviewable, and linked to evidence.

## What Archivy is

Archivy is a Python and Flask application that can run locally or be self-hosted. It provides:

- Markdown notes and bookmarks with YAML front matter;
- bidirectional links and embedded tags;
- locally preserved bookmark content, intended to reduce dependence on a live URL;
- a web interface and command-line interface;
- full-text search via Elasticsearch or a lighter ripgrep-based engine;
- an authenticated HTTP API;
- Python plugins that extend its CLI and can surface as web forms.

The project calls stored notes and bookmarks "DataObjs." They are ordinary files in a configurable directory, organised in subdirectories you choose. Archivy's own metadata gives each item an ID, type, title, tags, and date. The project uses TinyDB for plugin-specific persistent data, while the knowledge content itself remains on the filesystem.

That separation is the main architectural point. Elasticsearch is an index. It improves retrieval but does not become the only copy of a decision. If the index needs rebuilding, \`archivy index\` can recreate it from the files. If a team decides to leave Archivy, it still has Markdown and front matter rather than an opaque export project.

## The core architecture

\`\`\`text
Markdown notes and preserved bookmarks
        |
        v
Archivy filesystem layer
        |
        +--> web editor and authenticated HTTP API
        |
        +--> tags and bidirectional links
        |
        +--> plugins and CLI commands
        |
        v
search engine: Elasticsearch or ripgrep
\`\`\`

There are two search choices. Elasticsearch offers richer indexing and search features but introduces another service to operate. Ripgrep searches the local Markdown tree directly. It is much lighter and may be enough for an individual or a small repository of runbooks.

This is an intentionally different trade-off from a warehouse catalogue or an agent-memory system. Archivy does not inspect a dbt DAG, enforce a data contract, or automatically decide what an agent may do. It gives a team a durable, searchable place to explain and connect those things.

## Why file-backed knowledge matters for data teams

Most documentation platforms make editing easy and extraction awkward. Data teams often need the reverse at inconvenient times: an incident occurs, an API disappears, a vendor changes access, or an agent needs an approved procedure inside a controlled environment.

File-backed notes help in a few concrete ways:

| Need | File-backed benefit |
| --- | --- |
| Review a change to a data definition | Use Git diff and pull-request review on the Markdown source |
| Rebuild search | Re-index files rather than restore a proprietary document store |
| Link code, SQL, and decisions | Keep stable relative links beside the explanation |
| Preserve a provider article or API guide | Save a bookmark copy instead of relying only on a live URL |
| Give an agent safe context | Retrieve approved notes and source links, not an unbounded chat history |

The last point has a boundary. A note is not live data. An agent can use a documented runbook to decide which mart to query, but it should query the mart or tool for current values. Knowledge tells the system how to operate; the data platform supplies the current evidence.

## A real data engineering knowledge model

Do not begin by dumping every document into one folder. Give each class of operational knowledge a predictable home and a small metadata contract.

\`\`\`text
data-knowledge/
  contracts/
    market-price-ingestion.md
  lineage/
    daily-market-price-mart.md
  runbooks/
    provider-freshness-alert.md
  incidents/
    2026-08-31-coinbase-stale-price.md
  decisions/
    use-median-price-with-disagreement-threshold.md
  bookmarks/
    provider-api-rate-limit-policy.md
\`\`\`

An Archivy note can carry enough structure to be useful in a search result:

\`\`\`yaml
---
title: "Provider freshness alert: BTC/USDT"
type: note
tags: [runbook, market-data, freshness, production]
owner: data-platform
service: market-ingestion
severity: high
review_after: 2026-11-30
related_models:
  - stg_market_price
  - mart_daily_btc_usdt_price
---
\`\`\`

Archivy's native fields are intentionally small. Extra fields such as \`owner\`, \`service\`, and \`review_after\` are a team convention. That is fine, provided the convention is documented and validated. A lightweight plugin can add metadata fields, run a review command, or create a web form for a standard incident template.

## Use case 1: make a data contract readable during an outage

Imagine that one provider changes a \`last_price\` field from a numeric string to an object. The ingestion job starts producing parse errors. The on-call engineer needs more than a stack trace.

An Archivy contract note can capture:

- the provider endpoint and expected payload shape;
- the canonical internal fields and type conversions;
- acceptable freshness and disagreement thresholds;
- the raw-response retention location;
- owners and escalation path;
- links to the extractor, dbt source, staging model, and quality dashboard.

\`\`\`markdown
## Expected input

\`last_price\` is a decimal string such as \`"113250.12"\`.

## Failure policy

If the field is absent or has another type, retain the raw payload, mark
\`parse_status = 'invalid'\`, and prevent the value from reaching the daily mart.

## Investigation

1. Query \`get_raw_response_status(response_id)\`.
2. Compare the payload with the contract version above.
3. Create an incident note and link the provider announcement.
\`\`\`

The note does not execute the policy. It makes the policy findable when the person debugging needs it. That is often the difference between a contained schema drift and a convenient but dangerous cast-to-null workaround.

## Use case 2: record lineage that survives the team

Warehouse lineage tools can show that \`mart_daily_btc_usdt_price\` depends on \`stg_market_price\`. They often do not explain why the mart uses a median, why it excludes stale providers, or who approved a threshold change.

Create a lineage note that combines machine links with human meaning:

\`\`\`text
raw_price_response
  -> stg_market_price
  -> fct_price_disagreement
  -> mart_daily_btc_usdt_price
\`\`\`

For each transition, link the model and state the business rule. Then link the decision record that introduced it. A person investigating a changed number can trace both the code path and the reasoning path.

This also helps agents. Instead of asking an agent to search the whole repository for "why is this number different?", give it a read-only \`search_knowledge\` tool that returns the lineage note and a documented mart tool that returns the current rows. The agent gets context and evidence through separate contracts.

## Use case 3: preserve external evidence for later review

Archivy bookmarks save webpage content into the knowledge repository. For data engineering, this is useful for sources that frequently vanish or change without a clear changelog:

- an exchange API's rate-limit policy;
- a provider's field-definition page;
- a cloud warehouse's breaking-change notice;
- a regulator's data-retention guidance;
- a vendor blog post explaining a deprecation.

Keep the bookmark beside a short note that states how the team applied it. The saved page is the reference; the note is the local decision. Date both. A preserved copy does not prove that the provider has not changed its policy since then, so schedule review for facts that affect production behaviour.

## Use case 4: turn recurring incidents into maintained runbooks

An incident note should start with raw facts: timestamps, affected datasets, failed checks, queries used, and a resolution. After the incident, extract the reusable procedure into a runbook and link the two documents.

\`\`\`text
incident: Coinbase price was 18 minutes stale
  -> source facts and timeline
  -> decision: do not publish stale observations
  -> runbook: provider freshness alert
  -> contract: market-price ingestion schema
\`\`\`

Bidirectional links are valuable here. A runbook can point to the incidents that proved it necessary. An incident can point to the runbook that should have prevented or shortened it. The result is a knowledge graph built from ordinary files, not an undocumented collection of similar pages.

## Search is a workflow, not a homepage feature

Archivy supports Elasticsearch and ripgrep, but a team still needs search habits. Search names, identifiers, tags, and failures differently.

| Question | Search starting point |
| --- | --- |
| "What is \`mart_daily_btc_usdt_price\`?" | Model name and \`lineage\` tag |
| "Why did this threshold change?" | Decision ID, incident tag, and date |
| "How do I handle HTTP 429?" | Provider name, \`runbook\`, and \`rate-limit\` tag |
| "Which notes are owned by data platform?" | \`owner\` front-matter convention or team tag |
| "What changed after a vendor notice?" | Bookmark title plus linked decision and contract |

With Elasticsearch, treat the index as an operational dependency: monitor its health, secure its credentials, and define a re-index procedure. With ripgrep, accept the simpler feature set and keep filenames, headings, and tags disciplined. The right engine depends on scale and retrieval needs, not on which sounds more advanced.

## Extending Archivy for data workflows

Archivy plugins are Python packages that add commands to the CLI. Its web interface can expose those commands as interactive forms. The project also has an authenticated HTTP API, which makes a small integration feasible without scraping the UI.

Three small extensions have a clear payoff:

| Extension | What it should do |
| --- | --- |
| \`archivy data-contract check\` | Validate required front matter, known model names, owners, and review dates |
| \`archivy incident create\` | Create an incident note from a template with run ID, dataset, severity, and links |
| \`archivy lineage refresh\` | Import a bounded dbt manifest summary and update links without overwriting human explanations |

Keep the import one-way and reviewable. A dbt manifest can provide model dependencies; it cannot explain why a rule exists. Let the plugin update a generated section or propose a diff, while people retain ownership of the narrative, policy, and incident learning.

## What Archivy does not replace

Archivy is not a data catalogue, an orchestrator, a warehouse, or an observability platform.

| System | Its job | Archivy's complementary role |
| --- | --- | --- |
| dbt | Transform and test data models | Explain model intent, decisions, and operational procedure |
| Data catalogue | Discover datasets and enforce governance metadata | Preserve human-readable contracts and evidence links |
| Orchestrator | Schedule and retry pipeline work | Store runbooks and post-incident learning |
| Observability tool | Detect freshness, volume, and schema anomalies | Document thresholds, ownership, and response steps |
| Agent harness | Run model-tool loops and permissions | Supply approved, curated knowledge to bounded retrieval tools |

This distinction prevents documentation from becoming a shadow production system. The source of truth for a current row count is the warehouse or observability service. The source of truth for how the team interprets and responds to that row count can be a reviewed Archivy note.

## A sensible adoption path

Start with one workflow that already causes repeated questions. Provider schema drift is a good candidate.

1. Create one contract note, one runbook, one lineage note, and one incident template.
2. Put the Markdown data directory under version control if the team is comfortable doing so.
3. Choose ripgrep for a low-operations first deployment; introduce Elasticsearch when search requirements justify it.
4. Add a small front-matter validation command to CI.
5. Link each note from the dbt model, dashboard, or alert that needs it.
6. Review notes after incidents and mark stale material with a review date.

Do not migrate every Slack thread. Capture the information that affects repeated decisions, quality, and recovery. The point is not to have more notes. It is to make the next correct action easier to find.

## Archivy and local agent memory

Archivy's file-backed approach also makes it a useful source for agent memory, but it should not be injected wholesale. A safe integration retrieves only approved notes within a project and role scope, includes the source path and revision, and gives the agent tools for live data separately.

That fits the same pattern as a durable agent-memory system: raw evidence stays traceable, knowledge is curated, interfaces are stable, and failure paths are testable. Archivy contributes the human-readable, file-native part of that system.

## References

- [Archivy repository](https://github.com/archivy/archivy)
- [Archivy architecture reference](https://github.com/archivy/archivy/blob/master/docs/reference/architecture.md)
- [Archivy filesystem layer reference](https://github.com/archivy/archivy/blob/master/docs/reference/filesystem_layer.md)
- [Archivy usage documentation](https://github.com/archivy/archivy/blob/master/docs/usage.md)
- [Archivy plugins documentation](https://github.com/archivy/archivy/blob/master/docs/plugins.md)
- [dbt documentation](https://docs.getdbt.com/)
- [Data Engineering in 30 Days, Day 23-24: Observability and data quality](/posts/2026-08-17-data-engineering-day-23-24-data-observability-quality)
- [TencentDB Agent Memory and Strata Memory](/posts/2026-08-26-tencentdb-agent-memory-vs-strata-memory)
`;export{e as default};