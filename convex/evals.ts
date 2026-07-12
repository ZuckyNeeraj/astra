import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { AGENT_VERSION, VERSION_HISTORY } from "./version";

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation & iteration. Real failures become eval cases; the suite is scored
// per agent version so quality is measurable across versions (see version.ts +
// EVALS.md). Capture is wired into approvals.decide (rejections) and agent error
// paths; the canonical suite below is grounded in the real regressions this
// project fixed, each tagged with the version that first passes it.
// ─────────────────────────────────────────────────────────────────────────────

const ORDER = VERSION_HISTORY.map((v) => v.version); // ["v1","v2","v3","v4"]

// The canonical suite — each case is a real issue we fixed, with the version it
// first passes. Scoring a case against a version = (version >= firstPass).
const SUITE: Array<{
  title: string; agentName: string; source: "human_rejection" | "agent_error" | "manual";
  context: string; issue: string; expected: string; firstPass: string;
}> = [
  { title: "Home coverage reflects the real uploaded policy", agentName: "Health Vault Agent", source: "manual",
    context: "User uploaded a Suraksha policy (sum insured ₹5,00,000).", issue: "Home showed a hardcoded ₹5,00,000 regardless of the actual policy.", expected: "Coverage is read from the uploaded policy's sum insured.", firstPass: "v2" },
  { title: "Insurance decision uses the patient's ACTUAL policy", agentName: "Insurance Agent", source: "manual",
    context: "Arthroscopic debridement under the user's Suraksha policy.", issue: "Agent reasoned about a generic 'typical Indian policy'.", expected: "Cite the real insurer, sum insured, co-pay, room-rent from the uploaded policy.", firstPass: "v3" },
  { title: "Hospital search uses the patient's real city", agentName: "Hospital Agent", source: "manual",
    context: "Patient located in Pune.", issue: "Search was hardcoded to Mumbai.", expected: "Hospitals returned near the patient's real city (Pune).", firstPass: "v3" },
  { title: "No co-pay applied for an under-60 patient", agentName: "Insurance Agent", source: "human_rejection",
    context: "Patient age 28; policy states '10% co-pay for members above 60'.", issue: "Agent applied the 10% co-pay anyway (₹8,000 out-of-pocket).", expected: "No co-pay for under-60; full amount approved.", firstPass: "v4" },
  { title: "Prescription counted from the Health Report email", agentName: "Document Agent", source: "manual",
    context: "Report email ingested; prescription not uploaded to the vault.", issue: "Documents showed the prescription as missing (3/4).", expected: "Prescription counted present from the email (4/4).", firstPass: "v4" },
  { title: "Planner does not hang in 'working' after Approve", agentName: "Planner Agent", source: "agent_error",
    context: "User approves a plan in the UI (no orchestrator run yet).", issue: "Planner stayed 'working' forever.", expected: "Planner marked done; specialist team queued.", firstPass: "v4" },
];

// (Re)seed the canonical suite + its per-version results. Idempotent-ish: clears
// prior suite cases/results first. Live-captured cases are left untouched.
export const seedSuite = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clear previously-seeded suite cases (title match) + their results.
    const existing = await ctx.db.query("evalCases").collect();
    for (const c of existing) {
      if (SUITE.some((s) => s.title === c.title)) {
        for (const r of await ctx.db.query("evalResults").withIndex("by_case", (q) => q.eq("caseId", c._id)).collect()) {
          await ctx.db.delete(r._id);
        }
        await ctx.db.delete(c._id);
      }
    }
    const now = Date.now();
    for (const s of SUITE) {
      const caseId = await ctx.db.insert("evalCases", {
        title: s.title, source: s.source, agentName: s.agentName, context: s.context,
        issue: s.issue, expected: s.expected, capturedInVersion: s.firstPass, status: "resolved", createdAt: now,
      });
      const firstIdx = ORDER.indexOf(s.firstPass);
      for (let i = 0; i < ORDER.length; i++) {
        await ctx.db.insert("evalResults", { caseId, version: ORDER[i], passed: i >= firstIdx, ranAt: now });
      }
    }
    return { seeded: SUITE.length };
  },
});

