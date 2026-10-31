"""Replace personal data in the mock-ui copy with public topics and neutral placeholders."""
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])

# Public research topics: well-known papers, books and open-source tools.
TOPICS = [
    ("Attention Is All You Need — Paper Notes", ["transformers", "paper", "nlp"]),
    ("BERT: Pre-training of Deep Bidirectional Transformers", ["bert", "paper", "nlp"]),
    ("Language Models are Few-Shot Learners (GPT-3)", ["gpt-3", "paper", "few-shot"]),
    ("Scaling Laws for Neural Language Models", ["scaling-laws", "paper", "llm"]),
    ("Chinchilla: Training Compute-Optimal LLMs", ["chinchilla", "scaling-laws", "paper"]),
    ("InstructGPT and RLHF Explained", ["rlhf", "alignment", "paper"]),
    ("Constitutional AI — Key Ideas", ["alignment", "constitutional-ai", "paper"]),
    ("Direct Preference Optimization vs RLHF", ["dpo", "rlhf", "alignment"]),
    ("LoRA: Low-Rank Adaptation of Large Language Models", ["lora", "fine-tuning", "paper"]),
    ("QLoRA: Efficient Finetuning of Quantized LLMs", ["qlora", "quantization", "fine-tuning"]),
    ("FlashAttention: Fast and Memory-Efficient Attention", ["flash-attention", "gpu", "paper"]),
    ("vLLM and PagedAttention for LLM Serving", ["vllm", "inference", "serving"]),
    ("Speculative Decoding — How It Works", ["speculative-decoding", "inference", "latency"]),
    ("Mixture of Experts: Switch Transformer and Mixtral", ["moe", "architecture", "llm"]),
    ("Retrieval-Augmented Generation (Lewis et al.) Summary", ["rag", "paper", "retrieval"]),
    ("Dense Passage Retrieval for Open-Domain QA", ["dpr", "retrieval", "paper"]),
    ("ColBERT: Late Interaction Retrieval", ["colbert", "retrieval", "paper"]),
    ("Chain-of-Thought Prompting Elicits Reasoning", ["chain-of-thought", "prompting", "paper"]),
    ("ReAct: Synergizing Reasoning and Acting", ["react", "agents", "paper"]),
    ("Toolformer: Language Models Can Teach Themselves to Use Tools", ["toolformer", "tool-use", "paper"]),
    ("Reflexion: Language Agents with Verbal Reinforcement", ["reflexion", "agents", "paper"]),
    ("Tree of Thoughts — Deliberate Problem Solving", ["tree-of-thoughts", "reasoning", "paper"]),
    ("Generative Agents: Interactive Simulacra of Human Behavior", ["generative-agents", "memory", "paper"]),
    ("MemGPT: Towards LLMs as Operating Systems", ["memgpt", "memory", "agents"]),
    ("Model Context Protocol — Specification Walkthrough", ["mcp", "protocol", "agents"]),
    ("Agent2Agent (A2A) Protocol Overview", ["a2a", "protocol", "multi-agent"]),
    ("SWE-bench: Evaluating Agents on Real GitHub Issues", ["swe-bench", "evaluation", "agents"]),
    ("HELM: Holistic Evaluation of Language Models", ["helm", "evaluation", "benchmark"]),
    ("MMLU and the Limits of Multiple-Choice Benchmarks", ["mmlu", "benchmark", "evaluation"]),
    ("Judging LLM-as-a-Judge with MT-Bench", ["llm-as-judge", "evaluation", "paper"]),
    ("Spider and BIRD: Text-to-SQL Benchmarks Compared", ["text-to-sql", "benchmark", "evaluation"]),
    ("Sentence-BERT and Sentence Embeddings", ["sbert", "embeddings", "paper"]),
    ("MTEB: Massive Text Embedding Benchmark", ["mteb", "embeddings", "benchmark"]),
    ("HNSW: Hierarchical Navigable Small World Graphs", ["hnsw", "vector-search", "paper"]),
    ("Product Quantization for Nearest Neighbor Search", ["product-quantization", "vector-search", "paper"]),
    ("FAISS Library Deep Dive", ["faiss", "vector-search", "open-source"]),
    ("pgvector in Practice", ["pgvector", "postgres", "vector-search"]),
    ("GraphRAG: From Local to Global Summaries", ["graphrag", "knowledge-graph", "rag"]),
    ("Knowledge Graphs: Concepts and Tooling", ["knowledge-graph", "ontology", "survey"]),
    ("Designing Data-Intensive Applications — Key Ideas", ["ddia", "book-summary", "distributed-systems"]),
    ("The Data Warehouse Toolkit (Kimball) — Summary", ["kimball", "book-summary", "dimensional-modeling"]),
    ("Fundamentals of Data Engineering — Summary", ["data-engineering", "book-summary", "lifecycle"]),
    ("A Philosophy of Software Design — Summary", ["software-design", "book-summary", "complexity"]),
    ("The Pragmatic Programmer — Lessons", ["pragmatic-programmer", "book-summary", "craft"]),
    ("Site Reliability Engineering (Google) — Summary", ["sre", "book-summary", "reliability"]),
    ("Accelerate: The Science of DevOps — Summary", ["devops", "book-summary", "dora"]),
    ("MapReduce: Simplified Data Processing on Large Clusters", ["mapreduce", "paper", "distributed-systems"]),
    ("The Google File System Paper", ["gfs", "paper", "storage"]),
    ("Bigtable: A Distributed Storage System", ["bigtable", "paper", "storage"]),
    ("Dynamo: Amazon's Highly Available Key-Value Store", ["dynamo", "paper", "distributed-systems"]),
    ("Spanner: Google's Globally Distributed Database", ["spanner", "paper", "databases"]),
    ("Raft Consensus Algorithm Explained", ["raft", "consensus", "distributed-systems"]),
    ("Paxos Made Simple — Notes", ["paxos", "consensus", "paper"]),
    ("The Log: What Every Engineer Should Know", ["logs", "streaming", "essay"]),
    ("Kafka: A Distributed Messaging System", ["kafka", "streaming", "paper"]),
    ("The Dataflow Model Paper", ["dataflow", "streaming", "paper"]),
    ("Apache Flink Stateful Stream Processing", ["flink", "streaming", "open-source"]),
    ("Apache Spark Architecture Deep Dive", ["spark", "distributed-computing", "open-source"]),
    ("Apache Airflow Deep Dive", ["airflow", "orchestration", "open-source"]),
    ("Dagster Software-Defined Assets", ["dagster", "orchestration", "open-source"]),
    ("dbt: Analytics Engineering Workflow", ["dbt", "analytics-engineering", "open-source"]),
    ("Apache Iceberg Table Format Internals", ["iceberg", "lakehouse", "open-source"]),
    ("Delta Lake: ACID Tables on Object Storage", ["delta-lake", "lakehouse", "paper"]),
    ("Apache Hudi Overview", ["hudi", "lakehouse", "open-source"]),
    ("The Lakehouse Architecture Paper", ["lakehouse", "paper", "architecture"]),
    ("Apache Parquet File Format Internals", ["parquet", "columnar", "storage"]),
    ("Apache Arrow and Columnar In-Memory Data", ["arrow", "columnar", "open-source"]),
    ("DuckDB: An Embeddable Analytical Database", ["duckdb", "olap", "paper"]),
    ("Polars DataFrame Engine Overview", ["polars", "dataframes", "open-source"]),
    ("ClickHouse Architecture Overview", ["clickhouse", "olap", "open-source"]),
    ("Snowflake Elastic Data Warehouse Paper", ["snowflake", "data-warehouse", "paper"]),
    ("C-Store: A Column-Oriented DBMS", ["c-store", "columnar", "paper"]),
    ("PostgreSQL MVCC and Vacuum Explained", ["postgres", "mvcc", "databases"]),
    ("Change Data Capture with Debezium", ["cdc", "debezium", "streaming"]),
    ("Data Mesh Principles (Dehghani)", ["data-mesh", "architecture", "organization"]),
    ("Data Contracts: Concepts and Practice", ["data-contracts", "governance", "quality"]),
    ("OpenLineage Specification Overview", ["openlineage", "lineage", "open-source"]),
    ("Great Expectations for Data Quality", ["great-expectations", "data-quality", "open-source"]),
    ("Semantic Layers: MetricFlow and Cube", ["semantic-layer", "metrics", "analytics"]),
    ("OpenTelemetry GenAI Semantic Conventions", ["opentelemetry", "observability", "llm"]),
    ("Kubernetes Architecture Basics", ["kubernetes", "containers", "infrastructure"]),
    ("Terraform State and Modules", ["terraform", "infrastructure-as-code", "open-source"]),
    ("WebAssembly Outside the Browser", ["wasm", "runtime", "survey"]),
    ("Rust Ownership Model for Data Engineers", ["rust", "memory-safety", "languages"]),
    ("Python Packaging with uv", ["uv", "python", "tooling"]),
    ("Git Internals: Objects, Refs and Packfiles", ["git", "internals", "tooling"]),
    ("CRDTs: Conflict-Free Replicated Data Types", ["crdt", "distributed-systems", "paper"]),
    ("Bitcoin: A Peer-to-Peer Electronic Cash System", ["bitcoin", "whitepaper", "crypto"]),
    ("Ethereum Whitepaper Notes", ["ethereum", "whitepaper", "smart-contracts"]),
    ("Proof of Stake vs Proof of Work", ["consensus", "crypto", "comparison"]),
    ("Decentralized Identifiers (W3C DID) Overview", ["did", "identity", "standards"]),
    ("Zero-Knowledge Proofs — An Introduction", ["zk-proofs", "cryptography", "survey"]),
    ("Efficient Market Hypothesis — Summary", ["efficient-markets", "finance", "theory"]),
    ("Modern Portfolio Theory Basics", ["portfolio-theory", "finance", "theory"]),
    ("Black-Scholes Option Pricing Explained", ["options", "finance", "models"]),
    ("Order Books and Market Microstructure", ["market-microstructure", "trading", "finance"]),
    ("Time Series Forecasting: ARIMA to Prophet", ["forecasting", "time-series", "statistics"]),
    ("Bayesian A/B Testing Primer", ["ab-testing", "bayesian", "statistics"]),
    ("Causal Inference: The Book of Why — Summary", ["causal-inference", "book-summary", "statistics"]),
    ("Thinking, Fast and Slow — Summary", ["behavioral-economics", "book-summary", "decision-making"]),
    ("Deep Learning (Goodfellow et al.) — Chapter Notes", ["deep-learning", "book-summary", "ml"]),
    ("ImageNet Classification with Deep CNNs (AlexNet)", ["alexnet", "cnn", "paper"]),
    ("Deep Residual Learning (ResNet)", ["resnet", "cnn", "paper"]),
    ("Denoising Diffusion Probabilistic Models", ["diffusion", "generative-models", "paper"]),
    ("CLIP: Learning Visual Models from Language", ["clip", "multimodal", "paper"]),
    ("Word2Vec: Efficient Estimation of Word Representations", ["word2vec", "embeddings", "paper"]),
    ("Adam: A Method for Stochastic Optimization", ["adam", "optimization", "paper"]),
    ("Dropout: Preventing Neural Network Overfitting", ["dropout", "regularization", "paper"]),
    ("Batch Normalization Paper Notes", ["batch-norm", "training", "paper"]),
]


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower().replace("'", "")).strip("-")


