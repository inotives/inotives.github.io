var e=`---
title: "Bumblebee — Supply-Chain Security Scanning in Daily Coding Workflows"
date: 2026-05-24
tags: [bumblebee, supply-chain, security, dev-tools, workflow, perplexity-ai]
summary: "How Perplexity AI's Bumblebee fits into a daily coding routine: scanning lockfiles against known compromised packages, pre-commit hooks, cron jobs, and keeping the threat surface visible without getting in the way."
---

## Bumblebee — Supply-Chain Security Scanning in Daily Coding Workflows

I recently added Perplexity AI's Bumblebee to my daily toolkit. It is a read-only metadata scanner that inventories on-disk packages (npm, PyPI, Go modules, VS Code extensions, Homebrew, Cargo, and more) and cross-references them against a bundled threat-intel database of known supply-chain compromises.

It is not a CVE scanner, not a runtime monitor, and not a code linter. It answers one question: *are any of the packages currently on my machine known to be compromised?*

## How It Works

Bumblebee reads metadata files on disk — \`package-lock.json\`, \`METADATA\`, \`go.sum\`, VS Code extension manifests, and similar — without executing code or making network calls. It matches each entry against a threat-intel catalog stored in the repo's \`threat_intel/\` directory.

Output is NDJSON with two key record types:

- \`package\` — a found installed package (normal inventory)
- \`finding\` — matched a threat-intel entry (action needed)

When \`--findings-only\` returns nothing, that is the expected clean state.

## Scan Profiles

The tool defines three scan profiles:

**\`baseline\`** — Scans global/user package roots, language toolchains, editor and browser extensions, MCP configs. Run this every morning or on a cron to catch things that auto-updated overnight.

**\`project\`** — Scans your development directories. This is the one I run most often. The useful thing is you do not need to \`cd\` per repo. Point \`--root\` at your workspace parent and it recursively finds lockfiles under every project in one shot:

\`\`\`sh
bumblebee scan --profile project --root ~/workspaces --findings-only
\`\`\`

Repeat \`--root\` for additional workspace directories like \`~/code\` or \`~/work\`.

**\`deep\`** — Any path you point at, including \`$HOME\`. Useful when an advisory drops and you want to sweep the entire machine.

## Daily Workflow

The routine is two commands:

\`\`\`
Morning:
  bumblebee scan --profile baseline --findings-only
  bumblebee scan --profile project --root ~/workspaces --findings-only
\`\`\`

Zero output means all clear. Finding means immediate action — the tool is telling you a known-compromised package is on disk.

I also run the project scan after \`git pull\` and before starting a coding session, since pull can bring in updated lockfiles.

## Pre-Commit Hook

A simple pre-commit hook prevents committing a compromised dependency:

\`\`\`sh
bumblebee scan --profile project --root "$PWD" --findings-only 2>/dev/null
\`\`\`

Save it as \`.git/hooks/pre-commit\` or wire it into a global hook template. It is fast enough that the scan completes before you notice — NDJSON parsing against local metadata is nearly instant for typical project sizes.

## CI/CD Integration

Bumblebee also fits into the CI/CD pipeline as a non-blocking advisory gate. The idea is to run it after dependency install and before the main test suite, catching compromised packages before they reach production.

A reusable workflow for GitHub Actions:

\`\`\`yaml
# .github/workflows/bumblebee-check.yml
on:
  pull_request:
    paths:
      - '**/package-lock.json'
      - '**/yarn.lock'
      - '**/requirements.txt'
      - '**/go.sum'
      - '**/Cargo.lock'

jobs:
  bumblebee-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4  # or any relevant toolchain
      - run: npm ci  # install to generate node_modules for scanning
      - name: Install Bumblebee
        run: |
          curl -sSfL https://github.com/perplexityai/bumblebee/releases/latest/download/bumblebee-linux-amd64.tar.gz \\
            | tar xz -C /usr/local/bin bumblebee
      - name: Scan dependencies
        run: |
          bumblebee scan --profile project --root . --findings-only
          # If the threat-intel database is bundled in the repo:
          bumblebee scan --profile project --root . \\
            --exposure-catalog .github/bumblebee-threat-intel \\
            --findings-only
\`\`\`

Two important design choices:

**Non-blocking by default.** Supply-chain findings should not block CI — a false positive or outdated intel entry would stall every PR. Instead, run it as a warning step. Only make it blocking once you have validated the threat-intel database against your dependency tree and know your false-positive rate.

**Cache the threat-intel database in the repo.** The database is small (text files under \`threat_intel/\`). Check it into \`.github/bumblebee-threat-intel/\` so every CI run has a consistent baseline. If you pull the latest intel on every CI run, you introduce variance — a pass on one run might fail on the next because the database updated.

For scheduled sweeps, add a weekly cron workflow that runs a deep scan and files an issue on any finding:

\`\`\`yaml
on:
  schedule:
    - cron: '0 10 * * 1'  # Monday 10am

jobs:
  weekly-sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Install Bumblebee
        run: curl -sSfL ... | tar xz -C /usr/local/bin bumblebee
      - name: Deep scan
        run: |
          bumblebee scan --profile deep --root . --findings-only > /tmp/bumblebee-findings.json
      - name: File issue on finding
        if: \${{ hashFiles('/tmp/bumblebee-findings.json') != '' }}
        uses: actions/github-script@v7
        with:
          script: |
            const findings = require('fs').readFileSync('/tmp/bumblebee-findings.json', 'utf8');
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Bumblebee: compromised dependencies found',
              body: \`Findings:\\n\\\`\\\`\\\`\\n\${findings}\\n\\\`\\\`\\\`\`,
              labels: ['security', 'bumblebee']
            });
\`\`\`

This keeps the CI integration lightweight — no external services, no API keys for a third-party scanner, just a binary and a text-file database that live in the repo.

## Why It Helps

The value is not in finding things you already know about. It is catching the things that change silently — a transitive dependency that got bumped during \`npm install\`, a VS Code extension that auto-updated to a compromised version, a Go module pulled in as an indirect dependency.

Supply-chain attacks exploit exactly this blind spot. Most developers do not read the full dependency tree after every install. Bumblebee sits in that gap and flags matches without requiring you to monitor advisory feeds yourself.

## Reading Output with an AI Agent

Raw NDJSON is not the most readable format. The practical workflow is to have the AI agent run Bumblebee and summarize:

\`\`\`
Agent: run bumblebee scan --profile project --root ~/workspaces --findings-only
       and tell me if anything was found
\`\`\`

The result is something like: *"All clear — 493 packages scanned, no known compromises"* or *"Found 2 matches — node-ipc v1.2.3 in ~/workspaces/foo"*. This keeps the scan in your existing coding session without switching context.

## Keeping Threat Intel Fresh

The threat-intel database is bundled in the repo under \`threat_intel/\`. Updates are currently manual:

\`\`\`sh
cd ~/workspaces/bumblebee && git pull
\`\`\`

Then re-run exposure scans. The repo does not have a built-in auto-update mechanism, so this is worth adding to a weekly or biweekly reminder.

## What It Is Not

Bumblebee has a narrow scope and that is by design:

- Not a CVE scanner — it only knows about known supply-chain compromises in the threat catalog
- Not a code linter — no source file reads
- Not a runtime monitor — no process or network watching
- Not a substitute for \`npm audit\` or \`pip-audit\`, which are CVE-focused

It is a focused tool for a specific gap: knowing whether packages already on disk match known-bad entries in a curated threat list.

## Improvement Over Previous Workflow

Before Bumblebee, supply-chain awareness was ad hoc — reading security news, periodically running \`npm audit\`, and hoping transitive dependencies did not quietly turn malicious. That is not a process. Bumblebee makes it a routine: run two commands in the morning, run one before each session, and let a pre-commit hook catch anything that slips through.

The biggest improvement is the reduction in cognitive overhead. The tool replaces "I should check if any of my dependencies are compromised" (a vague worry that rarely turns into action) with "scan clean, move on" (a concrete check that takes five seconds).
`;export{e as default};