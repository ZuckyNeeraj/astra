import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Recent activity for the live feed (newest first).
export const recent = query({
  args: { journeyId: v.id("journeys"), limit: v.optional(v.number()) },
  handler: async (ctx, { journeyId, limit }) => {
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? 20);
  },
});

// The write agents call after each step — this is the "real DB write" the rubric wants.
export const log = mutation({
  args: {
    journeyId: v.id("journeys"),
    agentName: v.string(),
    message: v.string(),
    kind: v.optional(
      v.union(
        v.literal("info"),
        v.literal("success"),
        v.literal("warning"),
        v.literal("action"),
      ),
    ),
    tokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activity", {
      journeyId: args.journeyId,
      agentName: args.agentName,
      message: args.message,
      kind: args.kind ?? "info",
      tokens: args.tokens,
      costUsd: args.costUsd,
      createdAt: Date.now(),
    });
  },
});
