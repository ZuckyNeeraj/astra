import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Approve or reject a pending item in the Approval Center. Auth-scoped: the
// approval must belong to a journey the signed-in user owns.
export const decide = mutation({
  args: {
    id: v.id("approvals"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, { id, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const approval = await ctx.db.get(id);
    if (!approval) throw new Error("Not found");
    const journey = await ctx.db.get(approval.journeyId);
    if (!journey || journey.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { status });
    return id;
  },
});
