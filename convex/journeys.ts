import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Basic read/write functions to get the frontend talking to the shared DB.
// Extend freely tomorrow — this is just enough to prove the wiring end-to-end.

// List all active journeys (Home / journey switcher).
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("journeys")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Full detail for one journey plus its agents, activity, docs and approvals.
export const get = query({
  args: { id: v.id("journeys") },
  handler: async (ctx, { id }) => {
    const journey = await ctx.db.get(id);
    if (!journey) return null;

    const [agents, activity, documents, approvals] = await Promise.all([
      ctx.db.query("agents").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("activity").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("documents").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("approvals").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
    ]);

    return { journey, agents, activity, documents, approvals };
  },
});

// Create a new journey (the "My father needs knee surgery" kickoff).
export const create = mutation({
  args: {
    title: v.string(),
    patientName: v.string(),
    patientAge: v.number(),
    condition: v.string(),
    policy: v.string(),
    ownerName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journeys", {
      ...args,
      stage: "Diagnosis",
      progress: 0,
      coverageLeftInr: 0,
      documentsReady: 0,
      documentsTotal: 0,
      status: "active",
    });
  },
});
