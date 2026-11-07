---
title: "Good duplication: why each ingestion pipeline should own its types"
date: 2026-11-07
tags: [data-engineering, data-ingestion, data-pipelines, data-contracts, schema-drift, medallion-architecture, dbt]
summary: "Data teams like to reuse ingestion code through shared contracts and generator base classes. At the ingestion layer I'd rather not. Sources change their types, API versions and schemas whenever they like, and a shared contract turns one vendor's change into a release for every pipeline that uses it. This note argues for letting each pipeline own its own typing, sharing only the plumbing, and keeping contracts for the modeling layers where you control the schema."
---

Most data platforms I've worked on pull from a mix of sources: the company's own databases, a few vendor APIs, CSV drops on an SFTP server, maybe an event stream. The usual design is to land everything in a **raw** layer exactly as it arrived, then shape it through **staging → intermediate → mart**. If you prefer the medallion names, that's **bronze → silver → gold**. Same idea.

Once there are ten or twenty of these pipelines, someone (often me, earlier in my career) notices that they look alike. They all call an API or query a table, parse records, cast types and write rows. So we build a `BaseIngestor`, a shared `Transaction` schema, maybe a generator that stamps out pipelines from a config file. Less code, one place to fix bugs.

For the ingestion layer, I now think that's the wrong trade. I'd rather each pipeline own its own types, even though it means a lot of code that looks duplicated. It's good duplication, and this note explains why.

## The layers, and where ingestion ends

![Four kinds of source, an internal database, a vendor API, CSV files over SFTP and an event stream, land in a raw (bronze) layer as-is, then move through staging (silver), intermediate (silver) and mart (gold). Sources, raw and staging are the ingestion side, one pipeline per source. Intermediate and mart are the modeling side with shared, stable contracts.](/assets/images/ingestion-isolation-layers.svg)

The layers each have a job:

- **Raw (bronze)** keeps the source data intact. Append only, no reshaping, plus a few load columns: when it landed, which file or API call it came from, which API version. If anything downstream goes wrong, you can replay from here.
- **Staging (silver)** is one model per source table. Rename columns, cast types, dedupe. This is where a source's quirks get absorbed. dbt's own [project structure guide](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview) keeps staging strictly one-to-one with sources for this reason.
- **Intermediate (silver)** joins sources together and applies business logic.
- **Mart (gold)** holds the facts and dimensions people actually query.

The split that matters for this argument is the line between staging and intermediate. On the left, everything is shaped by a source you don't control. On the right, the schema is yours: you decide when it changes.

## The pull towards a shared contract

Here's the kind of code the reuse instinct produces:

```python
class Transaction(BaseModel):  # shared by vendor A, vendor B and the internal ledger
    id: str
    amount: Decimal
    currency: str
    created_at: datetime

class BaseApiIngestor(Generic[T]):
    schema: type[T]

    def run(self) -> list[T]:
        return [self.schema(**row) for row in self.extract()]

class VendorAIngestor(BaseApiIngestor[Transaction]): ...
class VendorBIngestor(BaseApiIngestor[Transaction]): ...
```

It looks tidy. Three sources describe "a transaction", so they share one type. A new vendor is a ten-line subclass.

The trouble is that `Transaction` is now a contract between you and three parties who have never heard of it. Vendor A didn't agree to send `amount` as a decimal. It just happened to, until it didn't.

## Why it breaks at the ingestion layer

![Vendor A moves to API v3 and sends amount as a string. The shared Transaction contract has to change from v1 to v2 and the base ingestor gets a v3 branch, so all four pipelines below it must be re-tested and released, and one of them breaks on a string amount.](/assets/images/ingestion-isolation-shared-contract.svg)

Sources change on their schedule, not yours. In a normal year I see all of these:

- A vendor ships API v3. `amount` becomes `"12.50"`, a string, because their new gateway serialises everything as text.
- A field gets renamed, split in two, or nested one level deeper.
- An internal team adds a nullable column, or changes an `int` id to a UUID during a migration.
- A CSV export gains a column in the middle, so positional parsing shifts by one.
- Timestamps switch from local time to UTC with no notice.

With a shared contract, each of these is a change to code that every pipeline imports. You widen `amount` to `Decimal | str`, or add a v3 branch to the base class. Now Vendor B and the ledger pipeline are running new code too. They need re-testing, and a redeploy. If one of their downstream models assumed `amount` was always numeric, it breaks, even though nothing about Vendor B changed.

Data contracts are a good idea where both sides agree to them. At ingestion, only one side agreed. The source never signed anything, so the contract is weak exactly where the types change most often. Every update to it fans out to every consumer, and you either handle the change everywhere or something breaks somewhere.

