#!/usr/bin/env bash
# Rebuilds public/mocks/spark-island.html from ~/workspaces/sparkling: the island page alone
# (island.ts in place of the app's main.ts, so nothing else is bundled) on the demo kid's data.
# Needs the Sparkling API running locally (npm run dev in the sparkling repo) with the demo family seeded.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SITE=$(cd "$HERE/../../.." && pwd)
SRC=${SPARKLING:-$HOME/workspaces/sparkling}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

node "$HERE/scrape.mjs" "$WORK/data.json" mia 1234

rsync -a --exclude node_modules --exclude dist "$SRC/package.json" "$SRC/tsconfig.base.json" "$SRC/shared" "$SRC/frontend" "$WORK/repo/"
ln -s "$SRC/node_modules" "$WORK/repo/node_modules"
ln -s "$SRC/frontend/node_modules" "$WORK/repo/frontend/node_modules"
cd "$WORK/repo/frontend"
cp "$HERE/island.ts" src/main.ts
cp "$HERE/vite.mock.config.ts" .
npx vite build -c vite.mock.config.ts

# the app is base64-encoded in the page, so check the bundle before that (build_single.py checks the data)
# text only the rest of the app has: the menu, shop, games, missions and sign in
for text in 'Spark Shop' 'Sign out' 'Word Find' 'Answer Coach' 'My profile' 'Speed Sums'; do
  if grep -q "$text" dist-mock/assets/*.js; then echo "the bundle still has: $text" >&2; exit 1; fi
done
# names that must never ship, kept out of this repo: MOCK_PRIVATE_TERMS="name|other"
if [ -n "${MOCK_PRIVATE_TERMS:-}" ] && grep -qiwE "$MOCK_PRIVATE_TERMS" dist-mock/assets/*.js; then
  echo "private names found in the app bundle" >&2
  exit 1
fi
python3 "$HERE/build_single.py" dist-mock "$WORK/data.json" "$SITE/public/mocks/spark-island.html"
