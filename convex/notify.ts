import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Send the update as an email to the journey owner via Resend. Returns the
// email status without throwing — a failed email must not break the notification.
async function sendEmail(to: string, subject: string, text: string): Promise<{ status: "sent" | "failed"; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "failed", reason: "no_resend_key" };
  try {
    const from = process.env.RESEND_FROM || "Astra <onboarding@resend.dev>";
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0B192C"><h2 style="color:#0284C7">Astra — Journey Update</h2><p>${text}</p><p style="color:#64748B;font-size:13px">Sent by your Astra care-coordination agents.</p></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (res.ok) return { status: "sent" };
    return { status: "failed", reason: `resend_${res.status}: ${(await res.text()).slice(0, 160)}` };
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : "resend_error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The Notification Agent's real output: turn a journey update into SPOKEN audio
// with ElevenLabs and store it so the family can play it in the app.
//
// Deterministic "hand" (Hermes composes the message, this speaks it). When
// ELEVENLABS_API_KEY is set it calls text-to-speech, stores the MP3 in Convex
// file storage, and records a notification the Voice screen plays. Without the
// key it records the text only — the pipeline still works.
//
// Optional env: ELEVENLABS_VOICE_ID (defaults to a standard public voice),
// ELEVENLABS_MODEL_ID (defaults to eleven_turbo_v2_5).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — a standard ElevenLabs voice
const DEFAULT_MODEL = "eleven_turbo_v2_5";

export const recordNotification = internalMutation({
  args: {
    journeyId: v.id("journeys"),
    text: v.string(),
    voiceStatus: v.union(v.literal("spoken"), v.literal("text_only"), v.literal("failed")),
    audioStorageId: v.optional(v.id("_storage")),
    emailStatus: v.optional(v.union(v.literal("sent"), v.literal("recorded"), v.literal("failed"))),
    toEmail: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    return await ctx.db.insert("notifications", { ...a, createdAt: Date.now() });
  },
});

export const notifyFamily = action({
  args: { journeyId: v.id("journeys"), message: v.string() },
  handler: async (
    ctx,
    { journeyId, message },
  ): Promise<{ ok: boolean; voiceStatus: string; emailStatus: string; toEmail: string | null; reason?: string }> => {
    let voiceStatus: "spoken" | "text_only" | "failed" = "text_only";
    let audioStorageId: Id<"_storage"> | undefined;
    let reason: string | undefined;

    // Email the same user (journey owner) in parallel with the voice.
    const owner: { email: string | null; name: string | null } | null = await ctx.runQuery(
      internal.agentTools.getJourneyOwner,
      { journeyId },
    );
    const to = owner?.email ?? null;
    let emailStatus: "sent" | "recorded" | "failed" = "recorded";
    if (to) {
      const r = await sendEmail(to, "Astra — update on your care journey", message);
      emailStatus = r.status === "sent" ? "sent" : "failed";
      if (r.reason && !reason) reason = r.reason;
    }

    const key = process.env.ELEVENLABS_API_KEY;
    if (key) {
      try {
        const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
        const model = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text: message,
            model_id: model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });
        if (res.ok) {
          const audio = await res.blob(); // audio/mpeg
          audioStorageId = await ctx.storage.store(audio);
          voiceStatus = "spoken";
        } else {
          voiceStatus = "failed";
          reason = `elevenlabs_${res.status}: ${(await res.text()).slice(0, 160)}`;
        }
      } catch (err) {
        voiceStatus = "failed";
        reason = err instanceof Error ? err.message : "elevenlabs_error";
      }
    } else {
      if (!reason) reason = "no_elevenlabs_key";
    }

    await ctx.runMutation(internal.notify.recordNotification, {
      journeyId,
      text: message,
      voiceStatus,
      audioStorageId,
      emailStatus,
      toEmail: to ?? undefined,
    });

    return { ok: voiceStatus !== "failed", voiceStatus, emailStatus, toEmail: to, reason };
  },
});
