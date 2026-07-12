import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// The user picks a hospital from the Hospital Discovery screen. This marks it as
// selected (unselecting the others) and pushes a "Confirm hospital" item to the
// Approval Center for a final human sign-off. Auth-scoped to the owner.
export const select = mutation({
  args: { hospitalId: v.id("hospitals") },
  handler: async (ctx, { hospitalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const hospital = await ctx.db.get(hospitalId);
    if (!hospital) throw new Error("Hospital not found");
    const journey = await ctx.db.get(hospital.journeyId);
    if (!journey || journey.userId !== userId) throw new Error("Not found");

    // Mark this one selected, clear the siblings.
    const siblings = await ctx.db
      .query("hospitals")
      .withIndex("by_journey", (q) => q.eq("journeyId", hospital.journeyId))
      .collect();
    for (const s of siblings) {
      await ctx.db.patch(s._id, { selected: s._id === hospitalId });
    }

    // Replace any prior pending hospital-confirmation approval with a fresh one.
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_journey", (q) => q.eq("journeyId", hospital.journeyId))
      .collect();
    for (const a of approvals) {
      if (a.title.startsWith("Confirm hospital") && a.status === "pending") await ctx.db.delete(a._id);
    }

    const cost = hospital.estCostInr != null ? `₹${hospital.estCostInr.toLocaleString("en-IN")}` : "cost TBC";
    await ctx.db.insert("approvals", {
      journeyId: hospital.journeyId,
      title: `Confirm hospital — ${hospital.name}`,
      detail:
        `${hospital.name}${hospital.area ? `, ${hospital.area}` : ""} · Est. ${cost}. ` +
        `${hospital.why ?? ""} Approve to lock this hospital for the journey and proceed with pre-authorization.`,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.insert("activity", {
      journeyId: hospital.journeyId,
      agentName: "Hospital Agent",
      message: `You selected ${hospital.name} — sent to the Approval Center for confirmation`,
      kind: "action",
      createdAt: Date.now(),
    });

    return hospitalId;
  },
});
