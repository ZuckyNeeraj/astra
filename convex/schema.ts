import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// Astra shared data model. This file IS the shared DB contract — edit it here,
// run `npx convex dev`, and every teammate's client picks up the new types.
//
// Modeled directly off the current frontend (see frontend/src/app/App.tsx):
// journeys → agents → activity feed → documents → approvals → vault items.
// Keep it small for the sprint; extend as agents start writing real output.
// ─────────────────────────────────────────────────────────────────────────────

export default defineSchema({
  // One healthcare journey a family is going through (the hero card on Home).
  journeys: defineTable({
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
    ownerName: v.string(),             // "Rahul Sharma" (guardian using the app)
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
  }).index("by_status", ["status"]),

  // The AI specialist agents working a journey (Planner, Insurance, Hospital, …).
  agents: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),                  // "Insurance Agent"
    role: v.string(),                  // short description of the function
    status: v.union(
      v.literal("working"),
      v.literal("waiting"),
      v.literal("done"),
      v.literal("pending"),
    ),
    progress: v.number(),              // 0..100
  }).index("by_journey", ["journeyId"]),

  // Live activity feed — every step an agent takes (drives observability/run viewer).
  activity: defineTable({
    journeyId: v.id("journeys"),
    agentName: v.string(),             // who did it
    message: v.string(),               // "Hospital Agent contacted Apollo — slot checked"
    kind: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("action"),
    ),
    // Optional observability metadata for the AI Activity Dashboard.
    tokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),             // Date.now() from the caller
  }).index("by_journey", ["journeyId"]),

  // Documents collected / needed for the journey (Document Vault).
  documents: defineTable({
    journeyId: v.id("journeys"),
    name: v.string(),                  // "MRI Report"
    type: v.string(),                  // "medical" | "insurance" | "identity" | ...
    status: v.union(
      v.literal("ready"),
      v.literal("missing"),
      v.literal("pending"),
    ),
    storageId: v.optional(v.id("_storage")), // Convex file storage ref, when uploaded
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

  // Persistent user profile / Health Vault (memory that survives across tasks).
  vaultItems: defineTable({
    ownerName: v.string(),
    label: v.string(),                 // "Aadhaar" | "PAN" | "Insurance Policy" | ...
    value: v.optional(v.string()),     // redacted / reference; files go to storage
    storageId: v.optional(v.id("_storage")),
  }).index("by_owner", ["ownerName"]),
});
