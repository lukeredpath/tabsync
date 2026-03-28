#!/usr/bin/env bash
# Monitor the GitHub Actions run for a given commit.
#
# Usage: ci-watch.sh [SHA]
#   SHA defaults to HEAD if not supplied.
#
# Exit codes:
#   0 — run passed
#   1 — run failed (URL is written to stdout)
#   2 — run not found or timed out (no alert warranted)
#
# Progress messages go to stderr so they appear in the terminal when run
# manually via `make ci-watch` but can be suppressed by the hook.

REPO=lukeredpath/tabsync
SHA=${1:-$(git rev-parse HEAD 2>/dev/null)}

if [ -z "$SHA" ]; then
  echo "ci-watch: could not determine SHA" >&2
  exit 2
fi

echo "ci-watch: looking for CI run for ${SHA:0:7}…" >&2

# ── Wait for the run to appear on GitHub (up to ~2 minutes) ──
RUN_ID=""
i=0
while [ $i -lt 12 ]; do
  sleep 10
  RUN_ID=$(gh run list --repo "$REPO" --commit "$SHA" --limit 1 \
    --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
  [ -n "$RUN_ID" ] && break
  i=$((i+1))
done

if [ -z "$RUN_ID" ]; then
  echo "ci-watch: no run found for ${SHA:0:7} after 2 minutes" >&2
  exit 2
fi

URL=$(gh run view "$RUN_ID" --repo "$REPO" --json url --jq '.url' 2>/dev/null || true)
echo "ci-watch: watching run $RUN_ID — $URL" >&2

# ── Poll until the run reaches a terminal conclusion (up to ~15 minutes) ──
CONCLUSION=null
i=0
while [ $i -lt 60 ]; do
  CONCLUSION=$(gh run view "$RUN_ID" --repo "$REPO" \
    --json conclusion --jq '.conclusion' 2>/dev/null || echo "null")
  [ "$CONCLUSION" != "null" ] && [ -n "$CONCLUSION" ] && break
  echo "ci-watch: still running… (poll $((i+1))/60)" >&2
  sleep 15
  i=$((i+1))
done

if [ "$CONCLUSION" = "null" ] || [ -z "$CONCLUSION" ]; then
  echo "ci-watch: timed out waiting for run to complete" >&2
  exit 2
fi

if [ "$CONCLUSION" = "success" ]; then
  echo "ci-watch: ✓ passed" >&2
  exit 0
fi

echo "ci-watch: ✗ failed ($CONCLUSION)" >&2
echo "$URL"   # stdout — captured by the hook for the alert message
exit 1
