import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// The analysis agent. Takes an ingested health report (today: the email subject
// + snippet; tomorrow: the PDF attachment) and asks OpenAI to extract the real
// clinical picture — patient, diagnosis, condition, severity, plain-language
// summary — plus 1–3 concrete TREATMENT OPTIONS (procedure, est. INR cost,
// coverage note, journey stages).
//
// It then replaces the placeholder report fields + the "Awaiting AI analysis"
// treatment plan with the real thing, so the Home suggestion modal shows a
// genuine recommendation the user can approve.
//
// Requires OPENAI_API_KEY (Convex env var). OPENAI_MODEL is optional and
// defaults to a real vision-capable model. Without the key, analysis is a no-op
// and the ingested placeholders stay in place — the pipeline still works.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_STAGES = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];

type ReportContext = {
  userId: Id<"users">;
  subject: string;
  snippet: string;
  from: string;
} | null;

// What we ask the model to return, and what applyAnalysis writes back.
type TreatmentOption = {
  recommendedProcedure: string;
  summary: string;
  estCostInr?: number;
  coverageNote: string;
  stages: string[];
};
type Analysis = {
  patientName?: string;
  patientAge?: number;
  diagnosis: string;
  condition: string;
  severity?: string;
  summary: string;
  options: TreatmentOption[];
};

const SYSTEM_PROMPT = `You are Astra's medical-report analysis agent for an Indian healthcare-journey assistant.
Given a patient's health report (email subject + snippet, sometimes terse), extract the clinical picture and propose treatment options.

Return STRICT JSON matching this shape (no prose, no markdown):
{
  "patientName": string | null,        // patient's name if present, else null
  "patientAge": number | null,         // age in years if present, else null
  "diagnosis": string,                 // the key clinical finding, one line
  "condition": string,                 // short condition label, e.g. "Grade 3 Osteoarthritis"
  "severity": "mild" | "moderate" | "severe" | null,
  "summary": string,                   // 1-2 sentence plain-language explanation for the family
  "options": [                         // 1 to 3 realistic treatment options, best first
    {
      "recommendedProcedure": string,  // e.g. "Total Knee Replacement (TKR)"
      "summary": string,               // one line: why this option / what it involves
      "estCostInr": number | null,     // realistic total cost in INR for a private Indian hospital
      "coverageNote": string,          // one line on likely insurance coverage in India
      "stages": string[]               // ordered journey stages for this option
    }
  ]
}

Rules:
- Infer sensibly from limited text; never invent a specific patient name or age that isn't implied — use null instead.
- Costs must be realistic INR figures for private Indian hospitals (numbers only, no symbols/commas).
- Always return at least one option. Prefer the clinically recommended option first.
- If the report is not actually a medical report, still return valid JSON with your best-effort fields and a single conservative "Consult a physician" option.`;

// Load the source text for a report (its email subject + snippet).
export const getReportContext = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }): Promise<ReportContext> => {
    const report = await ctx.db.get(reportId);
    if (!report) return null;
    const email = report.emailId ? await ctx.db.get(report.emailId) : null;
    return {
      userId: report.userId,
      subject: email?.subject ?? report.diagnosis ?? "",
      snippet: email?.snippet ?? report.summary ?? "",
      from: email?.from ?? "unknown",
    };
  },
});