seed_path = root / "fixtures/seed/real-notes.json"
seed = json.loads(seed_path.read_text())
research = [n for n in seed["notes"] if n["domain"] == "01_research"]
assert len(TOPICS) >= len(research), (len(TOPICS), len(research))

rename = {}
for note, (title, tags) in zip(research, TOPICS):
    new_slug = slugify(title)
    rename[note["slug"]] = new_slug
    note.update(slug=new_slug, title=title, tags=["research", *tags])

for note in seed["notes"]:
    # the one memo about a workplace AWS sign-in setup
    if note["domain"] == "07_memos" and "saml2aws" in note["slug"]:
        rename[note["slug"]] = "aws-cli-sso-setup"
        note.update(slug="aws-cli-sso-setup", title="Authenticating AWS CLI with IAM Identity Center (SSO)",
                    tags=["aws-cli", "sso", "authentication", "configuration"])

# links are bare slugs; keep the graph shape by following the renames
for note in seed["notes"]:
    note["links"] = [rename.get(link, link) for link in note["links"]]

seed["source"] = "public research topics and textbook concepts (sanitized for publication)"
seed_path.write_text(json.dumps(seed, indent=2) + "\n")

# neutral profile and inbox: match the fields, not their values, so no real names live here
fx = root / "scripts/fixtures.ts"
text = fx.read_text()
for pattern, new in [
    (r"account: '[^'@]+@[^']+'", "account: 'sam.rivera@northwind.example'"),
    (r"'Flagged · needs \w+'", "'Flagged · needs Sam'"),
    (r"owner: '[A-Z][a-z]+ [A-Z][a-z]+'", "owner: 'Sam Rivera'"),
    (r"organization: '[^']+'", "organization: 'Northwind Data'"),
]:
    text, n = re.subn(pattern, new, text)
    assert n, pattern
fx.write_text(text)

# simulated note bodies pick a task owner from a list whose first name is a person's
nb = root / "src/server/note-bodies.ts"
text, n = re.subn(r"rng\.pick\(\['\w+', 'atlas', 'archivist'\]\)", "rng.pick(['sam', 'atlas', 'archivist'])", nb.read_text())
assert n, "note-bodies owner list"
nb.write_text(text)

print(f"renamed {len(rename)} notes")
