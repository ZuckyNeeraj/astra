import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// The user's personal document vault (Aadhaar, PAN, policy, prescription, …).
// Files live in Convex file storage; each vaultItem row points at a storageId.

// List the signed-in user's uploaded documents, each with a temporary view URL.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      items.map(async (i) => ({
        ...i,
        url: i.storageId ? await ctx.storage.getUrl(i.storageId) : null,
      })),
    );
  },
});

// Step 1 of upload: get a short-lived URL the client POSTs the file to.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 2 of upload: save the stored file as a vault item.
// Upserts by (user, label) so re-uploading a doc replaces the old file.
export const save = mutation({
  args: {
    category: v.string(),
    label: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { category, label, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const match = existing.find((i) => i.label === label);

    if (match) {
      if (match.storageId) await ctx.storage.delete(match.storageId); // drop old file
      await ctx.db.patch(match._id, { category, storageId });
      return match._id;
    }
    return await ctx.db.insert("vaultItems", { userId, category, label, storageId });
  },
});

// Remove a document (and its stored file).
export const remove = mutation({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    if (item.storageId) await ctx.storage.delete(item.storageId);
    await ctx.db.delete(id);
  },
});
