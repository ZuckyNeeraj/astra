import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// The signed-in user's record (email, name, …) or null when logged out.
export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
