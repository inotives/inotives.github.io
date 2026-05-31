---
title: "playwright-cli for Data Work: Why CLI Beats MCP and Built-in Tools"
date: 2026-05-25
tags: [playwright, browser-automation, cli, mcp, web-fetch, web-search, data-extraction, developer-tools, ai-agents]
summary: "How playwright-cli fits into daily data extraction workflows, why it replaces web-fetch and web-search for JS-rendered content, why CLI is preferable to MCP for token efficiency, and how to set it up in Codex and opencode with a reusable skill."
---

## playwright-cli for Data Work

I use playwright-cli almost daily for data extraction tasks. It fills a gap that the built-in web-search and web-fetch tools cannot cover: interactive, stateful browser automation with JavaScript execution.

The setup is simple. The skill is reusable. The token cost is minimal. This note covers the why and how.

## What playwright-cli Is

playwright-cli is a bash-callable CLI wrapper around Microsoft's Playwright framework. It exposes atomic browser commands as one-liners: `open`, `goto`, `click`, `fill`, `eval`, `snapshot`, `close`. Browser state persists across commands within a named session.

```bash
playwright-cli open https://example.com
playwright-cli fill e1 "search query"
playwright-cli click e2
playwright-cli eval "JSON.stringify(result)" --raw > data.json
playwright-cli close
```

Each command is a short bash invocation — no JSON-RPC, no tool definition schemas, no background server.

## How It Differs from web-search and web-fetch

The built-in tools are read-only and stateless. They make a GET request, receive server-rendered HTML, and return text. That works fine for static documentation, blog posts, and REST API responses.

They break on anything that requires:

| Scenario | web-fetch | playwright-cli |
|---|---|---|
| JS-rendered table | Empty or garbled | Full DOM, eval JSON |
| Click "Load More" pagination | Cannot | click + repeat |
| Login flow | Cannot | fill + click + cookie-save |
| Cookie dialog dismiss | Cannot | click + dialog-accept |
| XHR/API response interception | Cannot | route or console capture |
| Structured data extraction | Text-only | eval + --raw to JSON |

The concrete example that sold me: CoinMarketCap historical OHLCV data. The table is rendered client-side by JavaScript. The page has a cookie dialog that blocks content access. Data is loaded in chunks via "Load More" buttons. web-fetch returns nothing useful. playwright-cli extracts 800+ rows in one session:

```bash
playwright-cli open https://coinmarketcap.com/currencies/verge/historical-data/
playwright-cli click "button:has-text('Accept')"
playwright-cli eval "JSON.stringify([...document.querySelectorAll('table tr')].map(r => [...r.children].map(c => c.textContent)))" --raw > /tmp/raw.json
python3 -c "import json; ..." > ohlcv.csv
playwright-cli close
```

## Why CLI over MCP

The Playwright team ships both a CLI (`@playwright/cli`) and an MCP server (`@playwright/mcp`). I chose the CLI. Three reasons:

**1. Token efficiency.** MCP loads full tool schemas into context at connect time (`browser_navigate` with parameter types, `browser_click`, `browser_evaluate`, etc.). Each snapshot response includes the full accessibility tree (roles, names, states, bounding boxes). That burns hundreds to thousands of tokens per turn. CLI commands are raw bash — four tokens for `playwright-cli eval "..."`.

**2. No background server.** MCP runs as a persistent process that must be started, stopped, and restarted. The CLI spawns the browser on demand and closes when done. No state leaks, no zombie processes, no transport config.

**3. Pipe-friendly output.** The `--raw` flag strips all metadata and returns pure output. You can pipe directly into `jq`, redirect to a file, or feed into a Python script. MCP returns structured JSON that requires parsing before piping.

The official Playwright team README confirms this reasoning:

> Modern coding agents increasingly favor CLI-based workflows exposed as SKILLs over MCP because CLI invocations are more token-efficient: they avoid loading large tool schemas and verbose accessibility trees into the model context.

The tradeoff: I lose the persistent accessibility tree and automatic console/network log streaming that MCP provides. For data extraction tasks, that is the right trade.