The other cost is slower. After a year, the base class is full of `if source == "vendor_a" and version >= 3:`. Sandi Metz called this [the wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction): code that once captured a real shared shape, then grew parameters and conditionals for each caller until nobody dares touch it. Her line is that duplication is far cheaper than the wrong abstraction. Ingestion is where I see that happen most.

## One pipeline, one set of types

![The same four sources, each with its own pipeline holding its own schema and parser, landing into its own raw table. Vendor A's change only touches Pipeline A. Pipelines B, C and D are untouched. All four sit on shared plumbing with no business types.](/assets/images/ingestion-isolation-per-pipeline.svg)

The alternative is to let each pipeline describe its source in its own words:

```
pipelines/
  vendor_a/
    schema.py      # VendorATransaction, matches the v3 payload exactly
    parse.py
    pipeline.py
  vendor_b/
    schema.py
    parse.py
    pipeline.py
  ledger/
    ...
common/
  http.py          # client, retries, backoff
  raw_writer.py    # append to raw + load metadata
  secrets.py
```

```python
# pipelines/vendor_a/schema.py
class VendorATransaction(BaseModel):
    txn_id: str
    amount: str          # v3 sends "12.50"; cast in staging, not here
    ccy: str
    created: datetime
    api_version: Literal["v3"] = "v3"
```

Vendor B has its own `VendorBTransaction` with its own field names. Yes, both have an amount, a currency and a timestamp. That similarity is a coincidence of the domain, not a shared dependency. When Vendor A moves to v3, you edit `vendor_a/` and release `vendor_a/`. Nothing else is in the diff, nothing else gets redeployed, and nothing downstream of Vendor B can notice.

Two habits make this work well:

- **Keep raw loose.** Land the payload close to how it arrived: a JSON or variant column, or strings for a CSV. Then a type change in the source can't fail the load and lose a day of data. The pipeline's typing is applied in staging, where a failure is a failed model you can fix and re-run from raw.
- **Be a tolerant reader.** Parse the fields you use and ignore the rest, as in Martin Fowler's [Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html). A vendor adding five new fields then costs you nothing.

## Good duplication, bad duplication

![One question sorts the code: does it change when the vendor changes? If not, share it: auth and secrets, the HTTP client with retries, rate limiting, the raw writer, logging, scheduling. If it does, copy it per pipeline: field names and types, parsing rules, API version and endpoints, pagination quirks, null handling, dedup keys.](/assets/images/ingestion-isolation-share-vs-duplicate.svg)

This doesn't mean copying everything. The test I use is one question: **does this code change when the vendor changes?**

If it doesn't, share it. An HTTP client with retries and backoff, secrets handling, rate limiting, the writer that appends to raw and stamps load metadata, logging, scheduling. None of these know what a transaction is, and a bug fixed there should be fixed for every pipeline at once.

If it does, keep a copy per pipeline. Field names and types, casting rules, endpoints and API versions, pagination quirks, how nulls and defaults are handled, which columns form the key. This code describes one source, so it should live next to that source and change with it.

The duplicated part is cheap to keep, because most of it is declarative: a schema class and a handful of casts. Reading `vendor_a/schema.py` tells you exactly what Vendor A sends today, with no inheritance chain to walk. And when one pipeline's copy needs to change, you change one copy on purpose, instead of changing one shared thing and hoping.

## Where contracts do belong

None of this is against data contracts. It's about where to put them. Once staging has turned each source into clean, typed rows, the intermediate and mart layers are yours. You decide when `fct_transactions` changes, you can version it, and you can tell the BI team and the ML team ahead of time. That's a two-sided agreement, which is what a contract needs. Specs like the [Data Contract Specification](https://datacontract.com/) fit well at that boundary.

So the shape I aim for is: **isolated, self-typed pipelines up to staging; shared contracts from intermediate onwards.** The messy, fast-changing edge gets small blast radii. The stable core gets the reuse and guarantees.

Each pipeline on the ingestion side carrying its own types will look repetitive in a code review. I'm fine with that. What it buys is that when a vendor changes something on a Tuesday afternoon, one pipeline needs a fix and every other pipeline keeps running.

## References

- [How we structure our dbt projects](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview), dbt Labs: staging, intermediate and mart layers
- [Medallion architecture](https://www.databricks.com/glossary/medallion-architecture), Databricks: bronze, silver and gold
- [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction), Sandi Metz
- [Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html), Martin Fowler
- [Data Contract Specification](https://datacontract.com/)
