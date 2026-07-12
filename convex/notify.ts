import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
  ): Promise<{ ok: boolean; voiceStatus: string; reason?: string }> => {
    let voiceStatus: "spoken" | "text_only" | "failed" = "text_only";
    let audioStorageId: Id<"_storage"> | undefined;
    let reason: string | undefined;

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
      reason = "no_elevenlabs_key";
    }

    await ctx.runMutation(internal.notify.recordNotification, {
      journeyId,
      text: message,
      voiceStatus,
      audioStorageId,
    });

    return { ok: voiceStatus !== "failed", voiceStatus, reason };
  },
});
