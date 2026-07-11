import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const REQUIRED_LABELS = ["Insurance Policy", "Aadhaar Card", "PAN Card", "Doctor's Prescription"];

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

// Approve a plan → spin up a real journey with its specialist agents.
export const approve = mutation({
  args: { id: v.id("treatmentPlans") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const plan = await ctx.db.get(id);
    if (!plan || plan.userId !== userId) throw new Error("Not found");
    const report = plan.reportId ? await ctx.db.get(plan.reportId) : null;

    // Count uploaded required documents for the docs-ready indicator.
    const vault = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const documentsReady = REQUIRED_LABELS.filter((l) => vault.some((vi) => vi.label === l)).length;

    const patientName = report?.patientName ?? "Patient";
    const journeyId = await ctx.db.insert("journeys", {
      userId,
      title: `${patientName}'s ${plan.recommendedProcedure}`,
      patientName,
      patientAge: report?.patientAge ?? 0,
      condition: report?.condition ?? "See report",
      policy: "As per uploaded policy",
      stage: "Doctor Consultation",
      progress: 8,
      coverageLeftInr: 500000,
      documentsReady,
      documentsTotal: REQUIRED_LABELS.length,
      ownerName: "You",
      status: "active",
    });

    // Seed the specialist agents.
    const agents = [
      { name: "Planner Agent",   role: "Journey Orchestrator", status: "working" as const, progress: 15 },
      { name: "Insurance Agent", role: "Coverage Specialist",  status: "pending" as const, progress: 0 },
      { name: "Hospital Agent",  role: "Facility Coordinator", status: "pending" as const, progress: 0 },
      { name: "Document Agent",  role: "Records Manager",      status: "pending" as const, progress: 0 },
    ];
    for (const a of agents) await ctx.db.insert("agents", { journeyId, ...a });

    await ctx.db.insert("activity", {
      journeyId, agentName: "Planner Agent",
      message: `Journey started — approved plan: ${plan.recommendedProcedure}`,
      kind: "success", createdAt: Date.now(),
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
