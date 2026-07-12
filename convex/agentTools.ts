import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// Agent tools — the deterministic "hands" the Hermes Orchestrator calls as tools
// (via the Convex MCP server). Hermes does the REASONING (gpt-5.6-sol); these
// functions just read/write Convex state and hit external APIs (Linkup). No LLM
// calls live here on purpose — that keeps "the orchestration layer IS Hermes".
//
// These are public functions so the MCP server can invoke them. They take
// explicit ids (the orchestrator is a trusted local process, not a browser
// user), so they do NOT call getAuthUserId.
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_LABELS = ["Insurance Policy", "Aadhaar Card", "PAN Card", "Doctor's Prescription"];
const SEED_STAGES = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];

// ── Discovery: what needs orchestrating ──────────────────────────────────────
// Returns proposed (not-yet-started) treatment plans + their report/patient
// context. The autonomous watch loop polls this; Hermes turns each into a
// running journey. Once a plan is approved/rejected it drops off this list.
export const orchestration_pending = query({
  args: {},
  handler: async (ctx) => {
    // Orchestrator sees all users' plans (trusted local process).
    const plans = await ctx.db.query("treatmentPlans").take(100);
    const proposed = plans.filter((p) => p.status === "proposed");
    return Promise.all(
      proposed.map(async (p) => {
        const report = p.reportId ? await ctx.db.get(p.reportId) : null;
        return {
          planId: p._id,
          reportId: p.reportId ?? null,
          userId: p.userId,
          recommendedProcedure: p.recommendedProcedure,
          estCostInr: p.estCostInr ?? null,
          patientName: report?.patientName ?? null,
          patientAge: report?.patientAge ?? null,
          condition: report?.condition ?? null,
          diagnosis: report?.diagnosis ?? null,
          summary: p.summary,
        };
      }),
    );
  },
});

// ── Start a journey from a proposed plan (orchestrator's version of approve) ──
// Mirrors treatment.approve but auth-free: the trusted orchestrator supplies the
// planId. Creates the journey, seeds the specialist agents, links the report,
// and rejects the user's other still-proposed plans. Returns the new journeyId.
export const startJourneyFromPlan = mutation({
  args: { planId: v.id("treatmentPlans") },
  handler: async (ctx, { planId }): Promise<Id<"journeys">> => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.journeyId) return plan.journeyId; // already started — idempotent
    const report = plan.reportId ? await ctx.db.get(plan.reportId) : null;
    const userId = plan.userId;

    const vault = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const documentsReady = REQUIRED_LABELS.filter((l) => vault.some((vi) => vi.label === l)).length;

    // Seed coverage + policy from the REAL parsed insurance document, when present
    // (the Health Vault agent extracts sumInsuredInr / insurer). No fake defaults —
    // 0 / "Pending policy read" until a policy has actually been read.
    const policyDoc = vault.find((vi) => vi.docKind === "insurance_policy");
    const sumInsured = Number(policyDoc?.extractedFields?.sumInsuredInr ?? "");
    const coverageLeftInr = isFinite(sumInsured) && sumInsured > 0 ? sumInsured : 0;
    const policyLabel = policyDoc?.extractedFields?.insurer
      ? `${policyDoc.extractedFields.insurer}${policyDoc.extractedFields.policyNumber ? ` · ${policyDoc.extractedFields.policyNumber}` : ""}`
      : "Pending policy read";

    const stages = (plan.stages && plan.stages.length ? plan.stages : SEED_STAGES);
    const patientName = report?.patientName ?? "Patient";
    const journeyId = await ctx.db.insert("journeys", {
      userId,
      title: `${patientName}'s ${plan.recommendedProcedure}`,
      patientName,
      patientAge: report?.patientAge ?? 0,
      condition: report?.condition ?? "See report",
      policy: policyLabel,
      stage: stages[0],
      progress: 5,
      coverageLeftInr,
      documentsReady,
      documentsTotal: REQUIRED_LABELS.length,
      ownerName: "You",
      status: "active",
    });

    const agents = [
      { name: "Planner Agent",      role: "Journey Orchestrator", status: "working" as const, progress: 10 },
      { name: "Health Vault Agent", role: "Records Analyst",      status: "pending" as const, progress: 0 },
      { name: "Insurance Agent",    role: "Coverage Specialist",  status: "pending" as const, progress: 0 },
      { name: "Hospital Agent",     role: "Facility Coordinator", status: "pending" as const, progress: 0 },
      { name: "Document Agent",     role: "Records Manager",      status: "pending" as const, progress: 0 },
      { name: "Claim Agent",        role: "Claims Filer",         status: "pending" as const, progress: 0 },
    ];
    for (const a of agents) await ctx.db.insert("agents", { journeyId, ...a });

    await ctx.db.insert("activity", {
      journeyId, agentName: "Planner Agent",
      message: `Journey started — orchestrating plan: ${plan.recommendedProcedure}`,
      kind: "success", createdAt: Date.now(),
    });

    await ctx.db.patch(planId, { status: "approved", journeyId });
    if (report) await ctx.db.patch(report._id, { journeyId });

    // Picking one candidate dismisses the user's other still-proposed plans.
    const others = await ctx.db
      .query("treatmentPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const p of others) {
      if (p._id !== planId && p.status === "proposed") {
        await ctx.db.patch(p._id, { status: "rejected" });
      }
    }
    return journeyId;
  },
});

