#!/usr/bin/env bash
# Push a conflicting edit of conflict-target.md straight to master (case C).
# Run while /ship is watching a case C pull request.
set -euo pipefail
dir=$(mktemp -d)
git clone -q "$(git -C "$(dirname "$0")" remote get-url origin)" "$dir"
cd "$dir"
sed -i '' "s/^Status line: .*/Status line: changed on master at $(date -u +%H:%M:%SZ)./" notes/ship-runs/conflict-target.md
git commit -q -am "Change conflict target on master"
git push -q origin HEAD:master
echo "Pushed conflicting change to master: $(git rev-parse --short HEAD)"
rm -rf "$dir"
