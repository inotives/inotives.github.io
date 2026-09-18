var e=`---
title: "Data Engineering in 30 Days, Days 3–4: Files, Formats, and the First Trust Checks"
date: 2026-08-10
tags: [data-engineering, learning-path, csv, json, parquet]
summary: "Learn how CSV, JSON, and Parquet represent data, where each format fits, and the first checks to run before loading a file into a pipeline."
series: data-engineering-in-30-days
---

Most data pipelines begin with an unglamorous object: a file. It may be a CSV sent by finance, a JSON response from an API, or a Parquet partition written by another system. The format affects what information survives, how fast the data can be read, and how easily a bad record can hide.

Days 3 and 4 are about reading files with suspicion. A file that opens is not necessarily a file that means what you think it means.

We will continue the market-data example from Days 1–2. A collector fetches exchange prices and needs to preserve the source, standardise the records, and eventually serve historical analysis.

## The outcome for these two days

By the end, you should be able to:

1. Explain when CSV, JSON, and Parquet are useful.
2. Inspect a file before assuming its schema is correct.
3. Recognise missing values, type errors, duplicate records, and timestamp ambiguity.
4. Choose a raw and analytical representation for a small pipeline.

## 1. A format makes trade-offs

There is no universal “best” data format. Each format optimises for a different job.

| Format | Best at | Weak at | Common use |
| --- | --- | --- | --- |
| CSV | Simple flat tables that humans can open anywhere. | Types, nested data, escaping rules, and large analytical scans. | A business export or a small data handoff. |
| JSON | Flexible records and nested API responses. | Consistent schemas and efficient column-wise analysis. | Raw API payloads, events, and application integration. |
| Parquet | Large, typed, analytical datasets. | Human inspection and ad-hoc manual editing. | Warehouse exports, lakehouse tables, and long-term analytical storage. |

The format does not define the data contract. It only gives the contract a container. A CSV column called \`price\` is still ambiguous until you know its currency, precision, and observation time.

## 2. CSV: simple text, complicated edges

CSV stands for comma-separated values. It usually represents a flat table, one row per line:

\`\`\`csv
provider,symbol,price,observed_at
Binance,BTC/USDT,118450.25,2026-08-10T09:00:00Z
Kraken,XBT/USD,118425.10,2026-08-10T09:00:01Z
\`\`\`

CSV is useful because it is transparent. A human can open it in a text editor, spreadsheet, or database tool. It is a reasonable choice for a small daily report or a one-time export.

Its weakness is that it has almost no type system. These values all arrive as text until the reader decides otherwise:

\`\`\`csv
provider,symbol,price,observed_at
Binance,BTC/USDT,118450.25,2026-08-10T09:00:00Z
Binance,BTC/USDT,N/A,10/08/2026 09:05
Binance,BTC/USDT,"118,500.00",2026-08-10 09:10:00
\`\`\`

Is \`10/08/2026\` 10 August or 8 October? Is \`N/A\` missing data or a source error? Is \`118,500.00\` a quoted number or two columns because a writer did not escape it? CSV does not answer.

### Real-life application: a finance export

Finance may send a daily CSV of settled transactions. Before loading it, check the delimiter, header names, encoding, row count, duplicate transaction IDs, amount format, currency, and date convention. A report that contains \`1,234.56\` in one country and \`1.234,56\` in another can silently create a hundredfold error if it is parsed with the wrong locale.

Treat CSV as a communication format. Keep the original file, document the expected columns, and convert it to typed tables before doing business logic.

## 3. JSON: close to what an API actually says

JSON represents objects and lists. It is common because APIs and applications naturally produce nested records:

\`\`\`json
{
  "provider": "binance",
  "serverTime": 1786352400000,
  "prices": [
    {"symbol": "BTCUSDT", "lastPrice": "118450.25"},
    {"symbol": "ETHUSDT", "lastPrice": "3850.10"}
  ]
}
\`\`\`

JSON preserves structure that CSV struggles with. The list of prices belongs to one response, and the source can add optional fields without rewriting every consumer on day one. That makes JSON a good raw representation for an API response.

Flexibility is also the problem. One provider may return \`lastPrice\` as a string, another as a number, and a third may omit it during a maintenance window. A nested field might be absent, \`null\`, an object, or a list. Parsing succeeded does not prove the data is valid.

### Real-life application: preserving an exchange response

For a collector, store the received JSON response before flattening it:

\`\`\`text
raw_exchange_response
├── provider: binance
├── received_at: 2026-08-10T09:00:02Z
├── request_url: /api/v3/ticker/price
├── status_code: 200
└── payload: original JSON bytes
\`\`\`

Later, if a market looks wrong, you can answer two separate questions: “what did the exchange send?” and “how did our transformation interpret it?” Without the raw response, an engineer is left guessing whether the defect came from the provider, the parser, or a later model.

Do not turn raw JSON into a dumping ground. Attach useful metadata such as source, receipt time, request identifier, and schema version when available. Protect it when it contains personal or confidential data.

## 4. Parquet: a format for asking many questions of a lot of data

Parquet is a binary, columnar file format. Instead of storing every field of one row together, it stores values from the same column together. That makes many analytical queries cheaper because they can read only the columns they need.

Suppose a year of price observations has these columns:

\`\`\`text
provider | symbol | observed_at | price | volume | raw_response_id
\`\`\`

An analyst calculating the average daily BTC price needs \`symbol\`, \`observed_at\`, and \`price\`. A Parquet reader can skip the large raw-response reference and volume columns. The file also keeps types and supports compression better than plain CSV.

Parquet is usually not the first format a source gives you. It is a format you choose after standardising data for analysis. A sensible small pipeline might look like this:

\`\`\`text
API response as JSON → raw JSON archive → cleaned typed table → Parquet partitions by date
\`\`\`

### Real-life application: daily research data

An internal research team needs two years of hourly prices across many providers. Keeping the cleaned observations in Parquet by date lets a notebook or DuckDB query read a week of data without scanning the entire history. It also makes the dataset portable: a new environment can download typed files without connecting to a production database.

Parquet is not magic. Poor partition choices, tiny files, duplicate records, or a vague schema will remain poor data in a more efficient container.

## 5. Inspect before you transform

Before writing a transformation, make a small profile of every incoming file or response. The exact tool can be a spreadsheet, SQL, Python, DuckDB, or a data-quality framework. The questions stay the same.

| Check | Why it matters | Market-data example |
| --- | --- | --- |
| Shape | Confirms the expected records and nesting exist. | Did the API return an error object instead of a price list? |
| Column names | Finds renamed, missing, or unexpected fields. | Did \`lastPrice\` become \`price\`? |
| Types | Prevents text, numbers, and dates from being mixed blindly. | Is price always parseable as a decimal? |
| Nulls | Separates an allowed absence from an upstream failure. | Is symbol ever missing from a ticker record? |
| Uniqueness | Finds repeated deliveries or an incorrect key. | Did the collector store the same minute twice? |
| Range | Catches values that are valid types but implausible facts. | Is BTC price negative or zero? |
| Time | Detects stale, future, and ambiguous timestamps. | Is an event time later than the receipt time by a day? |

Here is a deliberately small SQL-style check after loading cleaned observations:

\`\`\`sql
SELECT
  count(*) AS rows_loaded,
  count(*) FILTER (WHERE price IS NULL OR price <= 0) AS invalid_prices,
  count(*) FILTER (WHERE observed_at > received_at + interval '5 minutes') AS suspicious_times,
  count(*) - count(DISTINCT (provider, symbol, observed_at)) AS duplicate_keys
FROM price_observation;
\`\`\`

This does not certify correctness. It gives a fast signal that tells you where to look. If \`duplicate_keys\` rises after a retry, the ingestion design may need idempotent writes. If \`suspicious_times\` rises only for one provider, the source may have changed its timestamp unit from seconds to milliseconds.

## 6. Missing data has several meanings

An empty field can mean more than one thing:

| What you see | Possible meaning | Safe response |
| --- | --- | --- |
| \`null\` | The source knows the value is absent. | Preserve it and document whether it is allowed. |
| Empty string | The source supplied a blank value. | Standardise it explicitly; do not assume it equals \`null\`. |
| Missing field | The source did not send the field. | Record a schema-change signal. |
| Missing row | No record arrived at all. | Measure freshness and expected volume. |
| Zero | A genuine zero, or a source's placeholder for unknown. | Check the source contract before treating it as a fact. |

The last case is a frequent production problem. A zero trading volume may mean a quiet market. It may also mean the provider’s volume endpoint failed. If the pipeline silently coalesces missing values to zero, downstream analysis can claim a market had no activity when the system simply did not know.

## A small exercise for day 4

Find one CSV or JSON file. It can come from your earlier source, a public dataset, or an API response saved to disk. Make a short inspection report:

\`\`\`text
Format and encoding:
Expected grain:
Expected key:
Number of records:
Fields and inferred types:
Required fields with null counts:
Duplicate-key count:
Oldest and newest event time:
One value that needs a business definition:
One failure the source could produce:
\`\`\`

Then choose where each version belongs:

\`\`\`text
Original response or export: raw retention
Cleaned, typed records: database table or Parquet
Business-ready summary: analytical mart
\`\`\`

The exercise is successful if you find one uncertainty. A data engineer's first instinct should be “what would make this wrong?” rather than “how quickly can I load it?”

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Delimited file | A text file whose fields are separated by a character such as a comma or tab. | \`Explain CSV delimiters, quoting, and escaping with three broken examples from a finance export.\` |
| Encoding | The rule that turns file bytes into text characters. | \`Teach UTF-8, encoding errors, and byte-order marks using a CSV with customer names from several languages.\` |
| JSON object | A named collection of values inside JSON. | \`Explain JSON objects and arrays using an exchange ticker response. Show how to flatten one array into rows.\` |
| Nested data | Values inside objects or lists rather than one flat row. | \`Show three ways to model nested JSON order data in relational tables. Explain the trade-offs.\` |
| Columnar format | A format that groups values by column for analytical reads. | \`Explain why Parquet is columnar using a table with ten columns and a query that only needs two.\` |
| Compression | Reducing storage bytes while retaining the data. | \`Compare gzip compression for CSV with Parquet compression. When does each help and what remains unchanged?\` |
| Partition | A deliberate division of data into manageable groups, often by date. | \`Explain date partitioning for hourly price data. Show a good partition choice and a bad tiny-file design.\` |
| Schema inference | Guessing types and fields from observed data. | \`Explain why schema inference can fail when the first 100 CSV rows have integers but later rows have decimals.\` |
| Data profiling | Measuring shape, types, nulls, ranges, and distributions before use. | \`Give me a beginner data-profiling checklist for a price CSV and explain what each failed check would mean.\` |
| Idempotency | A repeatable operation whose repeated execution leaves the correct result unchanged. | \`Explain idempotent file ingestion using a collector that retries after a network timeout.\` |

Add your own file name, fields, and source behaviour to each prompt. An LLM can help you reason through the format, but it cannot tell you whether your provider's undocumented zero means “zero” or “unknown.” Check the source contract and retain the evidence.

## What comes next

Days 5–7 move into SQL: selecting data, filtering it, grouping it, joining it, and using window functions without losing the table's grain. Files give a pipeline its input. SQL gives the input a useful shape.

## References

- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180)
- [JSON specification](https://www.json.org/json-en.html)
- [Apache Parquet documentation](https://parquet.apache.org/docs/)
- [DuckDB documentation: reading and writing files](https://duckdb.org/docs/stable/data/overview.html)
`;export{e as default};