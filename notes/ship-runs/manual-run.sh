#!/usr/bin/env bash
# Scripted manual-loop baseline: what a person does without /ship.
#   - starts with "push and open a pr"
#   - if no PR exists after a turn: "ok, fix it, then push and open a pr"
#   - if the PR's CI failed: "CI failed on the PR. Check it and fix what's wrong."
#   - stops when the PR's CI is green (the point where you'd merge)
# Usage: notes/ship-runs/manual-run.sh <A|B> <run> [--continue]
#   --continue resumes the run's existing session instead of starting a new one.
set -uo pipefail
case_id=$1 run=$2 resume=${3:-}
dir=~/workspaces/inotives/ship-runs/${case_id}-manual-${run}
branch="ship-test/$(echo "$case_id" | tr A-Z a-z)-manual-${run}"
cd "$dir"
log() { echo "[$(date -u +%H:%M:%S)] ${case_id}${run} $*"; }

say() {
  log "you: $1"
  if [ -n "$resume" ]; then claude -p -c "$1" --permission-mode auto >/dev/null
  else claude -p "$1" --permission-mode auto >/dev/null; resume=1; fi
}

has_pr() { gh pr view "$branch" --json number >/dev/null 2>&1; }

say "push and open a pr"
for round in 1 2 3 4; do
  if ! has_pr; then
    say "ok, fix it, then push and open a pr"
    continue
  fi
  sleep 15
  if gh pr checks "$branch" --watch --interval 10 >/dev/null 2>&1; then
    log "CI green, done (round $round)"; exit 0
  fi
  say "CI failed on the PR. Check it and fix what's wrong."
done
log "gave up after 4 rounds"
exit 1
