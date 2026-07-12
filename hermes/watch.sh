#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Astra — autonomous Hermes orchestration loop.
#
# Polls Convex for newly-ingested health reports (proposed treatment plans) and
# lets the Hermes Orchestrator turn each into a running care journey — calling
# the Convex agent tools via the Convex MCP server and writing live activity the
# dashboard shows in real time.
#
# Run on your machine (Hermes runs locally):
#   bash hermes/watch.sh
#
# Requires: hermes installed + configured (provider openai-api, Convex MCP
# registered), and `npx convex` working from this repo.
#
# NOTE: this runs Hermes with --yolo so it can call the Convex tools unattended.
# That auto-approves tool calls — it's your machine and your call. Ctrl-C stops.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

PROMPT="$(cat hermes/orchestrator.md)"
INTERVAL="${INTERVAL:-20}"

echo "Astra watch loop — polling Convex every ${INTERVAL}s. Ctrl-C to stop."
while true; do
  PENDING="$(npx convex run agentTools:orchestration_pending '{}' 2>/dev/null || echo '[]')"
  COUNT="$(printf '%s' "$PENDING" | grep -c 'planId' || true)"
  if [ "${COUNT:-0}" -gt 0 ]; then
    echo "[$(date +%H:%M:%S)] ${COUNT} pending report(s) → invoking Hermes Orchestrator…"
    hermes --yolo -z "$PROMPT" || echo "  (hermes run errored — will retry next cycle)"
  else
    echo "[$(date +%H:%M:%S)] nothing pending"
  fi
  sleep "$INTERVAL"
done
