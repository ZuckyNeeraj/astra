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

// Clear only the journey-side tables (journeys + their agents/activity/docs/
// approvals) so the next orchestration run creates a fresh, single journey the
// dashboard shows as the current one. Keeps users, vault, emails, reports, and
// treatment plans intact. Handy between Hermes demo runs:
//   npx convex run admin:clearJourneys
export const clearJourneys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of ["activity", "agents", "documents", "approvals", "hospitals", "claims", "notifications", "journeys"] as const) {
      let n = 0;
      for (const row of await ctx.db.query(table).collect()) {
        await ctx.db.delete(row._id);
        n++;
      }
      counts[table] = n;
    }
    // Detach reports/plans from the wiped journeys so they don't dangle.
    for (const r of await ctx.db.query("reports").collect()) {
      if (r.journeyId) await ctx.db.patch(r._id, { journeyId: undefined });
    }
    for (const p of await ctx.db.query("treatmentPlans").collect()) {
      if (p.journeyId) await ctx.db.patch(p._id, { journeyId: undefined });
    }
    return counts;
  },
});

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