// ── setAgent — update a specialist's status/progress ─────────────────────────
export const setAgent = mutation({
  args: {
    journeyId: v.id("journeys"),
    name: v.string(),
    status: v.union(
      v.literal("working"), v.literal("waiting"), v.literal("done"), v.literal("pending"),
    ),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_journey", (q) => q.eq("journeyId", a.journeyId))
      .collect();
    const match = agents.find((ag) => ag.name === a.name);
    const patch: Partial<Doc<"agents">> = { status: a.status };
    if (a.progress !== undefined) patch.progress = a.progress;
    if (match) {
      await ctx.db.patch(match._id, patch);
      return match._id;
    }
    // Unknown agent name → create it, so Hermes can introduce new roles.
    return await ctx.db.insert("agents", {
      journeyId: a.journeyId, name: a.name, role: a.name,
      status: a.status, progress: a.progress ?? 0,
    });
  },
});

// ── logStep — write one live activity row (the observability signal) ──────────
export const logStep = mutation({
  args: {
    journeyId: v.id("journeys"),
    agentName: v.string(),
    message: v.string(),
    kind: v.optional(
      v.union(v.literal("info"), v.literal("success"), v.literal("warning"), v.literal("action")),
    ),
    tokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    return await ctx.db.insert("activity", {
      journeyId: a.journeyId,
      agentName: a.agentName,
      message: a.message,
      kind: a.kind ?? "info",
      tokens: a.tokens,
      costUsd: a.costUsd,
      createdAt: Date.now(),
    });
  },
});

// ── patchJourney — advance stage / progress / coverage / docs ────────────────
export const patchJourney = mutation({
  args: {
    journeyId: v.id("journeys"),
    stage: v.optional(v.string()),
    progress: v.optional(v.number()),
    coverageLeftInr: v.optional(v.number()),
    documentsReady: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const { journeyId, ...fields } = a;
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length) await ctx.db.patch(journeyId, patch);
    return journeyId;
  },
});

// ── addApproval — push a human decision to the Approval Center ────────────────
export const addApproval = mutation({
  args: { journeyId: v.id("journeys"), title: v.string(), detail: v.string() },
  handler: async (ctx, a) => {
    return await ctx.db.insert("approvals", {
      journeyId: a.journeyId, title: a.title, detail: a.detail,
      status: "pending", createdAt: Date.now(),
    });
  },
});

// ── readVault — which required documents the user has / is missing ───────────
// Now also returns what the Health Vault agent read out of each present file
// (docKind + the key extracted fields), so the orchestrator reasons over the
// REAL policy / report instead of just "a file exists".
export const readVault = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    const journey = await ctx.db.get(journeyId);
    if (!journey) return { present: [], missing: REQUIRED_LABELS, documents: [] };
    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", journey.userId))
      .collect();
    const labels = new Set(items.map((i) => i.label));
    return {
      present: REQUIRED_LABELS.filter((l) => labels.has(l)),
      missing: REQUIRED_LABELS.filter((l) => !labels.has(l)),
      documents: items.map((i) => ({
        label: i.label,
        category: i.category,
        docKind: i.docKind ?? null,
        parseStatus: i.parseStatus ?? "pending",
        summary: i.extractedSummary ?? null,
        fields: i.extractedFields ?? {},
      })),
    };
  },
});

