import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// Inbox → report → treatment-suggestion pipeline.
//
// Two entry points:
//   • simulateReport  — demo trigger (the "Scan inbox" button). Deterministic,
//     no external services, works immediately.
//   • pollGmail       — real Gmail polling (Convex cron). No-ops until you set
//     the GMAIL_* env vars (see agents/.env.example + README).
//
// Both funnel into the same shape: an email + a parsed report + a *proposed*
// treatment plan the user then verifies on the Home screen.
// ─────────────────────────────────────────────────────────────────────────────

type Ingest = {
  from: string;
  subject: string;
  snippet: string;
  patientName: string;
  patientAge: number;
  diagnosis: string;
  condition: string;
  severity: string;
  summary: string;
  procedure: string;
  stages: string[];
  estCostInr: number;
  coverageNote: string;
};

const STAGES = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];

// Sample reports the demo trigger rotates through.
const SAMPLES: Ingest[] = [
  {
    from: "reports@medlabdiagnostics.in",
    subject: "MRI Report — Rajiv Kumar",
    snippet: "MRI of the right knee shows Grade 3 osteoarthritis with significant cartilage loss.",
    patientName: "Rajiv Kumar",
    patientAge: 62,
    diagnosis: "Grade 3 Osteoarthritis, right knee",
    condition: "Grade 3 Osteoarthritis",
    severity: "Moderate–Severe",
    summary: "MRI shows advanced cartilage degeneration and joint-space narrowing in the right knee, consistent with Grade 3 osteoarthritis. Conservative therapy unlikely to suffice.",
    procedure: "Total Knee Replacement (TKR)",
    stages: STAGES,
    estCostInr: 350000,
    coverageNote: "Likely covered under your uploaded Star Health policy up to ₹5,00,000 (cashless).",
  },
  {
    from: "labresults@apollodiagnostics.in",
    subject: "Cardiac Angiography — Sunita Rao",
    snippet: "Coronary angiography reveals double-vessel disease with ~80% stenosis in the LAD.",
    patientName: "Sunita Rao",
    patientAge: 58,
    diagnosis: "Coronary Artery Disease (double vessel)",
    condition: "CAD — double vessel",
    severity: "Severe",
    summary: "Angiography indicates significant double-vessel coronary artery disease with ~80% LAD stenosis. Revascularisation recommended.",
    procedure: "Coronary Angioplasty (PCI) with stent",
    stages: STAGES,
    estCostInr: 280000,
    coverageNote: "Cardiac procedures covered under your policy; pre-authorization required before admission.",
  },
];

// Shared insert: email (parsed) + report + proposed treatment plan.
async function insertIngested(
  ctx: { db: any },
  userId: Id<"users">,
  s: Ingest,
) {
  const now = Date.now();
  const emailId = await ctx.db.insert("emails", {
    userId, from: s.from, subject: s.subject, snippet: s.snippet,
    receivedAt: now, status: "parsed",
  });
  const reportId = await ctx.db.insert("reports", {
    userId, emailId, patientName: s.patientName, patientAge: s.patientAge,
    diagnosis: s.diagnosis, condition: s.condition, severity: s.severity,
    summary: s.summary, createdAt: now,
  });
  const planId = await ctx.db.insert("treatmentPlans", {
    userId, reportId, summary: s.summary, recommendedProcedure: s.procedure,
    stages: s.stages, estCostInr: s.estCostInr, coverageNote: s.coverageNote,
    status: "proposed", createdAt: now,
  });
  return { emailId, reportId, planId };
}

// Demo trigger — creates a simulated incoming report + AI suggestion.
export const simulateReport = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const s = SAMPLES[existing.length % SAMPLES.length];
    return await insertIngested(ctx, userId, s);
  },
});

// Internal write used by the Gmail poller (runs without a user session).
export const ingestForUser = internalMutation({
  args: {
    userId: v.id("users"),
    data: v.object({
      from: v.string(), subject: v.string(), snippet: v.string(),
      patientName: v.string(), patientAge: v.number(),
      diagnosis: v.string(), condition: v.string(), severity: v.string(),
      summary: v.string(), procedure: v.string(), stages: v.array(v.string()),
      estCostInr: v.number(), coverageNote: v.string(),
    }),
  },
  handler: async (ctx, { userId, data }) => {
    return await insertIngested(ctx, userId, data);
  },
});

// Helpers the poller needs (no auth context inside a cron).
export const firstUserId = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("users").first())?._id ?? null,
});

export const seenGmailIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.gmailId).filter(Boolean);
  },
});

// Real Gmail polling. No-ops until GMAIL_* env vars are set (Google OAuth).
// Attaches ingested reports to the first registered user (single-inbox demo).
export const pollGmail = internalAction({
  args: {},
  handler: async (ctx): Promise<{ status: string; ingested?: number }> => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      return { status: "skipped: GMAIL_* env vars not set" };
    }

    const userId = await ctx.runQuery(internal.inbox.firstUserId, {});
    if (!userId) return { status: "skipped: no users yet" };

    try {
      // 1. Exchange refresh token for an access token.
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: refreshToken, grant_type: "refresh_token",
        }),
      });
      const { access_token } = await tokenRes.json();
      if (!access_token) return { status: "error: token exchange failed" };
      const authH = { Authorization: `Bearer ${access_token}` };

      // 2. List recent report-like emails.
      const listRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=" +
          encodeURIComponent("(report OR MRI OR scan OR diagnosis) newer_than:2d") +
          "&maxResults=5",
        { headers: authH },
      );
      const list = await listRes.json();
      const ids: string[] = (list.messages ?? []).map((m: any) => m.id);

      const seen = new Set(await ctx.runQuery(internal.inbox.seenGmailIds, { userId }));
      const fresh = ids.filter((id) => !seen.has(id));

      // 3. For each new email, build a suggestion (OpenAI if configured).
      let ingested = 0;
      for (const id of fresh) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: authH },
        );
        const msg = await msgRes.json();
        const headers: any[] = msg.payload?.headers ?? [];
        const from = headers.find((h) => h.name === "From")?.value ?? "unknown";
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "Health report";
        const snippet = msg.snippet ?? "";

        const suggestion = await suggestFromText(`${subject}\n${snippet}`);
        await ctx.runMutation(internal.inbox.ingestForUser, {
          userId,
          data: { from, subject, snippet, ...suggestion },
        });
        ingested++;
      }
      return { status: "ok", ingested };
    } catch (e) {
      return { status: `error: ${String(e)}` };
    }
  },
});

// Turn report text into a structured treatment suggestion.
// Uses OpenAI when OPENAI_API_KEY is set; otherwise a safe generic fallback.
async function suggestFromText(text: string): Promise<Omit<Ingest, "from" | "subject" | "snippet">> {
  const key = process.env.OPENAI_API_KEY;
  const fallback = {
    patientName: "Patient", patientAge: 0,
    diagnosis: text.slice(0, 120), condition: "See report",
    severity: "Unknown",
    summary: `Report received: ${text.slice(0, 200)}`,
    procedure: "Specialist consultation recommended",
    stages: STAGES, estCostInr: 0,
    coverageNote: "Coverage to be checked against your uploaded policy.",
  };
  if (!key) return fallback;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a medical care coordinator. From the health report text, return JSON with keys: patientName, patientAge (number), diagnosis, condition, severity, summary, procedure (recommended treatment), estCostInr (number, rough India estimate), coverageNote. Be concise." },
          { role: "user", content: text },
        ],
      }),
    });
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return { ...fallback, ...parsed, stages: STAGES };
  } catch {
    return fallback;
  }
}
