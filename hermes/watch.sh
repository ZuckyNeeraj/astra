#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Astra — autonomous Hermes orchestration loop.
#
# Keep this running in a terminal and everything after "Approve" is automatic:
# when a journey needs work — a new proposed plan OR a journey you approved in the
# UI whose specialists haven't run — it launches the Hermes agent team, which
# writes live activity + approvals the dashboard shows in real time.
#
# Run on your machine (Hermes runs locally):
#   bash hermes/watch.sh
#
# Requires: hermes installed + configured (provider openai-api, Convex MCP), and
# `npx convex` working from this repo. Ctrl-C stops. INTERVAL overrides the poll.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

INTERVAL="${INTERVAL:-15}"
SEEN_FILE="$(mktemp)"
trap 'rm -f "$SEEN_FILE"' EXIT

echo "Astra watch loop — auto-runs the agent team when a journey needs work. Polling every ${INTERVAL}s. Ctrl-C to stop."
while true; do
  TARGET="$(npx convex run agentTools:orchestrationTarget '{}' 2>/dev/null || echo '{}')"
  MODE="$(printf '%s' "$TARGET" | grep -o '"mode": *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"$/\1/')"

  if [ "${MODE:-none}" = "start" ] || [ "${MODE:-none}" = "continue" ]; then
    JID="$(printf '%s' "$TARGET"    | grep -o '"journeyId": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    PLANID="$(printf '%s' "$TARGET" | grep -o '"planId": *"[^"]*"'    | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    KEY="${JID:-$PLANID}"
    if [ -n "$KEY" ] && grep -qF "$KEY" "$SEEN_FILE" 2>/dev/null; then
      echo "[$(date +%H:%M:%S)] $KEY already run this session — skipping (restart watch to retry)."
    else
      echo "[$(date +%H:%M:%S)] work detected (mode=$MODE) → running the agent team…"
      bash hermes/run-journey.sh
      [ -n "$KEY" ] && printf '%s\n' "$KEY" >> "$SEEN_FILE"
    fi
  else
    echo "[$(date +%H:%M:%S)] nothing to orchestrate"
  fi
  sleep "$INTERVAL"
done