// ── readVaultDocuments — full parsed contents of a user's vault ───────────────
// The Health Vault agent's read tool: hands the orchestrator the actual text +
// structured fields extracted from every uploaded document. Takes a journeyId
// (to resolve the owner) so it stays consistent with the other agent tools.
export const readVaultDocuments = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    const journey = await ctx.db.get(journeyId);
    if (!journey) return { documents: [] };
    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", journey.userId))
      .collect();
    return {
      documents: items.map((i) => ({
        label: i.label,
        category: i.category,
        docKind: i.docKind ?? null,
        parseStatus: i.parseStatus ?? "pending",
        summary: i.extractedSummary ?? null,
        fields: i.extractedFields ?? {},
        text: i.extractedText ?? null,
      })),
    };
  },
});

// ── getUserLocation — the journey owner's current city (for hospital search) ──
export const getUserLocation = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    const journey = await ctx.db.get(journeyId);
    if (!journey) return { city: null, region: null, country: null };
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", journey.userId))
      .unique();
    return {
      city: profile?.city ?? null,
      region: profile?.region ?? null,
      country: profile?.country ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };
  },
});

// ── addHospitalOption — record ONE real hospital the Hospital Agent found ──────
// Upserts by (journeyId, name) so re-running the agent doesn't duplicate rows.
export const addHospitalOption = mutation({
  args: {
    journeyId: v.id("journeys"),
    name: v.string(),
    area: v.optional(v.string()),
    estCostInr: v.optional(v.number()),
    coverageNote: v.optional(v.string()),
    rating: v.optional(v.number()),
    distanceKm: v.optional(v.number()),
    why: v.optional(v.string()),
    source: v.optional(v.string()),
    recommended: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("hospitals")
      .withIndex("by_journey", (q) => q.eq("journeyId", a.journeyId))
      .collect();
    const match = existing.find((h) => h.name.toLowerCase() === a.name.toLowerCase());
    const { journeyId, name, ...rest } = a;
    if (match) {
      await ctx.db.patch(match._id, rest);
      return match._id;
    }
    return await ctx.db.insert("hospitals", { journeyId, name, ...rest, createdAt: Date.now() });
  },
});

// ── fileClaim — the Claim Agent's action: real email + mocked employer portal ─
// Hermes composes the claim; this deterministically SENDS it. Emails via Resend
// when RESEND_API_KEY is set (falls back to recording the claim if not), always
// records a mocked employer/TPA portal submission, and writes a claims row + a
// live activity step. Recipient defaults to the journey owner's email so there's
// always a real, showable claim confirmation.
export const getJourneyOwner = internalQuery({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    const journey = await ctx.db.get(journeyId);
    if (!journey) return null;
    const user = await ctx.db.get(journey.userId);
    return { email: (user as any)?.email ?? null, name: (user as any)?.name ?? null };
  },
});

export const recordClaim = internalMutation({
  args: {
    journeyId: v.id("journeys"),
    hospitalName: v.optional(v.string()),
    amountInr: v.optional(v.number()),
    insurer: v.optional(v.string()),
    policyNumber: v.optional(v.string()),
    toEmail: v.optional(v.string()),
    emailStatus: v.union(v.literal("sent"), v.literal("recorded"), v.literal("failed")),
    emailRef: v.optional(v.string()),
    employerPortalRef: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    return await ctx.db.insert("claims", { ...a, createdAt: Date.now() });
  },
});

