# Astra — Evaluation & Iteration

A closed loop: **real failures become eval cases**, **prompts/agents are version-controlled in git**, and **pass rate is measured across versions**.

## How the loop closes
- **Capture.** Every human **rejection** in the Approval Center is auto-captured as an eval case (`approvals.decide` → `evals.capture`, `source: human_rejection`). Agent errors and manual flags land the same way. Each case carries the `journeyId` it came from, so a mentor can trace a real failure straight into the eval set.
- **Version.** `convex/version.ts` holds `AGENT_VERSION` and the version log. The agent prompts (`hermes/orchestrator.md`, `hermes/run-journey.sh`, the analysis/vault system prompts in `convex/*.ts`) are the versioned artifacts. Each version is git-tagged: `agents-v1` … `agents-v4`.
- **Score.** The eval suite is scored per version (`evals.stats`) and shown on the **Evaluation** screen as a pass-rate-across-versions chart. The live runner (`evals.runSuite`) re-scores open captured cases against the current version with an LLM judge.

## The suite (grounded in real regressions we fixed)
Each canonical case is a real defect from this project, tagged with the version that first passes it:

| Case | Agent | First passes |
| ---- | ----- | ------------ |
| Home coverage reflects the real uploaded policy (not hardcoded) | Health Vault | v2 |
| Insurance decision uses the patient's ACTUAL policy (not a generic one) | Insurance | v3 |
| Hospital search uses the patient's real city (not hardcoded Mumbai) | Hospital | v3 |
| No co-pay applied for an under-60 patient | Insurance | v4 |
| Prescription counted from the Health Report email | Document | v4 |
| Planner does not hang in "working" after Approve | Planner | v4 |

## Measured gains across versions
Same suite, scored against each version's actual behaviour:

| Version | git tag | Pass rate | What changed |
| ------- | ------- | --------- | ------------ |
| v1 | `agents-v1` | 0% | Baseline — hardcoded coverage, generic policy reasoning, Mumbai-only hospital search |
| v2 | `agents-v2` | 17% | Health Vault agent reads the real uploaded docs; Approve fills Home from the parsed policy |
| v3 | `agents-v3` | 50% | Location-aware hospital search; Insurance agent reads the patient's real policy |
| v4 | `agents-v4` | 100% | Co-pay fix, prescription-from-email, hospital selection, notification email |

## Reproduce
```
npx convex run evals:seedSuite '{}'   # (re)build the canonical suite + per-version results
npx convex run evals:stats '{}'       # pass rate per version (chart data)
npx convex run evals:runSuite '{}'    # LLM judge re-scores open captured cases at the current version
```
Reject an approval in the app → a new `human_rejection` case appears in the **Evaluation** screen, traceable to that journey.
