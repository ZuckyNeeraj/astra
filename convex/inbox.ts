import { action, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─────────────────────────────────────────────────────────────────────────────
// Real Gmail ingestion. "Scan inbox" (scanInbox) and the 1-min cron (pollGmail)
// both pull emails from the LAST 30 DAYS whose subject STARTS WITH "Health
// Report", then create — for EACH matching email — an email row + a placeholder
// report + a *proposed* treatment plan (one candidate journey per report).
// The user picks which candidate journey to start in the Home suggestion modal.
//
// The treatment content is a placeholder for now ("Awaiting AI analysis") — the
// analysis agent that fills the modal is built tomorrow.
//
// Requires GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN env vars.
// Without them, a scan returns { status: "no_gmail" } and does nothing.
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];

type GmailReport = { gmailId: string; from: string; subject: string; snippet: string };

// A subject counts as a health report only when it STARTS WITH "Health Report"
// (case-insensitive, ignoring any leading whitespace). Gmail's `subject:` search
// can only match the phrase anywhere, so we anchor the prefix ourselves here.
function isHealthReportSubject(subject: string): boolean {
  return subject.trimStart().toLowerCase().startsWith("health report");
}

// Pull "Health Report" emails from the last 30 days via the Gmail REST API.
async function fetchGmailReports(): Promise<
  { ok: true; reports: GmailReport[] } | { ok: false; reason: string }
> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return { ok: false, reason: "no_gmail" };

  // 1. Refresh token → access token.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) return { ok: false, reason: "auth_failed" };
  const authH = { Authorization: `Bearer ${token.access_token}` };

  // 2. Search: subject "Health Report", received in the last 30 days.
  const after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const q = encodeURIComponent(`subject:"health report" after:${after}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=10`,
    { headers: authH },
  );
  const list = await listRes.json();
  const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);

  // 3. Fetch From/Subject + snippet for each.
  const reports: GmailReport[] = [];
  for (const id of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: authH },
    );
    const msg = await msgRes.json();
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    // Anchor to the prefix — skip anything that merely mentions "health report".
    if (!isHealthReportSubject(subject)) continue;
    reports.push({
      gmailId: id,
      from: headers.find((h) => h.name === "From")?.value ?? "unknown",
      subject,
      snippet: msg.snippet ?? "",
    });
  }
  return { ok: true, reports };
}

// Save one Gmail report → email + placeholder report + proposed plan.
// Deduped by gmailId, so re-scanning the same email is a no-op.
export const ingestEmail = internalMutation({
  args: {
    userId: v.id("users"),
    gmailId: v.string(),
    from: v.string(),
    subject: v.string(),
    snippet: v.string(),
  },
  handler: async (ctx, a) => {
    const dup = await ctx.db
      .query("emails")
      .withIndex("by_gmailId", (q) => q.eq("gmailId", a.gmailId))
      .first();
    if (dup) return null;

    const now = Date.now();
    const emailId = await ctx.db.insert("emails", {
      userId: a.userId, gmailId: a.gmailId, from: a.from, subject: a.subject,
      snippet: a.snippet, receivedAt: now, status: "parsed",
    });
    const reportId = await ctx.db.insert("reports", {
      userId: a.userId, emailId,
      diagnosis: a.subject,
      condition: "Pending analysis",
      summary: a.snippet || "Health report received — pending analysis.",
      createdAt: now,
    });
    await ctx.db.insert("treatmentPlans", {
      userId: a.userId, reportId,
      summary: a.snippet || a.subject,
      recommendedProcedure: "Awaiting AI analysis",
      stages: STAGES,
      coverageNote: "Will be checked once the report is analyzed.",
      status: "proposed",
      createdAt: now,
    });

    // Kick off the analysis agent — it replaces the placeholder report fields +
    // treatment plan with a real diagnosis and treatment option(s). No-ops if
    // OPENAI_API_KEY isn't set, leaving the placeholders above in place.
    await ctx.scheduler.runAfter(0, internal.analysis.analyzeReport, { reportId });

    return emailId;
  },
});

// Demo utility — wipe ingested emails/reports/proposed+rejected plans so a fresh
// scan re-surfaces every candidate. Keeps approved plans + journeys intact.
// Handy to reset ALL users between demo runs: `npx convex run inbox:resetPipeline`.
export const resetPipeline = internalMutation({
  args: {},
  handler: async (ctx) => {
    let removed = { emails: 0, reports: 0, plans: 0 };
    for (const e of await ctx.db.query("emails").collect()) { await ctx.db.delete(e._id); removed.emails++; }
    for (const r of await ctx.db.query("reports").collect()) {
      if (!r.journeyId) { await ctx.db.delete(r._id); removed.reports++; }
    }
    for (const p of await ctx.db.query("treatmentPlans").collect()) {
      if (p.status !== "approved") { await ctx.db.delete(p._id); removed.plans++; }
    }
    return removed;
  },
});

// "Reset demo data" button — same as resetPipeline but scoped to the signed-in
// user, so a fresh Scan inbox re-surfaces their dismissed/ingested candidates.
export const resetDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const removed = { journeys: 0, emails: 0, reports: 0, plans: 0 };

    // Clear the user's journeys + every child row (agents/activity/docs/approvals/
    // hospitals/claims/notifications) so the dashboard starts on a clean slate.
    const journeys = await ctx.db.query("journeys").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const j of journeys) {
      for (const table of ["agents", "activity", "documents", "approvals", "hospitals", "claims", "notifications"] as const) {
        for (const row of await ctx.db.query(table).withIndex("by_journey", (q) => q.eq("journeyId", j._id)).collect()) {
          await ctx.db.delete(row._id);
        }
      }
      await ctx.db.delete(j._id);
      removed.journeys++;
    }

    // Clear the ingestion pipeline entirely (emails, reports, all plans). Keeps
    // the vault (uploaded docs) so a fresh Scan re-surfaces the popup.
    for (const e of await ctx.db.query("emails").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) { await ctx.db.delete(e._id); removed.emails++; }
    for (const r of await ctx.db.query("reports").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) { await ctx.db.delete(r._id); removed.reports++; }
    for (const p of await ctx.db.query("treatmentPlans").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) { await ctx.db.delete(p._id); removed.plans++; }
    return removed;
  },
});

export const firstUserId = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("users").first())?._id ?? null,
});

// "Scan inbox" button — scans the signed-in user's connected inbox on demand.
export const scanInbox = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; count?: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "unauthenticated" };
    const res = await fetchGmailReports();
    if (!res.ok) return { status: res.reason };
    let count = 0;
    for (const r of res.reports) {
      const inserted = await ctx.runMutation(internal.inbox.ingestEmail, { userId, ...r });
      if (inserted) count++;
    }
    return { status: "ok", count };
  },
});

// Always-on polling (cron, every minute). Attaches to the first user
// (single-inbox demo). No-ops until GMAIL_* env vars are set.
export const pollGmail = internalAction({
  args: {},
  handler: async (ctx): Promise<{ status: string; count?: number }> => {
    const userId = await ctx.runQuery(internal.inbox.firstUserId, {});
    if (!userId) return { status: "no_user" };
    const res = await fetchGmailReports();
    if (!res.ok) return { status: res.reason };
    let count = 0;
    for (const r of res.reports) {
      const inserted = await ctx.runMutation(internal.inbox.ingestEmail, { userId, ...r });
      if (inserted) count++;
    }
    return { status: "ok", count };
  },
});
