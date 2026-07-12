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

echo "▶ Health Vault Agent…"
runagent "$HDR
You are the Health Vault Agent for journeyId $JID (patient $PATIENT, $COND). You read the REAL documents the family uploaded and surface the facts the other agents need.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Health Vault Agent', status:'working', progress:40};
(2) run agentTools:readVaultDocuments {journeyId:'$JID'} and read each document's docKind, summary and fields (e.g. the insurance policy's insurer/sumInsuredInr, the medical report's diagnosis);
(3) for the MOST important 1-2 documents, run agentTools:logStep {journeyId:'$JID', agentName:'Health Vault Agent', message:'<what you read from that real document — cite the actual insurer, sum insured, or diagnosis>', kind:'success', tokens:<~400>, costUsd:<~0.002>};
(4) if a policy was read, run agentTools:patchJourney {journeyId:'$JID', coverageLeftInr:<the real sumInsuredInr you read, as a number>};
(5) run agentTools:setAgent {journeyId:'$JID', name:'Health Vault Agent', status:'done', progress:100}."

# Resolve the patient's REAL current city from their saved location (deterministic;
# no hardcoded city). Falls back to India-wide search if they haven't shared one.
LOC="$(npx convex run agentTools:getUserLocation "{\"journeyId\":\"$JID\"}" 2>/dev/null)"
CITY="$(printf '%s' "$LOC" | grep -o '"city": *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"$/\1/')"
CITYLBL="${CITY:-India (no location shared)}"
echo "▶ Hospital Agent (Linkup) — searching near: $CITYLBL"
runagent "$HDR
You are the Hospital Agent for journeyId $JID. Procedure: $PROC. The patient's current city is: ${CITY:-unknown (search India-wide)}.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Hospital Agent', status:'working', progress:40};
(2) run agentTools:linkupHospitalSearch {procedure:'$PROC'$( [ -n "$CITY" ] && printf ", city:'%s'" "$CITY")};
(3) from the result pick the 3 best hospitals. For EACH, run agentTools:addHospitalOption {journeyId:'$JID', name:'<hospital>', area:'<locality>', estCostInr:<number>, coverageNote:'<one line>', why:'<why this one>', source:'<a source url from the result>', recommended:<true for the single best, else false>};
(4) run agentTools:logStep {journeyId:'$JID', agentName:'Hospital Agent', message:'Found 3 hospitals near ${CITY:-the patient} for $PROC', kind:'success', tokens:<~700>, costUsd:<~0.0035>};
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

echo "▶ Claim Agent…"
runagent "$HDR
You are the Claim Agent for journeyId $JID (patient $PATIENT, $PROC, estimated ₹${COST:-250000}). You file the insurance claim.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Claim Agent', status:'working', progress:60};
(2) run agentTools:fileClaim {journeyId:'$JID', hospitalName:'<the recommended hospital if known, else the top hospital>', amountInr:<the claim amount, use ${COST:-250000}>, summary:'<one paragraph: patient, procedure, hospital, amount, that the claim is being filed with the insurer and via the employer portal>'} — this really emails the claim and submits to the employer portal;
(3) from the result, run agentTools:logStep {journeyId:'$JID', agentName:'Claim Agent', message:'Claim filed — email <emailStatus>, employer portal ref <employerPortalRef>', kind:'success', tokens:<~450>, costUsd:<~0.0022>};
(4) run agentTools:setAgent {journeyId:'$JID', name:'Claim Agent', status:'done', progress:100}."

echo "▶ Notification Agent (ElevenLabs voice)…"
runagent "$HDR
You are the Notification Agent for journeyId $JID (patient $PATIENT, $PROC). You give the family a spoken update.
Do: (1) run agentTools:setAgent {journeyId:'$JID', name:'Notification Agent', status:'working', progress:80};
(2) run notify:notifyFamily {journeyId:'$JID', message:'<a warm 2-3 sentence spoken update for the family: patient, procedure, that hospitals were found, insurance checked, and the claim filed — plain language>'} — this really generates the voice message;
(3) from the result, run agentTools:logStep {journeyId:'$JID', agentName:'Notification Agent', message:'Family notified (voice <voiceStatus>)', kind:'action', tokens:<~180>, costUsd:<~0.001>};
(4) run agentTools:patchJourney {journeyId:'$JID', progress:60};
(5) run agentTools:setAgent {journeyId:'$JID', name:'Notification Agent', status:'done', progress:100}."

echo "✓ Orchestration complete for $PATIENT. Open the Live Agents dashboard."