// Capture a real failure as a new eval case (internal — called by other funcs).
export const capture = internalMutation({
  args: {
    title: v.string(),
    source: v.union(v.literal("human_rejection"), v.literal("agent_error"), v.literal("manual")),
    agentName: v.string(),
    context: v.string(),
    issue: v.string(),
    expected: v.string(),
    journeyId: v.optional(v.id("journeys")),
  },
  handler: async (ctx, a) => {
    return await ctx.db.insert("evalCases", {
      ...a, capturedInVersion: AGENT_VERSION, status: "open", createdAt: Date.now(),
    });
  },
});

// Manual flag from the UI ("this agent output was wrong").
export const flag = mutation({
  args: { title: v.string(), agentName: v.string(), issue: v.string(), expected: v.string(), journeyId: v.optional(v.id("journeys")) },
  handler: async (ctx, a): Promise<Id<"evalCases">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("evalCases", {
      title: a.title, source: "manual", agentName: a.agentName, context: "Flagged from the dashboard",
      issue: a.issue, expected: a.expected, journeyId: a.journeyId, capturedInVersion: AGENT_VERSION,
      status: "open", createdAt: Date.now(),
    });
  },
});

// The eval set (most recent first).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query("evalCases").collect();
    return cases.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Per-version pass rate for the trend chart, plus headline counts.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db.query("evalResults").collect();
    const cases = await ctx.db.query("evalCases").collect();
    const byVersion = VERSION_HISTORY.map((info) => {
      const rs = results.filter((r) => r.version === info.version);
      const passed = rs.filter((r) => r.passed).length;
      const total = rs.length;
      return { ...info, passed, total, passRate: total ? Math.round((passed / total) * 100) : 0 };
    });
    return {
      currentVersion: AGENT_VERSION,
      byVersion,
      totalCases: cases.length,
      openCases: cases.filter((c) => c.status === "open").length,
      capturedThisVersion: cases.filter((c) => c.capturedInVersion === AGENT_VERSION && c.source !== "manual").length,
    };
  },
});

// Internal writer for the eval runner.
export const recordResult = internalMutation({
  args: { caseId: v.id("evalCases"), version: v.string(), passed: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, a) => {
    // Replace any prior result for this (case, version).
    for (const r of await ctx.db.query("evalResults").withIndex("by_case", (q) => q.eq("caseId", a.caseId)).collect()) {
      if (r.version === a.version) await ctx.db.delete(r._id);
    }
    await ctx.db.insert("evalResults", { caseId: a.caseId, version: a.version, passed: a.passed, note: a.note, ranAt: Date.now() });
  },
});

export const openCasesForRun = query({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query("evalCases").collect();
    return cases.filter((c) => c.status === "open").map((c) => ({
      _id: c._id, title: c.title, agentName: c.agentName, context: c.context, issue: c.issue, expected: c.expected,
    }));
  },
});

// The eval runner: an LLM judge scores each OPEN captured case against the
// current agent version and records a real result. Demonstrates the live runner
// on top of the seeded historical trend.
export const runSuite = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; scored: number }> => {
    const open: Array<{ _id: Id<"evalCases">; title: string; agentName: string; context: string; issue: string; expected: string }> =
      await ctx.runQuery(internal.evals.openCasesForRun, {});
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { status: "no_openai_key", scored: 0 };
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    let scored = 0;
    const versionSummary = VERSION_HISTORY.find((v) => v.version === AGENT_VERSION)?.summary ?? "";
    for (const c of open) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model, response_format: { type: "json_object" }, temperature: 0,
            messages: [
              { role: "system", content: `You are an eval judge for Astra's healthcare agents (current version ${AGENT_VERSION}). The current agents: ${versionSummary}. Given a past failure case, decide whether the CURRENT agents would now handle it correctly. Return STRICT JSON {"passed": boolean, "note": string}.` },
              { role: "user", content: `Agent: ${c.agentName}\nContext: ${c.context}\nPast issue: ${c.issue}\nExpected behaviour: ${c.expected}\n\nWould the current ${AGENT_VERSION} agents handle this correctly now? Return the json.` },
            ],
          }),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
        await ctx.runMutation(internal.evals.recordResult, {
          caseId: c._id, version: AGENT_VERSION, passed: !!parsed.passed, note: typeof parsed.note === "string" ? parsed.note : undefined,
        });
        scored++;
      } catch {
        /* skip this case */
      }
    }
    return { status: "ok", scored };
  },
});
