var e=`---
title: "Data Engineering in 30 Days, Days 8–10: The Python Toolkit for Pipelines"
date: 2026-08-10
tags: [data-engineering, learning-path, python, pandas]
summary: "The Python tools data engineers use every day: standard-library building blocks for files, JSON, CSV, time, decimals, iteration, logging, and database-safe glue, followed by the external packages worth learning first."
series: data-engineering-in-30-days
---

Data engineers use Python to connect systems, not to show off language features. SQL should remain the place where relational transformations are clear and reviewable. Python earns its place around that SQL: call an API, retain a raw payload, validate input, move files, load a database, emit a useful log, and fail safely.

Days 8–10 are a toolkit tour, not a Python course. The aim is to recognise which standard-library tool or package fits a daily data task, then learn it in context.

We will extend the market-data pipeline. A small Python job fetches provider data, stores the original response, produces typed records, and loads them for SQL to model.

## The outcome for these three days

By the end, you should be able to:

1. Choose native Python tools for common file, JSON, CSV, time, and logging work.
2. Explain when \`map\`, comprehensions, generators, and \`Decimal\` help in a pipeline.
3. Recognise the external libraries most often used for HTTP, tables, Parquet, databases, validation, and testing.
4. Keep a small ingestion script understandable, repeatable, and honest about failure.

## 1. Keep the script's job narrow

A good first ingestion script has a short, visible flow:

\`\`\`text
fetch source → retain raw response → parse records → validate essentials → load rows → log result
\`\`\`

Each arrow is a boundary where something can fail. The script should make those boundaries visible rather than burying them in one large function.

For the exchange example, the script does **not** calculate daily returns, merge every provider's business rules, or serve a dashboard. Those are database transformations and downstream models. Its job is to reliably turn one source response into evidence and typed rows.

## 2. Native Python tools to learn first

Start with the standard library. It is installed with Python, stable, and covers more daily pipeline work than many people expect.

| Tool | What it is for | Data-engineering use |
| --- | --- | --- |
| \`pathlib.Path\` | Safe, readable file paths. | Create a date-partitioned raw-data path. |
| \`json\` | Decode and encode JSON. | Save and parse an API response. |
| \`csv\` | Read and write delimited files correctly. | Import a supplier's daily CSV without hand-splitting commas. |
| \`datetime\` and \`zoneinfo\` | Represent instants, dates, and time zones. | Separate a provider's event time from the job's receipt time. |
| \`decimal.Decimal\` | Exact base-10 decimal arithmetic. | Preserve prices and amounts without binary float surprises. |
| \`collections\` | Useful containers such as \`Counter\` and \`defaultdict\`. | Count source records by symbol or group validation errors. |
| \`itertools\` | Iteration helpers for streams and batches. | Process a large input in fixed-size chunks. |
| \`logging\` | Structured operational messages. | Record row counts, retries, and a source request ID. |
| \`sqlite3\` | A small database included with Python. | Prototype a local ingestion flow or maintain a lightweight checkpoint. |
| \`typing\` and \`dataclasses\` | Describe expected values and small records. | Make a parsed observation's required fields visible. |

Do not add a package merely to wrap one of these tools. A dependency is an operational responsibility: versioning, security updates, installation, and a new failure surface.

### \`pathlib\`: file names are part of the data design

Avoid constructing paths by hand with string concatenation. \`Path\` makes the intent clear:

\`\`\`python
from datetime import datetime, timezone
from pathlib import Path

received_at = datetime.now(timezone.utc)
raw_path = (
    Path("data/raw/binance")
    / received_at.strftime("%Y/%m/%d")
    / f"ticker-{received_at:%H%M%S}.json"
)
raw_path.parent.mkdir(parents=True, exist_ok=True)
\`\`\`

The date path is more than neat organisation. It gives an operator a predictable place to inspect a particular day's source evidence. In production, a data lake or object store may replace the local directory, but date- and source-oriented partitioning remains a useful idea.

### \`json\` and \`csv\`: use parsers, never string splitting

Use \`json\` to preserve and decode JSON, and \`csv.DictReader\` for CSV with headers:

\`\`\`python
import csv
import json
from pathlib import Path

payload = {"symbol": "BTCUSDT", "lastPrice": "118450.25"}
Path("ticker.json").write_text(json.dumps(payload), encoding="utf-8")

with Path("supplier_prices.csv").open(newline="", encoding="utf-8") as handle:
    for row in csv.DictReader(handle):
        print(row["symbol"], row["price"])
\`\`\`

\`newline=""\` is intentional. It lets the CSV module handle platform-specific newlines and quoted fields correctly. \`line.split(",")\` fails as soon as an address, description, or number contains a valid comma inside quotes.

### Time: use aware datetimes and keep both clocks

Use time-zone-aware datetimes for instants. \`datetime.now(timezone.utc)\` gives a UTC-aware receipt time. A provider's event time may need parsing from an ISO timestamp or a Unix epoch.

\`\`\`python
from datetime import datetime, timezone

event_time = datetime.fromtimestamp(1786352400, tz=timezone.utc)
received_at = datetime.now(timezone.utc)
\`\`\`

Do not compare a naive \`datetime\` with an aware one, and do not use local server time as a substitute for an event timestamp. Earlier in this series, we separated \`observed_at\` from \`received_at\`; Python should preserve that distinction rather than flatten it.

### Money and measurements: \`Decimal\`, not casual floats

Binary floating-point is fast and appropriate for many scientific calculations. It cannot represent many decimal fractions exactly. For prices, balances, tax, and currency amounts, parse source strings into \`Decimal\`:

\`\`\`python
from decimal import Decimal

price = Decimal("118450.25")
fee = Decimal("0.1")
total = price + fee
\`\`\`

The practical rule is simple: keep financial values exact at ingestion and in database numeric types. Convert to a display-friendly float only at a boundary where small representation differences are acceptable.

### \`map\`, comprehensions, and generators: choose the clearest iteration

These tools all transform or filter collections. Use the form that makes the intent obvious.

\`\`\`python
symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

# map: apply one simple function to each item
normalised = list(map(str.upper, symbols))

# comprehension: transform and filter when the rule is easy to read
usd_symbols = [symbol for symbol in symbols if symbol.endswith("USDT")]

# generator expression: produce values one at a time for a large stream
prices = (row["lastPrice"] for row in payload_rows)
\`\`\`

For a small list, use whichever is clearest to the team. For a large file, a generator can avoid loading every record into memory at once. Do not turn every loop into \`map\`; a normal \`for\` loop is often the best place for validation, logging, and an explicit failure policy.

### Logging: write evidence for the person on call

\`print()\` helps while learning. \`logging\` is for an operated script because it records levels, timestamps, and context consistently.

\`\`\`python
import logging

logger = logging.getLogger(__name__)

logger.info(
    "loaded observations",
    extra={"provider": "binance", "row_count": 214, "request_id": "abc-123"},
)
\`\`\`

Log counts and identifiers, not raw secrets or entire sensitive payloads. A useful run log answers: which source ran, which time range was processed, how many records were accepted or rejected, and why a retry happened.

## 3. External packages that earn their place

Once the standard library no longer covers the job cleanly, add packages deliberately. This is a practical first list, not a requirement to learn all of them in three days.

| Package | Learn it for | Use it when | Avoid it when |
| --- | --- | --- | --- |
| \`requests\` or \`httpx\` | HTTP APIs, timeouts, headers, retries. | Calling REST APIs from a batch job. | A source already provides files or a maintained connector. |
| \`numpy\` | Fast homogeneous numeric arrays and vectorised calculations. | A numerical transform, simulation, or library API works with arrays. | You need named columns, relational joins, or financial-decimal precision. |
| \`pandas\` | In-memory tables, inspection, cleanup, and quick analysis. | A dataset fits comfortably in memory and the transformation is local. | The job is a large relational transformation that belongs in SQL. |
| \`pyarrow\` | Parquet, Arrow types, and efficient columnar interchange. | Reading or writing Parquet and working with typed analytical files. | You only need a tiny CSV once. |
| \`polars\` | Fast, expressive local DataFrame processing. | Medium-to-large local files where a DataFrame is still appropriate. | The team already standardises on pandas and performance is fine. |
| \`SQLAlchemy\` | Database connections and SQL execution interfaces. | An application or reusable loader needs database portability. | A small, database-specific script is clearer with its native driver. |
| \`psycopg\` | PostgreSQL connections and PostgreSQL-specific capabilities. | Loading or querying PostgreSQL directly. | Your destination is not PostgreSQL. |
| \`pydantic\` | Parsing and validating structured input at boundaries. | An API has nested records and a clear input contract. | A one-field conversion is simpler with direct checks. |
| \`pytest\` | Repeatable automated checks. | A parser, transformation, or loader has behaviour worth protecting. | There is no logic beyond a trivial one-off command. |

\`requests\` and \`httpx\` deserve one early habit: set a timeout. A request without one can wait forever and occupy a worker that looks healthy from the outside.

\`\`\`python
import requests

response = requests.get(
    "https://api.example.com/ticker",
    timeout=(5, 30),
)
response.raise_for_status()
payload = response.json()
\`\`\`

This is only the start of reliable HTTP handling. A production loader also decides retryable status codes, rate limits, idempotency keys, backoff, and how to retain failed responses. For Days 8–10, learn to distinguish a network failure from a valid response that contains bad data.

### NumPy is the numerical layer, not the data model

NumPy provides efficient arrays of values with one shared type. Many data-science and DataFrame libraries build on it. Learn enough to recognise vectorised operations and array shape, even if most of your day-to-day data engineering stays in SQL or pandas.

\`\`\`python
import numpy as np

prices = np.array([118400.0, 118450.0, 118300.0])
returns = prices[1:] / prices[:-1] - 1
\`\`\`

That is a compact numerical calculation over a dense array. It is a poor representation of provider, symbol, time, and currency together because arrays do not carry the relational names and constraints that make those fields safe to join and audit. NumPy also commonly uses binary floating-point, so keep \`Decimal\` or database \`numeric\` values for money-sensitive calculations.

### Pandas is valuable, but it is not a warehouse

Pandas is common because it makes a local table easy to inspect:

\`\`\`python
import pandas as pd

prices = pd.read_parquet("data/clean/price_observation/2026-08-10.parquet")
prices["price"] = pd.to_numeric(prices["price"], errors="coerce")
invalid_prices = prices[prices["price"].isna() | (prices["price"] <= 0)]
\`\`\`

That is useful for profiling a day's data or investigating an incident. It becomes a problem when a scheduled job reads more data than memory can hold, hides business logic in a long chain of DataFrame operations, or duplicates transformations that SQL models already own.

A durable division of labour is often:

\`\`\`text
Python: collect, parse, validate boundary data, load, operate
SQL: join, aggregate, model, and publish relational data
Pandas or Polars: local inspection, exploration, and file-oriented transforms
\`\`\`

There are exceptions, but this prevents a simple ingestion script from becoming an untestable second warehouse.

## 4. A minimal ingestion shape

This pseudocode is intentionally boring. It identifies the pieces a first job needs without pretending to be a production framework:

\`\`\`python
def ingest_prices() -> int:
    received_at = utc_now()
    response = fetch_with_timeout()
    save_raw_response(response.content, received_at)

    records = parse_price_records(response.json(), received_at)
    valid_records, rejected_records = validate(records)

    load_price_observations(valid_records)
    log_run(len(valid_records), len(rejected_records), received_at)
    return len(valid_records)
\`\`\`

The design decisions matter more than the function names:

- Save raw evidence before a later parsing decision can lose it.
- Parse source fields into explicit types such as \`Decimal\` and UTC-aware \`datetime\`.
- Keep rejected records with a reason instead of silently dropping them.
- Make writes idempotent, so a retry does not duplicate an observation.
- Return a count and log enough context for the next person to investigate.

If the process fails after raw retention but before loading, a retry can work from the stored input. If it fails before raw retention, the source evidence may be gone. That is why the ordering is intentional.

## A small exercise for day 10

Build a script that reads a saved JSON response or CSV file and produces a short run report. It does not need an API call yet.

\`\`\`text
Input path:
Source name:
Receipt time in UTC:
Total records:
Valid records:
Rejected records and reasons:
Distinct symbols:
Earliest and latest event time:
Output path or target table:
\`\`\`

Use \`Path\`, \`json\` or \`csv\`, an aware datetime, \`Decimal\` where an amount is involved, and \`logging\`. Then intentionally introduce one malformed record. The exercise is complete when the script reports the bad record without losing the valid ones or pretending the run was fully successful.

## Terminology to learn with an LLM

| Term | Short meaning | A prompt to copy into an LLM |
| --- | --- | --- |
| Standard library | Modules included with Python itself. | \`Give me a data-engineering tour of Python's standard library. Prioritise pathlib, json, csv, datetime, Decimal, logging, itertools, and sqlite3 with one realistic use each.\` |
| Virtual environment | An isolated set of Python packages for one project. | \`Explain Python virtual environments for a data pipeline. Show why a project should not rely on globally installed pandas or requests.\` |
| Dependency | An external package your project needs to run. | \`Explain dependency pinning and lock files for a beginner data engineer. What can break when a pipeline upgrades pandas unexpectedly?\` |
| JSON serialization | Turning Python values into JSON text, or JSON text back into values. | \`Teach json.dumps and json.loads using a raw exchange response. Explain what happens to Decimal and datetime values.\` |
| Iterator | An object that yields values one at a time. | \`Explain iterators, generators, and list comprehensions using a 20 GB CSV file. When does each use memory?\` |
| \`map()\` | A built-in that applies a function to every item of an iterable. | \`Compare map, a list comprehension, and a for loop for normalising exchange symbols. Give readability and error-handling trade-offs.\` |
| Time zone-aware datetime | A datetime that includes enough context to identify an instant. | \`Explain naive versus timezone-aware datetimes. Show a pipeline bug caused by mixing local time and UTC.\` |
| Decimal | A base-10 numeric type suited to exact financial values. | \`Show why Decimal is safer than float for currency. Include a small Python example with a surprising float result.\` |
| HTTP timeout | A limit on how long a network request may wait. | \`Explain connect and read timeouts for an API ingestion job. What operational failure does each prevent?\` |
| NumPy array | A typed, fixed-shape collection of values designed for fast numerical work. | \`Explain NumPy arrays and vectorised operations using a short series of market prices. When should I use NumPy, pandas, SQL, or Decimal instead?\` |
| DataFrame | An in-memory two-dimensional table abstraction. | \`Compare pandas DataFrames, Polars DataFrames, SQL tables, and Parquet files for a daily market-data pipeline.\` |
| Driver | A package that lets code talk to a particular database. | \`Explain when to use psycopg versus SQLAlchemy for a PostgreSQL loader. Show a minimal safe connection pattern.\` |
| Validation model | A typed description of the input a boundary accepts. | \`Explain when Pydantic helps parse an API response and when a few direct checks are simpler.\` |

When asking an LLM for Python help, include the source shape, expected record grain, volume, destination, and failure rule. “Parse this 50 MB JSON response into a PostgreSQL staging table and retain rejected records” is a data-engineering request. “Write Python to parse JSON” is too vague to evaluate safely.

## What comes next

Days 11–12 move from a single script to ingestion design: full refreshes, incremental loads, cursors, retries, idempotency, late data, and the difference between a successful request and a complete dataset.

## References

- [Python standard library documentation](https://docs.python.org/3/library/)
- [Python documentation: \`decimal\`](https://docs.python.org/3/library/decimal.html)
- [NumPy documentation](https://numpy.org/doc/)
- [pandas documentation](https://pandas.pydata.org/docs/)
- [Apache Arrow Python documentation](https://arrow.apache.org/docs/python/)
- [psycopg documentation](https://www.psycopg.org/psycopg3/docs/)
- [Pydantic documentation](https://docs.pydantic.dev/)
`;export{e as default};