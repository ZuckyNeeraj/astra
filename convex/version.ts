// ─────────────────────────────────────────────────────────────────────────────
// Version-controlled agent/prompt registry. Bump AGENT_VERSION whenever the
// agent prompts (orchestrator.md, run-journey.sh, analysis/vault system prompts)
// change materially, and add a VERSION_HISTORY entry with the git tag. The eval
// suite is scored per version so gains are measurable across versions.
//
// Git tags mirror these versions (see EVALS.md): `git tag agents-v4`.
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_VERSION = "v4";

export type VersionInfo = { version: string; tag: string; summary: string };

export const VERSION_HISTORY: VersionInfo[] = [
  {
    version: "v1",
    tag: "agents-v1",
    summary:
      "Baseline: generic specialists. Coverage/policy hardcoded, agents reasoned about a 'typical' policy, hospital city fixed to Mumbai.",
  },
  {
    version: "v2",
    tag: "agents-v2",
    summary:
      "Health Vault agent reads the real uploaded docs (OpenAI vision/Files API); Approve fills Home from the parsed policy instead of hardcoded numbers.",
  },
  {
    version: "v3",
    tag: "agents-v3",
    summary:
      "Location-aware hospital search (real city); Insurance agent decides coverage against the patient's ACTUAL uploaded policy, not a generic one.",
  },
  {
    version: "v4",
    tag: "agents-v4",
    summary:
      "Co-pay logic fix (no co-pay under 60), prescription-from-email, hospital selection → Approval Center, Notification agent emails the user.",
  },
];