// Write the real analysis back: patch the report, then replace the report's
// still-proposed placeholder plan(s) with the real treatment option(s).
export const applyAnalysis = internalMutation({
  args: {
    reportId: v.id("reports"),
    patientName: v.optional(v.string()),
    patientAge: v.optional(v.number()),
    diagnosis: v.string(),
    condition: v.string(),
    severity: v.optional(v.string()),
    summary: v.string(),
    rawText: v.optional(v.string()),
    options: v.array(
      v.object({
        recommendedProcedure: v.string(),
        summary: v.string(),
        estCostInr: v.optional(v.number()),
        coverageNote: v.string(),
        stages: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, a) => {
    const report = await ctx.db.get(a.reportId);
    if (!report) return null;

    await ctx.db.patch(a.reportId, {
      patientName: a.patientName ?? report.patientName,
      patientAge: a.patientAge ?? report.patientAge,
      diagnosis: a.diagnosis,
      condition: a.condition,
      severity: a.severity,
      summary: a.summary,
      rawText: a.rawText,
    });

    // Remove the placeholder proposed plan(s) for this report; approved/rejected
    // plans are left untouched so re-analysis never disturbs a started journey.
    const existing = await ctx.db
      .query("treatmentPlans")
      .withIndex("by_user", (q) => q.eq("userId", report.userId))
      .collect();
    for (const p of existing) {
      if (p.reportId === a.reportId && p.status === "proposed") {
        await ctx.db.delete(p._id);
      }
    }

    // Insert the real option(s) as fresh proposed plans.
    const now = Date.now();
    for (const opt of a.options) {
      await ctx.db.insert("treatmentPlans", {
        userId: report.userId,
        reportId: a.reportId,
        summary: opt.summary,
        recommendedProcedure: opt.recommendedProcedure,
        stages: opt.stages.length ? opt.stages : DEFAULT_STAGES,
        estCostInr: opt.estCostInr,
        coverageNote: opt.coverageNote,
        status: "proposed",
        createdAt: now,
      });
    }
    return a.options.length;
  },
});

// Call OpenAI with the report text and return a validated Analysis.
async function runOpenAI(subject: string, snippet: string, from: string): Promise<Analysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("no_openai_key");
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const userText =
    `From: ${from}\nSubject: ${subject}\n\nReport snippet:\n${snippet || "(no body text available)"}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openai_${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  // Normalise into our shape, coercing nulls → undefined and clamping options.
  const rawOptions: unknown[] = Array.isArray(parsed.options) ? parsed.options : [];
  const options: TreatmentOption[] = rawOptions.slice(0, 3).map((o: any) => ({
    recommendedProcedure: String(o?.recommendedProcedure ?? "Specialist consultation"),
    summary: String(o?.summary ?? ""),
    estCostInr:
      typeof o?.estCostInr === "number" && isFinite(o.estCostInr) ? Math.round(o.estCostInr) : undefined,
    coverageNote: String(o?.coverageNote ?? "Coverage to be confirmed with your insurer."),
    stages: Array.isArray(o?.stages) ? o.stages.map(String) : DEFAULT_STAGES,
  }));
  if (options.length === 0) {
    options.push({
      recommendedProcedure: "Specialist consultation",
      summary: "Review the report with a specialist to confirm the treatment path.",
      coverageNote: "Coverage to be confirmed with your insurer.",
      stages: DEFAULT_STAGES,
    });
  }

  return {
    patientName: typeof parsed.patientName === "string" ? parsed.patientName : undefined,
    patientAge: typeof parsed.patientAge === "number" ? parsed.patientAge : undefined,
    diagnosis: String(parsed.diagnosis ?? subject ?? "Health report"),
    condition: String(parsed.condition ?? "See report"),
    severity: typeof parsed.severity === "string" ? parsed.severity : undefined,
    summary: String(parsed.summary ?? snippet ?? ""),
    options,
  };
}

// The agent: analyse one report and write the result back. Scheduled from
// inbox.ingestEmail right after a report is created (and callable directly).
export const analyzeReport = internalAction({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }): Promise<{ status: string; options?: number }> => {
    const clinicalCtx: ReportContext = await ctx.runQuery(internal.analysis.getReportContext, { reportId });
    if (!clinicalCtx) return { status: "report_not_found" };

    let analysis: Analysis;
    try {
      analysis = await runOpenAI(clinicalCtx.subject, clinicalCtx.snippet, clinicalCtx.from);
    } catch (err) {
      // No key / API error → leave the ingested placeholders in place.
      console.error("analyzeReport failed:", err instanceof Error ? err.message : err);
      return { status: "analysis_failed" };
    }

    const count: number | null = await ctx.runMutation(internal.analysis.applyAnalysis, {
      reportId,
      patientName: analysis.patientName,
      patientAge: analysis.patientAge,
      diagnosis: analysis.diagnosis,
      condition: analysis.condition,
      severity: analysis.severity,
      summary: analysis.summary,
      rawText: `${clinicalCtx.subject}\n\n${clinicalCtx.snippet}`,
      options: analysis.options,
    });
    return { status: "ok", options: count ?? 0 };
  },
});

// Manual re-analysis for the signed-in user's still-proposed reports — handy for
// re-running the agent over already-ingested demo data without a fresh scan.
export const reanalyzeMine = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; analyzed: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "unauthenticated", analyzed: 0 };
    const reportIds: Array<Id<"reports">> = await ctx.runQuery(internal.analysis.myProposedReports, {});
    for (const reportId of reportIds) {
      await ctx.runAction(internal.analysis.analyzeReport, { reportId });
    }
    return { status: "ok", analyzed: reportIds.length };
  },
});

// Report ids for the signed-in user that still have a proposed (un-approved) plan.
export const myProposedReports = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<Id<"reports">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const plans = await ctx.db
      .query("treatmentPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ids = new Set<Id<"reports">>();
    for (const p of plans) {
      if (p.status === "proposed" && p.reportId) ids.add(p.reportId);
    }
    return [...ids];
  },
});
