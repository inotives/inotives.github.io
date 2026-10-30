import { getAllPosts } from './content'

// Tags stay as written in each note's frontmatter. These maps only change how
// they are counted and filtered: aliases merge near-duplicates, and topics
// group the long tail of tags into a few ways to browse.

export const TAG_ALIASES = {
  postgresql: 'postgres',
  cicd: 'ci-cd',
  'git-worktree': 'git-worktrees',
  'knowledge-graph': 'knowledge-graphs',
  database: 'databases',
  pipeline: 'pipelines',
  workflows: 'workflow',
  'agentic-workflow': 'agentic-workflows',
  'agent-workflows': 'agentic-workflows',
  'coding-agent': 'coding-agents',
  'inference-cost': 'inference-costs',
  'agentic-ai': 'ai-agents',
  agents: 'ai-agents',
  'agentic-memory': 'agent-memory',
  'multi-agent-systems': 'multi-agent',
  'workflow-orchestration': 'orchestration',
  'crypto-data': 'crypto',
}

// A note belongs to every topic whose tags (or pattern) it carries
export const TOPICS = [
  {
    id: 'data',
    label: 'Data engineering',
    match: /^data-|^dbt|duck|lake|warehouse|^sql|parquet|iceberg/,
    tags: ['pipelines', 'orchestration', 'prefect', 'dagster', 'postgres', 'clickhouse', 'databricks', 'elt', 'analytics', 'airbyte', 'dlt'],
  },
  {
    id: 'ai',
    label: 'AI agents & LLMs',
    match: /^agent|^agentic|^ai-|^llm|^multi-agent|^local-llm/,
    tags: ['ai', 'skills', 'rag', 'ollama', 'loop-engineering', 'claude-code', 'codex', 'opencode', 'evaluation', 'human-in-the-loop', 'knowledge-graphs', 'token-optimization', 'machine-learning', 'mlx', 'llama-cpp', 'retrieval', 'deepseek', 'prompt-injection', 'langgraph', 'hallucination', 'openai', 'harness-engineering', 'context-mode', 'strata-memory', 'enterprise-ai', 'coding-agents'],
  },
  {
    id: 'mcp',
    label: 'MCP & integrations',
    match: /^mcp|integration/,
    tags: ['a2a', 'api-design', 'identity'],
  },
  {
    id: 'markets',
    label: 'Crypto & markets',
    match: /crypto|market|stock|trading|stablecoin|bitcoin|ethereum|defi/,
    tags: ['financial-data'],
  },
  {
    id: 'learning',
    label: 'Learning paths',
    match: /learning|certification|tutorial/,
    tags: [],
  },
  {
    id: 'tools',
    label: 'Developer tools',
    match: /^github|^git-|^ci-cd|^cli$|automation/,
    tags: ['developer-tools', 'workflow', 'n8n', 'playwright', 'rust', 'python', 'open-source', 'knowledge-management', 'codegraph'],
  },
  {
    id: 'infra',
    label: 'Cloud, security & ops',
    match: /^aws|cloud|terraform|security|observability|reliability|governance/,
    tags: ['operations', 'architecture', 'audit-trails', 'cost-optimization', 'compliance'],
  },
]

export function normalizeTag(tag) {
  return TAG_ALIASES[tag] || tag
}

export function postTags(post) {
  return [...new Set(post.tags.map(normalizeTag))]
}

export function postTopics(post) {
  const tags = postTags(post)
  return TOPICS.filter((topic) => tags.some((t) => topic.tags.includes(t) || topic.match.test(t))).map((t) => t.id)
}

let tagCountCache = null

// Notes per (normalised) tag across the whole site
export function getTagCounts() {
  if (!tagCountCache) {
    tagCountCache = {}
    getAllPosts().forEach((post) =>
      postTags(post).forEach((tag) => (tagCountCache[tag] = (tagCountCache[tag] || 0) + 1))
    )
  }
  return tagCountCache
}

// A note's most widely used tags, which are the useful ones to click
export function commonTags(post, limit = 3) {
  const counts = getTagCounts()
  return postTags(post)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .slice(0, limit)
}
