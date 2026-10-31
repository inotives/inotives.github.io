#!/usr/bin/env bash
# Rebuild public/mocks/agent-core.html from agent-core/mock-ui.
# Works on a scratch copy: personal data in the mock (profile, real research
# note titles) is replaced before fixtures are regenerated, and the source
# repo is never modified.
set -euo pipefail

SRC="${1:-$HOME/workspaces/agent-core/mock-ui}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/../../.." && pwd)"
WORK="$(mktemp -d)"
trap 'kill "${SERVER:-}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

rsync -a --exclude node_modules --exclude dist --exclude .git "$SRC/" "$WORK/mock-ui/"
ln -s "$SRC/node_modules" "$WORK/mock-ui/node_modules"

cd "$WORK/mock-ui"
python3 -I "$HERE/sanitize.py" .
npm run fixtures >/dev/null
npm run build >/dev/null

PORT=1199 npx tsx src/server/main.ts >/dev/null 2>&1 &
SERVER=$!
for _ in $(seq 30); do curl -sf http://127.0.0.1:1199/api/mock >/dev/null && break; sleep 0.5; done

python3 -I "$HERE/scrape.py" "$WORK/mock-data.json"
python3 -I "$HERE/build_single.py" "$WORK/mock-ui" "$WORK/mock-data.json" "$SITE/public/mocks/agent-core.html"

# names to keep out come from MOCK_PRIVATE_TERMS ("name|other"), not from this repo
if [ -n "${MOCK_PRIVATE_TERMS:-}" ] && grep -qiwE "$MOCK_PRIVATE_TERMS" "$SITE/public/mocks/agent-core.html"; then
  echo "personal data found in the output; check sanitize.py" >&2
  exit 1
fi
