import { internalMutation } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin / demo utilities. Run from the CLI (see the Makefile):
//   make wipe   →  npx convex run admin:wipeAll
//
// wipeAll ERASES EVERYTHING — app tables, the Convex Auth tables (so all users
// are removed and you're back to the signup screen), and uploaded files. Use it
// to rehearse the whole flow from scratch: signup → login → blank Home.
// ─────────────────────────────────────────────────────────────────────────────

// App tables (see schema.ts).
const APP_TABLES = [
  "journeys", "agents", "activity", "documents", "approvals",
  "vaultItems", "emails", "reports", "treatmentPlans", "payments",
] as const;

// Convex Auth tables (added by `...authTables`). Clearing these logs everyone
// out and forces a fresh signup.
const AUTH_TABLES = [
  "authAccounts", "authSessions", "authRefreshTokens",
  "authVerificationCodes", "authVerifiers", "authRateLimits", "users",
] as const;

export const wipeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of [...APP_TABLES, ...AUTH_TABLES]) {
      let n = 0;
      for (const row of await ctx.db.query(table).collect()) {
        await ctx.db.delete(row._id);
        n++;
      }
      counts[table] = n;
    }
    // Drop uploaded blobs (vault files, report attachments) too.
    let files = 0;
    for (const f of await ctx.db.system.query("_storage").collect()) {
      await ctx.storage.delete(f._id);
      files++;
    }
    counts._storage = files;
    return counts;
  },
});
