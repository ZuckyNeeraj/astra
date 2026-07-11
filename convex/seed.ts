import { mutation } from "./_generated/server";

// Seeds the demo journey shown in the frontend mockup ("Father's Knee Surgery").
// Run once after `npx convex dev` is connected:  npm run db:seed
// Idempotent-ish: it clears prior seed rows so re-running gives a clean demo state.
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    // Wipe existing demo data so the seed is repeatable during the sprint.
    for (const table of ["activity", "agents", "documents", "approvals", "journeys"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        await ctx.db.delete(row._id);
      }
    }

    const journeyId = await ctx.db.insert("journeys", {
      title: "Father's Knee Surgery",
      patientName: "Rajiv Kumar",
      patientAge: 62,
      condition: "Grade 3 Osteoarthritis",
      policy: "Star Health Comprehensive",
      stage: "Hospital Booking",
      progress: 72,
      coverageLeftInr: 420000,
      estSurgeryDate: "Jul 14, 2025",
      documentsReady: 5,
      documentsTotal: 7,
      ownerName: "Rahul Sharma",
      status: "active",
    });

    const agents = [
      { name: "Planner Agent", role: "Plans subtasks and reviews outputs", status: "working" as const, progress: 65 },
      { name: "Insurance Agent", role: "Pre-auth, coverage checks, claims", status: "working" as const, progress: 80 },
      { name: "Hospital Agent", role: "Finds hospitals, checks slots", status: "working" as const, progress: 55 },
      { name: "Document Agent", role: "Collects and files documents", status: "waiting" as const, progress: 30 },
    ];
    for (const a of agents) await ctx.db.insert("agents", { journeyId, ...a });

    const now = Date.now();
    const feed = [
      { agentName: "Hospital Agent", message: "Contacted Apollo Hospitals — slot availability checked", kind: "info" as const, ago: 2 * 60_000 },
      { agentName: "Insurance Agent", message: "Reviewed pre-auth policy clause 4.2 — coverage confirmed", kind: "success" as const, ago: 8 * 60_000 },
      { agentName: "Document Agent", message: "MRI report uploaded to Document Vault", kind: "action" as const, ago: 60 * 60_000 },
      { agentName: "Insurance Agent", message: "Pre-authorization approval received from Star Health Insurance", kind: "success" as const, ago: 3 * 60 * 60_000 },
    ];
    for (const f of feed) {
      await ctx.db.insert("activity", {
        journeyId, agentName: f.agentName, message: f.message, kind: f.kind, createdAt: now - f.ago,
      });
    }

    const docs = [
      { name: "MRI Report", type: "medical", status: "ready" as const },
      { name: "Diagnosis Summary", type: "medical", status: "ready" as const },
      { name: "Insurance Policy", type: "insurance", status: "ready" as const },
      { name: "Aadhaar Card", type: "identity", status: "ready" as const },
      { name: "PAN Card", type: "identity", status: "ready" as const },
      { name: "Discharge Summary", type: "medical", status: "missing" as const },
      { name: "Final Bill", type: "insurance", status: "missing" as const },
    ];
    for (const d of docs) await ctx.db.insert("documents", { journeyId, ...d });

    await ctx.db.insert("approvals", {
      journeyId,
      title: "Confirm hospital booking",
      detail: "Apollo Hospitals, Jul 14 — surgeon Dr. Mehta. Approve to lock the slot.",
      status: "pending",
      createdAt: now,
    });

    return { journeyId };
  },
});
