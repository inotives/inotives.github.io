var e=`---
title: "Running the market-data pipeline with Prefect, DuckDB, and dbt"
date: 2026-09-29
tags: [data-engineering, motherduck, duckdb, prefect, dbt, crypto-data]
summary: "Turn the local coins and market_data Parquet contract into a repeatable Prefect flow, load valid batches into Bronze, build tested dbt staging models, and select either local DuckDB or MotherDuck development."
series: building-motherduck-warehouse
---

The previous article established the rules for one market-data dump: \`coins.parquet\` and \`market_data.parquet\` arrive as a pair, both must pass validation, and a failed batch stays out of Bronze. This article wires those rules into a small Prefect flow and dbt project.

The local DuckDB file is the default target. A MotherDuck development database is an explicit integration target for the same project. Each run chooses one target, and the token stays in the environment.

![A versioned coins and market_data Parquet batch passes through Prefect validation, sends invalid data to quarantine, and follows the same Bronze-to-dbt-Silver path on either local DuckDB or MotherDuck development.](/assets/images/motherduck-prefect-market-data-workflow.png)

## Keep one dump together from landing through loading

Use a versioned directory for each delivered pair. The dump is the input; landing is the immutable copy the flow processes.

\`\`\`text
data/
  dumps/2026-09-29T090000Z/
    coins.parquet
    market_data.parquet
  landing/2026-09-29T090000Z/
    coins.parquet
    market_data.parquet
  quarantine/2026-09-29T090000Z/
    coins.parquet
    market_data.parquet
    reason.json
\`\`\`

The batch ID is the directory name. If a corrected dump arrives, give it a new ID rather than replacing files under a batch the flow may already have processed. This keeps retries and provenance understandable.

## Validate the Parquet contract before writing Bronze

The validator checks both file schemas and their relationship. It rejects empty files, missing or unexpected columns, incompatible Parquet types, duplicate or null \`coins.uniq_key\` values, unresolved \`market_data.coin_uniq_key\` values, and negative prices or volume.

DuckDB's Python API exposes a Parquet relation's column names and types, so the contract can be checked before any rows are inserted:

\`\`\`python
from pathlib import Path

import duckdb


class ContractError(ValueError):
    pass


EXPECTED = {
    "coins": {
        "id": "int", "uniq_key": "string", "name": "string",
    },
    "market_data": {
        "coin_uniq_key": "string",
        "time_open": "timestamp", "time_close": "timestamp",
        "time_high": "timestamp", "time_low": "timestamp",
        "name": "string", "open": "decimal", "high": "decimal",
        "low": "decimal", "close": "decimal", "volume": "decimal",
        "market_cap": "decimal", "circulating_supply": "decimal",
        "timestamp": "timestamp",
    },
}


def check_relation(table, relation):
    actual = dict(zip(relation.columns, map(str, relation.types)))
    expected = EXPECTED[table]
    if actual.keys() != expected.keys():
        raise ContractError(f"{table}: expected columns {sorted(expected)}, got {sorted(actual)}")
    if relation.aggregate("count(*)").fetchone()[0] == 0:
        raise ContractError(f"{table}: file has no rows")

    for column, family in expected.items():
        kind = actual[column].upper()
        if family == "int":
            valid = kind in {"TINYINT", "SMALLINT", "INTEGER", "BIGINT"}
        elif family == "string":
            valid = kind == "VARCHAR"
        elif family == "decimal":
            valid = kind.startswith("DECIMAL")
        else:
            valid = kind.startswith("TIMESTAMP")
        if not valid:
            raise ContractError(f"{table}.{column}: expected {family}, got {kind}")


def validate_batch(batch_dir):
    batch_dir = Path(batch_dir)
    con = duckdb.connect(":memory:")
    try:
        coins_path = batch_dir / "coins.parquet"
        market_path = batch_dir / "market_data.parquet"
        if not coins_path.is_file() or not market_path.is_file():
            raise ContractError("batch must contain coins.parquet and market_data.parquet")

        coins = con.read_parquet(str(coins_path))
        market = con.read_parquet(str(market_path))
        check_relation("coins", coins)
        check_relation("market_data", market)
        coins.create_view("batch_coins")
        market.create_view("batch_market_data")

        checks = {
            "null coin key": "SELECT count(*) FROM batch_coins WHERE uniq_key IS NULL",
            "duplicate coin key": "SELECT count(*) FROM (SELECT uniq_key FROM batch_coins GROUP BY uniq_key HAVING count(*) > 1)",
            "unknown market-data coin": """
                SELECT count(*) FROM batch_market_data AS md
                LEFT JOIN batch_coins AS c ON c.uniq_key = md.coin_uniq_key
                WHERE md.coin_uniq_key IS NULL OR c.uniq_key IS NULL
            """,
            "negative price or volume": """
                SELECT count(*) FROM batch_market_data
                WHERE open < 0 OR high < 0 OR low < 0 OR close < 0 OR volume < 0
            """,
        }
        for reason, sql in checks.items():
            if con.execute(sql).fetchone()[0]:
                raise ContractError(reason)
    except ContractError:
        raise
    except duckdb.Error as error:
        raise ContractError(f"cannot validate Parquet batch: {error}") from error
    finally:
        con.close()
\`\`\`

The Parquet type check accepts different integer widths and decimal precision while still rejecting a string where a number belongs. It retains the five timestamps as supplied. We have not decided whether \`timestamp\` or a \`time_*\` column defines the market observation grain, so this flow does not deduplicate or aggregate rows.

The validator runs against the local files before connecting to either target. An unknown coin reference, for example, is a property of the delivered batch; it should be quarantined before it can become shared warehouse data.

## Let Prefect route the batch and record each step

The flow is deliberately small. One task copies the versioned input to landing. Validation failures move that landed copy to quarantine with a reason. The Bronze task uses a transaction and source-path checks, so a retry cannot append the same pair twice. A transient database error leaves the files in landing for another attempt.

\`\`\`python
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

import duckdb
from dotenv import load_dotenv
from prefect import flow, task


@task
def land_batch(batch_id: str) -> str:
    if Path(batch_id).name != batch_id or batch_id in {"", ".", ".."}:
        raise ValueError("batch must be a single directory name")
    source = Path("data/dumps") / batch_id
    landing = Path("data/landing") / batch_id
    if not source.is_dir():
        raise FileNotFoundError(source)
    landing.parent.mkdir(parents=True, exist_ok=True)
    if not landing.exists():
        shutil.copytree(source, landing)
    return str(landing)


@task
def quarantine_batch(landing_dir: str, reason: str) -> None:
    landing = Path(landing_dir)
    quarantine = Path("data/quarantine") / landing.name
    if quarantine.exists():
        raise FileExistsError(f"already quarantined: {quarantine}")
    quarantine.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(landing), str(quarantine))
    record = {
        "batch_id": landing.name,
        "status": "quarantined",
        "failed_checks": [reason],
        "source_files": ["coins.parquet", "market_data.parquet"],
    }
    (quarantine / "reason.json").write_text(
        json.dumps(record, indent=2) + "\\n", encoding="utf-8"
    )


@task(retries=2, retry_delay_seconds=5)
def load_bronze(landing_dir: str, target: str) -> None:
    landing = Path(landing_dir)
    if target == "local":
        Path(".local").mkdir(exist_ok=True)
        con = duckdb.connect(".local/warehouse.duckdb")
    elif target == "motherduck_dev":
        if not os.getenv("motherduck_token"):
            raise RuntimeError("set motherduck_token before selecting MotherDuck")
        con = duckdb.connect("md:warehouse_dev")
    else:
        raise ValueError(f"unknown target: {target}")

    try:
        con.execute("CREATE SCHEMA IF NOT EXISTS bronze")
        files = {"coins": "coins.parquet", "market_data": "market_data.parquet"}
        for table, filename in files.items():
            con.read_parquet(str(landing / filename)).create_view(f"incoming_{table}")
            con.execute(f"""
                CREATE TABLE IF NOT EXISTS bronze.{table} AS
                SELECT *, NULL::TIMESTAMPTZ AS _ingested_at,
                       NULL::VARCHAR AS _source_file
                FROM incoming_{table} WHERE false
            """)

        sources = {
            table: (landing / filename).as_posix()
            for table, filename in files.items()
        }
        loaded = {
            table: con.execute(
                f"SELECT count(*) FROM bronze.{table} WHERE _source_file = ?",
                [source],
            ).fetchone()[0] > 0
            for table, source in sources.items()
        }
        if all(loaded.values()):
            return
        if any(loaded.values()):
            raise RuntimeError("partial batch already exists in Bronze; inspect before retrying")

        con.execute("BEGIN TRANSACTION")
        try:
            for table in files:
                con.execute(f"""
                    INSERT INTO bronze.{table}
                    SELECT *, current_timestamp, ? FROM incoming_{table}
                """, [sources[table]])
            con.execute("COMMIT")
        except Exception:
            con.execute("ROLLBACK")
            raise
    finally:
        con.close()


@task
def build_dbt(target: str) -> None:
    subprocess.run([
        "dbt", "build", "--project-dir", "dbt", "--profiles-dir", "dbt",
        "--target", target,
    ], check=True)


@flow(name="market-data-batch")
def ingest_market_data(batch_id: str, target: str = "local") -> None:
    load_dotenv()
    landing = land_batch(batch_id)
    try:
        validate_batch(landing)
    except ContractError as error:
        quarantine_batch(landing, str(error))
        raise
    load_bronze(landing, target)
    build_dbt(target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    parser.add_argument("--target", choices=["local", "motherduck_dev"], default="local")
    args = parser.parse_args()
    ingest_market_data(args.batch, args.target)
\`\`\`

The exact \`source_file\` marker is the relative landed path. For this single-writer POC, it is enough to identify a repeated batch. The loader writes both tables in one transaction; if only one marker is present, it stops for inspection rather than guessing how to repair a partial load.

## Make dbt use the selected database

The profile has two outputs and puts dbt models in the \`silver\` schema. It contains no token. Copy it to \`dbt/profiles.yml\`, add the real token to the ignored \`.env\`, and let \`load_dotenv()\` pass the value to both DuckDB and the dbt subprocess.

\`\`\`yaml
market_data_warehouse:
  target: local
  outputs:
    local:
      type: duckdb
      path: .local/warehouse.duckdb
      schema: silver
      threads: 4
    motherduck_dev:
      type: duckdb
      path: "md:warehouse_dev?motherduck_token={{ env_var('motherduck_token', '') }}"
      schema: silver
      threads: 4
\`\`\`

The matching \`dbt/dbt_project.yml\` keeps these models as Silver views:

\`\`\`yaml
name: market_data_warehouse
version: "1.0.0"
profile: market_data_warehouse
model-paths: ["../features/market_data/models"]

models:
  market_data_warehouse:
    +materialized: view
\`\`\`

\`features/market_data/models/sources.yml\` declares the loaded Bronze tables:

\`\`\`yaml
version: 2

sources:
  - name: bronze
    schema: bronze
    tables:
      - name: coins
      - name: market_data
\`\`\`

The two staging models select their source columns and keep \`_source_file\` and \`_ingested_at\`. Put the tests in \`features/market_data/models/models.yml\`; they protect the keys and relationship without pretending we know the market-data grain:

\`\`\`yaml
version: 2

models:
  - name: stg_coins
    columns:
      - name: uniq_key
        data_tests: [not_null, unique]
  - name: stg_market_data
    columns:
      - name: coin_uniq_key
        data_tests:
          - not_null
          - relationships:
              arguments:
                to: ref('stg_coins')
                field: uniq_key
\`\`\`

\`stg_coins.sql\` is a straight projection too:

\`\`\`sql
select id, uniq_key, name, _ingested_at, _source_file
from {{ source('bronze', 'coins') }}
\`\`\`

For example, \`stg_market_data.sql\` can preserve every supplied timestamp and decimal as it arrived:

\`\`\`sql
select
    coin_uniq_key,
    time_open,
    time_close,
    time_high,
    time_low,
    name,
    open,
    high,
    low,
    close,
    volume,
    market_cap,
    circulating_supply,
    timestamp,
    _ingested_at,
    _source_file
from {{ source('bronze', 'market_data') }}
\`\`\`

There is no deduplication or daily mart yet. Those need an explicit observation key and correction policy based on a real dump.

## Run locally first, then against MotherDuck dev

Keep the flow and dbt models with the \`market_data\` feature, as in the scaffold:

\`\`\`text
features/market_data/
  ingestion.py
  models/
    sources.yml
    models.yml
    stg_coins.sql
    stg_market_data.sql
dbt/
  dbt_project.yml
  profiles.yml.example
\`\`\`

Install the dependencies already introduced in the scaffold, copy the profile example, and create the ignored local files:

\`\`\`bash
uv add duckdb dbt-duckdb prefect python-dotenv
cp dbt/profiles.yml.example dbt/profiles.yml
mkdir -p data/dumps/2026-09-29T090000Z .local
\`\`\`

Place the two Parquet files in that versioned dump directory. Run the default local target:

\`\`\`bash
uv run python features/market_data/ingestion.py \\
  --batch 2026-09-29T090000Z
\`\`\`

The flow leaves a passing batch in landing, adds it to \`.local/warehouse.duckdb\`, then runs \`dbt build\`. For an invalid batch, it moves the landing copy to quarantine and records the first contract failure in \`reason.json\`, matching the previous article's batch record.

After creating the \`warehouse_dev\` database and setting \`motherduck_token\` in \`.env\`, use the same flow and dbt project with an explicit target:

\`\`\`dotenv
motherduck_token=your-short-lived-development-token
\`\`\`

Keep \`.env\` ignored by Git. Run both commands from the repository root.

\`\`\`bash
uv run python features/market_data/ingestion.py \\
  --batch 2026-09-29T090000Z \\
  --target motherduck_dev
\`\`\`

This integration run writes the batch to MotherDuck and builds the Silver views there. It does not deploy a Prefect worker or schedule a production flow. The goal is to verify the same contract and model graph against the shared target while the ordinary development loop stays local.

## What we have, and what still needs the real dump

We now have one path from a paired Parquet dump through a quality gate, quarantine, Bronze provenance, and dbt tests. A MotherDuck target can run that same dbt project without changing model SQL.

The next decision depends on inspecting actual rows: which timestamp defines one market observation, what identifies a correction, and whether the \`name\` fields agree with the reference coin record. Until then, keeping every timestamp and avoiding deduplication is the honest model.

## References

- [Prefect flows](https://docs.prefect.io/v3/develop/write-flows)
- [Prefect tasks](https://docs.prefect.io/v3/develop/write-tasks)
- [DuckDB Python client](https://duckdb.org/docs/stable/clients/python/overview)
- [DuckDB Parquet documentation](https://duckdb.org/docs/stable/data/parquet/overview.html)
- [dbt DuckDB setup and MotherDuck connection](https://docs.getdbt.com/docs/local/connect-data-platform/duckdb-setup)
- [dbt data tests](https://docs.getdbt.com/docs/build/data-tests)
- [MotherDuck authentication](https://motherduck.com/docs/key-tasks/authenticating-to-motherduck/)
`;export{e as default};