## Installation

### Global install (recommended)

```bash
npm install -g @playwright/cli@latest
```

This makes `playwright-cli` available as a system-wide command.

### npx fallback

If global install is not possible, use the local version:

```bash
npx --no-install playwright-cli --version  # check if available
npx playwright-cli goto https://example.com
```

### In Codex

Add to your Codex project's `.codex/setup.sh` or environment setup:

```bash
#!/bin/bash
npm install -g @playwright/cli@latest
```

Codex agents use bash tools natively, so playwright-cli is available immediately as a shell command.

### In opencode

Register the playwright-cli skill in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "skills": {
    "paths": ["/home/you/.agent-knowledge/memory/.agents/skills"]
  }
}
```

The skill file at `.agents/skills/playwright-cli/SKILL.md` contains the full command reference and example workflows. Once the path is registered, the agent loads the skill automatically when a matching task is detected.

## The Skill

The playwright-cli skill covers 387 lines of command reference organized by category:

| Category | Commands |
|---|---|
| Core | `open`, `goto`, `click`, `fill`, `eval`, `snapshot`, `close`, `drag`, `drop`, `hover`, `select`, `upload`, `check`, `uncheck`, `dialog-accept`, `dialog-dismiss`, `resize` |
| Navigation | `go-back`, `go-forward`, `reload` |
| Keyboard & mouse | `press`, `keydown`, `keyup`, `mousemove`, `mousedown`, `mouseup`, `mousewheel` |
| Tabs | `tab-new`, `tab-close`, `tab-select`, `tab-list` |
| Storage | cookies, localStorage, sessionStorage (get, set, delete, list, clear), `state-save`, `state-load` |
| Network | `route`, `route-list`, `unroute` for request mocking and interception |
| DevTools | `console`, `requests`, `tracing-start/stop`, `video-start/stop`, `run-code`, `show --annotate`, `generate-locator`, `highlight` |
| Sessions | `list`, `close-all`, `kill-all`, named sessions via `-s` flag |

The skill also covers targeting strategies: snapshot refs (`e1`, `e2`), CSS selectors, Playwright role locators, and test IDs.

Two patterns I use most:

**Pattern 1: eval + --raw for data extraction**

Serializes DOM content directly to JSON with the `--raw` flag stripping all metadata. Output pipes into `jq` or Python directly:

```bash
playwright-cli eval "JSON.stringify(extractedData)" --raw > data.json
```

**Pattern 2: snapshot refs for interaction**

After `snapshot`, elements are referenced as `e1`, `e2`, etc. This avoids writing fragile CSS selectors:

```bash
playwright-cli snapshot
playwright-cli fill e3 "username"
playwright-cli click e7
```

## When to Use What

| Task | Tool |
|---|---|
| Fetch a static URL | web-fetch (zero setup) |
| Search for recent info | web-search (built-in) |
| Extract a JS-rendered table to CSV | playwright-cli + eval + --raw |
| Multi-step login + scrape | playwright-cli (fill, click, state-save) |
| Interactive app exploration | @playwright/mcp (accessibility tree useful) |
| Take a screenshot | playwright-cli screenshot |
| Network request inspection | playwright-cli requests / console |
| Long-running autonomous agent | @playwright/mcp |
| Cookie / localStorage management | playwright-cli cookie-* / localstorage-* |

## Verdict

playwright-cli is not a replacement for web-fetch or web-search. It is a complement for the cases they cannot handle: JS-rendered content, multi-step interaction, and structured data extraction.

For data work, the CLI approach wins over MCP because it conserves tokens, removes server management overhead, and integrates naturally with the bash tool ecosystem. The skill pattern makes it discoverable and reusable across sessions.

If you do data extraction from the web, playwright-cli is worth the install.

## References

- [playwright-cli](https://github.com/microsoft/playwright-cli) — CLI wrapper repository
- [@playwright/mcp](https://github.com/microsoft/playwright-mcp) — MCP server repository
