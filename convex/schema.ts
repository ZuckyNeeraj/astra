import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ─────────────────────────────────────────────────────────────────────────────
// Astra shared data model.
//
// Auth: `...authTables` adds the Convex Auth tables (users, authSessions,
// authAccounts, …). Every app row is scoped to a `userId: v.id("users")` and
// queried through a `by_user` index so each account only sees its own data.
//
// Child tables (agents, activity, documents, approvals) are scoped indirectly
// through their parent journey's `journeyId`.
// ─────────────────────────────────────────────────────────────────────────────

export default defineSchema({
  ...authTables,

  // One healthcare journey a family is going through (the hero card on Home).
  journeys: defineTable({
    userId: v.id("users"),
    title: v.string(),                 // "Father's Knee Surgery"
    patientName: v.string(),           // "Rajiv Kumar"
    patientAge: v.number(),            // 62
    condition: v.string(),             // "Grade 3 Osteoarthritis"
    policy: v.string(),                // "Star Health Comprehensive"
    stage: v.string(),                 // "Hospital Booking"
    progress: v.number(),              // 0..100
    coverageLeftInr: v.number(),       // 420000
    estSurgeryDate: v.optional(v.string()),
    documentsReady: v.number(),        // 5
    documentsTotal: v.number(),        // 7
    ownerName: v.string(),             // "Rahul Sharma" (guardian display name)
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // The AI specialist agents working a journey (Planner, Insurance, Hospital, …).
  agents: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),
    role: v.string(),
    status: v.union(
      v.literal("working"),
      v.literal("waiting"),
      v.literal("done"),
      v.literal("pending"),
    ),
    progress: v.number(),
  }).index("by_journey", ["journeyId"]),

  // Live activity feed — every step an agent takes (drives observability).
  activity: defineTable({
    journeyId: v.id("journeys"),
    agentName: v.string(),
    message: v.string(),
    kind: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("action"),
    ),
    tokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  // Documents collected / needed for the journey (Document Vault view).
  documents: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),
    type: v.string(),
    status: v.union(
      v.literal("ready"),
      v.literal("missing"),
      v.literal("pending"),
    ),
    storageId: v.optional(v.id("_storage")),
  }).index("by_journey", ["journeyId"]),

  // Things awaiting a human decision (Approval Center).
  approvals: defineTable({
    journeyId: v.id("journeys"),
    title: v.string(),
    detail: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  // The signed-in user's current location (captured from the browser, reverse-
  // geocoded to a city). Drives location-aware hospital search. One row per user.
  profiles: defineTable({
    userId: v.id("users"),
    city: v.optional(v.string()),      // "Pune"
    region: v.optional(v.string()),    // "Maharashtra"
    country: v.optional(v.string()),   // "India"
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Real hospital options a Hospital Agent found (via Linkup) for one journey.
  // Written by the agent, read by the Hospitals screen — nothing hardcoded.
  hospitals: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),
    area: v.optional(v.string()),          // neighbourhood / locality
    estCostInr: v.optional(v.number()),
    coverageNote: v.optional(v.string()),
    rating: v.optional(v.number()),
    distanceKm: v.optional(v.number()),
    why: v.optional(v.string()),           // one line: why this hospital
    source: v.optional(v.string()),        // sourced URL from Linkup
    recommended: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  // Persistent user profile / Health Vault (memory that survives across tasks).
  vaultItems: defineTable({
    userId: v.id("users"),
    category: v.string(),              // "identity" | "insurance" | "medical" | "financial" | "contact" | "preference"
    label: v.string(),                // "Aadhaar" | "Insurance Policy" | ...
    value: v.optional(v.string()),    // redacted / reference text
    storageId: v.optional(v.id("_storage")), // uploaded file, when present

    // ── Health Vault agent: what the parser read out of the uploaded file ──────
    docKind: v.optional(v.string()),  // "insurance_policy" | "medical_report" | "prescription" | "id" | "other"
    extractedText: v.optional(v.string()),   // plain text pulled from the PDF/image
    extractedFields: v.optional(v.record(v.string(), v.string())), // structured, e.g. { insurer, policyNumber, sumInsured }
    extractedSummary: v.optional(v.string()), // one-line human summary for the UI
    parseStatus: v.optional(
      v.union(v.literal("pending"), v.literal("parsed"), v.literal("failed")),
    ),
    parsedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // ── New pipeline tables (Gmail → report → treatment → payments) ─────────────

  // Emails ingested from the user's inbox (health-report trigger).
  emails: defineTable({
    userId: v.id("users"),
    gmailId: v.optional(v.string()),  // Gmail message id (dedupe)
    from: v.string(),
    subject: v.string(),
    snippet: v.optional(v.string()),
    receivedAt: v.number(),
    attachmentStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("new"),
      v.literal("parsed"),
      v.literal("ignored"),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_gmailId", ["gmailId"]),

  // Parsed health report extracted from an email attachment.
  reports: defineTable({
    userId: v.id("users"),
    emailId: v.optional(v.id("emails")),
    journeyId: v.optional(v.id("journeys")),
    patientName: v.optional(v.string()),
    patientAge: v.optional(v.number()),
    diagnosis: v.string(),
    condition: v.string(),
    severity: v.optional(v.string()),
    summary: v.string(),
    rawText: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // AI-proposed treatment/journey plan awaiting the user's verification.
  treatmentPlans: defineTable({
    userId: v.id("users"),
    reportId: v.optional(v.id("reports")),
    journeyId: v.optional(v.id("journeys")),
    summary: v.string(),
    recommendedProcedure: v.string(),
    stages: v.array(v.string()),
    estCostInr: v.optional(v.number()),
    coverageNote: v.optional(v.string()),
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Notifications the Notification Agent sends the family (spoken via ElevenLabs
  // and/or email). The audio is stored in Convex file storage and played in-app.
  notifications: defineTable({
    journeyId: v.id("journeys"),
    text: v.string(),
    voiceStatus: v.union(       // ElevenLabs TTS leg
      v.literal("spoken"),      // audio generated + stored
      v.literal("text_only"),   // no voice provider configured
      v.literal("failed"),
    ),
    audioStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  // Insurance claims the Claim Agent files (real email + mocked employer portal).
  claims: defineTable({
    journeyId: v.id("journeys"),
    hospitalName: v.optional(v.string()),
    amountInr: v.optional(v.number()),
    insurer: v.optional(v.string()),
    policyNumber: v.optional(v.string()),
    toEmail: v.optional(v.string()),
    emailStatus: v.union(     // real email leg
      v.literal("sent"),
      v.literal("recorded"),  // no email provider configured → drafted/recorded only
      v.literal("failed"),
    ),
    emailRef: v.optional(v.string()),        // provider message id
    employerPortalRef: v.optional(v.string()), // mocked employer/TPA submission ref
    summary: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_journey", ["journeyId"]),

  // Payments made through the product (Dodo deposits / co-pays).
  payments: defineTable({
    userId: v.id("users"),
    journeyId: v.optional(v.id("journeys")),
    purpose: v.string(),              // "deposit" | "co-pay" | "settlement"
    amountInr: v.number(),
    provider: v.string(),             // "dodo"
    providerRef: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