export const fileClaim = action({
  args: {
    journeyId: v.id("journeys"),
    hospitalName: v.optional(v.string()),
    amountInr: v.optional(v.number()),
    insurer: v.optional(v.string()),
    policyNumber: v.optional(v.string()),
    toEmail: v.optional(v.string()),
    summary: v.string(),          // Hermes-composed one-paragraph claim summary
  },
  handler: async (
    ctx,
    a,
  ): Promise<{ ok: boolean; emailStatus: string; employerPortalRef: string; reason?: string }> => {
    const owner: { email: string | null; name: string | null } | null = await ctx.runQuery(
      internal.agentTools.getJourneyOwner,
      { journeyId: a.journeyId },
    );
    const to = a.toEmail || owner?.email || null;

    // Mocked employer/TPA portal submission — always succeeds, deterministic ref.
    const employerPortalRef = `EMP-${a.journeyId.slice(-6).toUpperCase()}-${a.amountInr ?? 0}`;

    const subject = `Insurance claim — ${a.hospitalName ?? "hospital"} (${a.insurer ?? "insurer"})`;
    const body =
      `<h2>Astra — Insurance Claim Filed</h2>` +
      `<p>${a.summary}</p>` +
      `<ul>` +
      (a.hospitalName ? `<li><b>Hospital:</b> ${a.hospitalName}</li>` : "") +
      (a.amountInr != null ? `<li><b>Claim amount:</b> ₹${a.amountInr.toLocaleString("en-IN")}</li>` : "") +
      (a.insurer ? `<li><b>Insurer:</b> ${a.insurer}</li>` : "") +
      (a.policyNumber ? `<li><b>Policy no.:</b> ${a.policyNumber}</li>` : "") +
      `<li><b>Employer portal ref:</b> ${employerPortalRef}</li>` +
      `</ul>`;

    let emailStatus: "sent" | "recorded" | "failed" = "recorded";
    let emailRef: string | undefined;
    let reason: string | undefined;

    const key = process.env.RESEND_API_KEY;
    if (key && to) {
      try {
        const from = process.env.RESEND_FROM || "Astra <onboarding@resend.dev>";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ from, to, subject, html: body }),
        });
        if (res.ok) {
          const json = await res.json();
          emailStatus = "sent";
          emailRef = json.id;
        } else {
          emailStatus = "failed";
          reason = `resend_${res.status}: ${(await res.text()).slice(0, 160)}`;
        }
      } catch (err) {
        emailStatus = "failed";
        reason = err instanceof Error ? err.message : "resend_error";
      }
    } else {
      reason = !key ? "no_resend_key" : "no_recipient";
    }

    await ctx.runMutation(internal.agentTools.recordClaim, {
      journeyId: a.journeyId,
      hospitalName: a.hospitalName,
      amountInr: a.amountInr,
      insurer: a.insurer,
      policyNumber: a.policyNumber,
      toEmail: to ?? undefined,
      emailStatus,
      emailRef,
      employerPortalRef,
      summary: a.summary,
    });

    return { ok: emailStatus !== "failed", emailStatus, employerPortalRef, reason };
  },
});

// ── linkupHospitalSearch — real web search for hospitals + cost (Linkup) ──────
// Returns Linkup's sourced answer for Hermes to reason over. Deterministic tool:
// no LLM here. Falls back to { ok:false, reason } if the key/credits are missing
// so the orchestrator can degrade gracefully.
export const linkupHospitalSearch = action({
  args: { procedure: v.string(), city: v.optional(v.string()) },
  handler: async (
    ctx,
    { procedure, city },
  ): Promise<{ ok: boolean; answer: string | null; sources: unknown[]; reason?: string }> => {
    const key = process.env.LINKUP_API_KEY;
    if (!key) return { ok: false, answer: null, sources: [], reason: "no_linkup_key" };

    const where = city ? ` in ${city}` : " in India";
    const q = `Best hospitals${where} for ${procedure} with estimated cost in INR, and what the procedure involves`;

    try {
      const res = await fetch("https://api.linkup.so/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ q, depth: "standard", outputType: "sourcedAnswer" }),
      });
      if (!res.ok) {
        const body = await res.text();
        // 429 INSUFFICIENT_FUNDS_CREDITS lands here until credits are added.
        return { ok: false, answer: null, sources: [], reason: `linkup_${res.status}: ${body.slice(0, 200)}` };
      }
      const json = await res.json();
      return { ok: true, answer: json.answer ?? null, sources: json.sources ?? [] };
    } catch (err) {
      return { ok: false, answer: null, sources: [], reason: err instanceof Error ? err.message : "linkup_error" };
    }
  },
});
