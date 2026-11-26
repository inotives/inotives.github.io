#!/usr/bin/env bash
# Make a fresh clone with one /ship test case committed on its own branch.
#
#   notes/ship-runs/setup-case.sh <A|B|C> <ship|manual> <run>
#
# Each run gets its own clone under ~/workspaces/inotives/ship-runs/, because a /ship watch
# uses the checkout it runs in (the docs say to work in a second clone while it watches).
# The change is committed but not pushed: in a public repo /ship won't commit for you.
set -euo pipefail

case_id=${1:?case A, B or C}; mode=${2:?ship or manual}; run=${3:?run number}
here=$(cd "$(dirname "$0")" && pwd)
origin=$(git -C "$here" remote get-url origin)
dir="$HOME/workspaces/inotives/ship-runs/${case_id}-${mode}-${run}"
branch="ship-test/$(echo "$case_id" | tr A-Z a-z)-${mode}-${run}"

[ -e "$dir" ] && { echo "already exists: $dir" >&2; exit 1; }
git clone -q "$origin" "$dir"
cd "$dir"
git switch -q -c "$branch"

case "$case_id" in
  A)  # content only: a draft post and an SVG chart
    chart="ship-test-${mode}-${run}.svg"
    sed "s/__CHART__/$chart/" "$here/fixtures/case-a-post.md" \
      > "content/posts/2026-12-01-ship-test-${mode}-${run}.md"
    cp "$here/fixtures/case-a-chart.svg" "public/assets/images/$chart"
    msg="Add weekly post count draft" ;;
  B)  # code change with planted problems (see run-sheet.md, not the code)
    cat "$here/fixtures/case-b-tags.js.txt" >> src/utils/tags.js
    msg="Add relatedPosts helper" ;;
  C)  # edits the line that conflict.sh also edits on master
    sed -i '' "s#^Status line: .*#Status line: changed on ${branch}.#" notes/ship-runs/conflict-target.md
    msg="Update conflict target status line" ;;
  *) echo "unknown case: $case_id" >&2; exit 1 ;;
esac

git add -A
git commit -q -m "$msg"
npm ci --silent >/dev/null 2>&1 || echo "npm ci failed; run it yourself before testing" >&2
echo "Ready: cd $dir   (branch $branch, commit: $msg)"
