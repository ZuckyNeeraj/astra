import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// All journey functions are scoped to the signed-in user. Unauthenticated
// callers get empty/null results rather than another user's data.

// List the signed-in user's active journeys (Home / journey switcher).
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("journeys")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

// Full detail for one journey plus its agents, activity, docs and approvals.
export const get = query({
  args: { id: v.id("journeys") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const journey = await ctx.db.get(id);
    if (!journey || journey.userId !== userId) return null; // ownership check

    const [agents, activity, documents, approvals, hospitals, claims, notifs, plans] = await Promise.all([
      ctx.db.query("agents").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("activity").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("documents").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("approvals").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("hospitals").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("claims").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("notifications").withIndex("by_journey", (q) => q.eq("journeyId", id)).collect(),
      ctx.db.query("treatmentPlans").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    // The approved plan that started this journey (for its stages + cost).
    const plan = plans.find((p) => p.journeyId === id) ?? null;

    // Resolve a playable URL for each spoken notification.
    const notifications = await Promise.all(
      notifs.map(async (n) => ({
        ...n,
        audioUrl: n.audioStorageId ? await ctx.storage.getUrl(n.audioStorageId) : null,
      })),
    );

    return { journey, agents, activity, documents, approvals, hospitals, claims, notifications, plan };
  },
});

// Create a new journey for the signed-in user (the "my father needs surgery" kickoff).
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("journeys", {
      ...args,
      userId,
      stage: "Diagnosis",
      progress: 0,
      coverageLeftInr: 0,
      documentsReady: 0,
      documentsTotal: 0,
      status: "active",
    });
  },
});
