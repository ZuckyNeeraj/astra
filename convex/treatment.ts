import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Documents the user uploads to the vault. The Doctor's Prescription is NOT here
// — it comes from the ingested Health Report email (counted separately below).
const REQUIRED_UPLOADS = ["Insurance Policy", "Aadhaar Card", "PAN Card"];
const DEFAULT_STAGES = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];

// Proposed treatment plans awaiting the user's verification (for the Home modal),
// joined with the report + email they came from.
export const proposed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const plans = await ctx.db
      .query("treatmentPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const pending = plans.filter((p) => p.status === "proposed");
    return Promise.all(
      pending.map(async (p) => {
        const report = p.reportId ? await ctx.db.get(p.reportId) : null;
        const email = report?.emailId ? await ctx.db.get(report.emailId) : null;
        return { plan: p, report, email };
      }),
    );
  },
});

// Shared journey-creation logic used by BOTH the user approve (below) and the
// debug helper. Reads the Health Vault, fills the journey with real coverage/
// policy, seeds agents, and logs what the vault contributed.
async function startApprovedJourney(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"treatmentPlans">,
): Promise<Id<"journeys">> {
    const plan = await ctx.db.get(id);
    if (!plan || plan.userId !== userId) throw new Error("Not found");
    const report = plan.reportId ? await ctx.db.get(plan.reportId) : null;

    // ── Read the Health Vault: the docs the user uploaded are already parsed by
    // the Health Vault agent (docKind + extractedFields). Pull the REAL policy
    // (sum insured, insurer) so the Home screen shows real coverage — not a
    // hardcoded number. Also count uploaded required documents.
    const vault = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Uploaded required docs + the prescription, which the Health Report email
    // provides (so it's counted present whenever this plan came from a report).
    const uploadsPresent = REQUIRED_UPLOADS.filter((l) => vault.some((vi) => vi.label === l)).length;
    const prescriptionFromEmail = !!report;
    const documentsTotal = REQUIRED_UPLOADS.length + 1;
    const documentsReady = uploadsPresent + (prescriptionFromEmail ? 1 : 0);

    const policyDoc = vault.find((vi) => vi.docKind === "insurance_policy");
    const medicalDoc = vault.find((vi) => vi.docKind === "medical_report");
    const sumInsured = Number(policyDoc?.extractedFields?.sumInsuredInr ?? "");
    const coverageLeftInr = isFinite(sumInsured) && sumInsured > 0 ? sumInsured : 0;
    const policyLabel = policyDoc?.extractedFields?.insurer
      ? `${policyDoc.extractedFields.insurer}${policyDoc.extractedFields.policyNumber ? ` · ${policyDoc.extractedFields.policyNumber}` : ""}`
      : "Pending policy read";
    const stages = plan.stages && plan.stages.length ? plan.stages : DEFAULT_STAGES;

    console.log(
      `[approve] journey for user=${userId} plan=${plan.recommendedProcedure} | vault: ${vault.length} items, ` +
      `docs ${documentsReady}/${documentsTotal} (uploads ${uploadsPresent}/${REQUIRED_UPLOADS.length}, prescription-from-email=${prescriptionFromEmail}) | ` +
      `policyDoc=${!!policyDoc} insurer=${policyDoc?.extractedFields?.insurer ?? "-"} sumInsured=${coverageLeftInr} | medicalDoc=${!!medicalDoc}`,
    );

    const patientName = report?.patientName ?? "Patient";
    const journeyId = await ctx.db.insert("journeys", {
      userId,
      title: `${patientName}'s ${plan.recommendedProcedure}`,
      patientName,
      patientAge: report?.patientAge ?? 0,
      condition: report?.condition ?? "See report",
      policy: policyLabel,
      stage: stages[0],
      progress: 8,
      coverageLeftInr,
      documentsReady,
      documentsTotal,
      ownerName: "You",
      status: "active",
    });

    // Seed the specialist agents (matches the orchestrator's roster).
    const agents = [
      { name: "Planner Agent",      role: "Journey Orchestrator", status: "working" as const, progress: 15 },
      { name: "Health Vault Agent", role: "Records Analyst",      status: "done" as const,    progress: 100 },
      { name: "Insurance Agent",    role: "Coverage Specialist",  status: "pending" as const, progress: 0 },
      { name: "Hospital Agent",     role: "Facility Coordinator", status: "pending" as const, progress: 0 },
      { name: "Document Agent",     role: "Records Manager",      status: "pending" as const, progress: 0 },
      { name: "Claim Agent",        role: "Claims Filer",         status: "pending" as const, progress: 0 },
    ];
    for (const a of agents) await ctx.db.insert("agents", { journeyId, ...a });

    await ctx.db.insert("activity", {
      journeyId, agentName: "Planner Agent",
      message: `Journey started — approved plan: ${plan.recommendedProcedure}`,
      kind: "success", createdAt: Date.now(),
    });

    // Log, into the live feed, exactly what the Health Vault contributed — so the
    // Home screen visibly reflects data pulled from the uploaded documents.
    if (policyDoc) {
      await ctx.db.insert("activity", {
        journeyId, agentName: "Health Vault Agent",
        message: `Read ${policyDoc.label}: ${policyLabel}${coverageLeftInr ? `, sum insured ₹${coverageLeftInr.toLocaleString("en-IN")}` : ""}`,
        kind: "info", createdAt: Date.now() + 1,
      });
    }
    if (medicalDoc?.extractedSummary) {
      await ctx.db.insert("activity", {
        journeyId, agentName: "Health Vault Agent",
        message: `Read ${medicalDoc.label}: ${medicalDoc.extractedSummary}`,
        kind: "info", createdAt: Date.now() + 2,
      });
    }
    if (prescriptionFromEmail) {
      await ctx.db.insert("activity", {
        journeyId, agentName: "Health Vault Agent",
        message: `Doctor's prescription taken from the Health Report email`,
        kind: "info", createdAt: Date.now() + 3,
      });
    }
    await ctx.db.insert("activity", {
      journeyId, agentName: "Health Vault Agent",
      message: `Documents ready: ${documentsReady}/${documentsTotal} (${uploadsPresent} uploaded + prescription from email)`,
      kind: documentsReady === documentsTotal ? "success" : "warning", createdAt: Date.now() + 4,
    });

    // Mark the plan approved and link everything to the new journey.
    await ctx.db.patch(id, { status: "approved", journeyId });
    if (report) await ctx.db.patch(report._id, { journeyId });

    // Picking one candidate dismisses the rest — reject the user's other
    // still-proposed plans so the suggestion modal closes on approval.
    const others = await ctx.db
      .query("treatmentPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const p of others) {
      if (p._id !== id && p.status === "proposed") {
        await ctx.db.patch(p._id, { status: "rejected" });
      }
    }

    return journeyId;
}

// Approve a plan → spin up a real journey with its specialist agents (the Home
// suggestion modal's Approve button). Auth-scoped; delegates to the helper.
export const approve = mutation({
  args: { id: v.id("treatmentPlans") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await startApprovedJourney(ctx, userId, id);
  },
});

// Debug-only: run the EXACT approve logic for a given plan without auth, so the
// end-to-end flow can be exercised/observed from the CLI. Safe to keep — it only
// acts on a plan id you pass in.
export const approveDebug = internalMutation({
  args: { planId: v.id("treatmentPlans") },
  handler: async (ctx, { planId }): Promise<Id<"journeys">> => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("plan not found");
    return await startApprovedJourney(ctx, plan.userId, planId);
  },
});

// Dismiss a proposed plan.
export const reject = mutation({
  args: { id: v.id("treatmentPlans") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const plan = await ctx.db.get(id);
    if (!plan || plan.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { status: "rejected" });
  },
});
