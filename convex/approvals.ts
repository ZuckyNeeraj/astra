import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Guess which agent owns an approval from its title (for eval attribution).
function agentFor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("hospital")) return "Hospital Agent";
  if (t.includes("pre-auth") || t.includes("insurance") || t.includes("coverage")) return "Insurance Agent";
  if (t.includes("document") || t.includes("upload")) return "Document Agent";
  if (t.includes("claim")) return "Claim Agent";
  return "Planner Agent";
}

// Approve or reject a pending item in the Approval Center. Auth-scoped: the
// approval must belong to a journey the signed-in user owns. A REJECTION is a
// real failure signal → it's auto-captured into the eval set (closed loop).
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

    if (status === "rejected") {
      await ctx.scheduler.runAfter(0, internal.evals.capture, {
        title: `Rejected: ${approval.title}`,
        source: "human_rejection",
        agentName: agentFor(approval.title),
        context: approval.detail,
        issue: "A human rejected this agent proposal.",
        expected: "Produce a proposal the human accepts.",
        journeyId: approval.journeyId,
      });
    }
    return id;
  },
});
