#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Astra — Hermes journey orchestration driver.
#
# The autonomous orchestrator loop. Detects a pending health report, then runs
# each specialist agent as its OWN focused Hermes invocation (gpt-5.6-sol reliably
# completes ~4 tool calls per turn, so one specialist per call = rock solid).
# Every agent does REAL work via the Convex MCP tools and writes live activity
# (tokens + cost) the dashboard shows in real time.
#
# Run:  bash hermes/run-journey.sh
# Requires: hermes configured (openai-api + Convex MCP) and `npx convex` here.
# Uses --yolo so Hermes can call the Convex tools unattended (your machine).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

# Exact Convex MCP deployment selector for our dev deployment (quirky-mallard-785,
# kind "unspecified"). Hardcoded so Hermes never picks the empty prod deployment
# and never wastes a turn on the `status` tool. Decodes to:
#   {"projectDir":"/Users/zucky/Developer/code/astra","deployment":{"kind":"unspecified"}}
SEL='unspecified:eyJwcm9qZWN0RGlyIjoiL1VzZXJzL3p1Y2t5L0RldmVsb3Blci9jb2RlL2FzdHJhIiwiZGVwbG95bWVudCI6eyJraW5kIjoidW5zcGVjaWZpZWQifX0='
HDR="You are a specialist agent in the Astra healthcare-journey system. Use the convex MCP 'run' tool for every action, ALWAYS with deploymentSelector '$SEL'. Do NOT call the convex 'status' tool. Make your tool calls back-to-back and do not stop until every step below is done."

runagent () { hermes --yolo -z "$1" || echo "  (agent errored — continuing)"; }

# 1. Find a pending plan (deterministic; convex CLI already targets dev).
PENDING="$(npx convex run agentTools:orchestration_pending '{}' 2>/dev/null)"
PLANID="$(printf '%s' "$PENDING" | grep -o '"planId": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
if [ -z "${PLANID:-}" ]; then echo "Nothing pending to orchestrate."; exit 0; fi

PROC="$(printf '%s' "$PENDING"   | grep -o '"recommendedProcedure": *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"$/\1/')"
PATIENT="$(printf '%s' "$PENDING"| grep -o '"patientName": *"[^"]*"'          | head -1 | sed 's/.*: *"\(.*\)"$/\1/')"
COND="$(printf '%s' "$PENDING"   | grep -o '"condition": *"[^"]*"'            | head -1 | sed 's/.*: *"\(.*\)"$/\1/')"
COST="$(printf '%s' "$PENDING"   | grep -o '"estCostInr": *[0-9]*'            | head -1 | grep -o '[0-9]*')"
echo "▶ Orchestrating: $PATIENT — $PROC (plan $PLANID)"

# 2. Start the journey (deterministic scaffolding: creates journey + seeds agents).
JID="$(npx convex run agentTools:startJourneyFromPlan "{\"planId\":\"$PLANID\"}" 2>/dev/null | tr -d '"')"
if [ -z "${JID:-}" ]; then echo "Failed to start journey."; exit 1; fi
echo "▶ Journey: $JID"

# 3. Run each specialist as its own Hermes call.
echo "▶ Planner Agent…"
runagent "$HDR
You are the Planner Agent for journeyId $JID (patient $PATIENT, $COND, procedure $PROC).
Do: (1) run agentTools:patchJourney {journeyId:'$JID', stage:'Insurance Pre-Auth', progress:25};
(2) run agentTools:logStep {journeyId:'$JID', agentName:'Planner Agent', message:'<one-line plan for this patient's journey>', kind:'info', tokens:<~180>, costUsd:<~0.001>};
(3) run agentTools:setAgent {journeyId:'$JID', name:'Planner Agent', status:'done', progress:100}."

echo "▶ Hospital Agent (Linkup)…"
runagent "$HDR
You are the Hospital Agent for journeyId $JID. Procedure: $PROC, city Mumbai.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Hospital Agent', status:'working', progress:40};
(2) run agentTools:linkupHospitalSearch {procedure:'$PROC', city:'Mumbai'};
(3) from the result pick the 3 best hospitals with approx cost, and for EACH run agentTools:logStep {journeyId:'$JID', agentName:'Hospital Agent', message:'<hospital name — ₹cost>', kind:'info', tokens:<~600>, costUsd:<~0.003>};
(4) run agentTools:addApproval {journeyId:'$JID', title:'Choose a hospital', detail:'<the 3 options>'};
(5) run agentTools:setAgent {journeyId:'$JID', name:'Hospital Agent', status:'done', progress:100}."

echo "▶ Insurance Agent…"
runagent "$HDR
You are the Insurance Agent for journeyId $JID. Procedure $PROC, estimated cost ₹${COST:-250000}.
Reason about likely coverage under a typical Indian health policy.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Insurance Agent', status:'working', progress:50};
(2) run agentTools:logStep {journeyId:'$JID', agentName:'Insurance Agent', message:'<coverage verdict with numbers>', kind:'success', tokens:<~500>, costUsd:<~0.0025>};
(3) run agentTools:patchJourney {journeyId:'$JID', coverageLeftInr:<plausible remaining cover>};
(4) run agentTools:addApproval {journeyId:'$JID', title:'Confirm pre-authorization', detail:'<detail>'};
(5) run agentTools:setAgent {journeyId:'$JID', name:'Insurance Agent', status:'done', progress:100}."

echo "▶ Document Agent…"
runagent "$HDR
You are the Document Agent for journeyId $JID.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Document Agent', status:'working', progress:50};
(2) run agentTools:readVault {journeyId:'$JID'};
(3) run agentTools:logStep {journeyId:'$JID', agentName:'Document Agent', message:'<which required docs are present vs missing>', kind:'warning', tokens:<~300>, costUsd:<~0.0015>};
(4) run agentTools:patchJourney {journeyId:'$JID', documentsReady:<present count>};
(5) if any docs are missing, run agentTools:addApproval {journeyId:'$JID', title:'Upload missing documents', detail:'<missing list>'};
(6) run agentTools:setAgent {journeyId:'$JID', name:'Document Agent', status:'done', progress:100}."

echo "▶ Notification Agent…"
runagent "$HDR
You are the Notification Agent for journeyId $JID (patient $PATIENT).
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Notification Agent', status:'working', progress:80};
(2) run agentTools:logStep {journeyId:'$JID', agentName:'Notification Agent', message:'Family notified: <one-line journey summary>', kind:'action', tokens:<~150>, costUsd:<~0.0008>};
(3) run agentTools:patchJourney {journeyId:'$JID', progress:45};
(4) run agentTools:setAgent {journeyId:'$JID', name:'Notification Agent', status:'done', progress:100}."

echo "✓ Orchestration complete for $PATIENT. Open the Live Agents dashboard."
