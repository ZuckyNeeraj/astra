import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ElevenLabs voice Q&A: ask about your journey ("what's my co-pay?") → answered
// from your REAL data (journey, parsed policy, hospitals) and spoken aloud.

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_turbo_v2_5";

// Gather the signed-in user's real context for the answer.
export const myContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const journey = (await ctx.db.query("journeys").withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active")).collect())[0];
    const vault = await ctx.db.query("vaultItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const policy = vault.find((vi) => vi.docKind === "insurance_policy");
    const plans = await ctx.db.query("treatmentPlans").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const plan = journey ? plans.find((p) => p.journeyId === journey._id) : undefined;
    const hospitals = journey ? await ctx.db.query("hospitals").withIndex("by_journey", (q) => q.eq("journeyId", journey._id)).collect() : [];
    const pf = policy?.extractedFields ?? {};
    return {
      patientName: journey?.patientName ?? null,
      patientAge: journey?.patientAge ?? null,
      condition: journey?.condition ?? null,
      procedure: plan?.recommendedProcedure ?? null,
      estCostInr: plan?.estCostInr ?? null,
      insurer: pf.insurer ?? null,
      policyNumber: pf.policyNumber ?? null,
      sumInsuredInr: pf.sumInsuredInr ?? null,
      coPay: pf.coPay ?? null,
      roomRentCap: pf.roomRentCap ?? null,
      coverageLeftInr: journey?.coverageLeftInr ?? null,
      hospitals: hospitals.map((h) => `${h.name}${h.recommended ? " (recommended)" : ""}${h.estCostInr ? ` ₹${h.estCostInr}` : ""}`),
    };
  },
});

export const ask = action({
  args: { question: v.string() },
  handler: async (
    ctx,
    { question },
  ): Promise<{ answer: string; audioUrl: string | null; spoken: boolean }> => {
    const c: any = await ctx.runQuery(internal.voice.myContext, {});
    if (!c) return { answer: "Please sign in first.", audioUrl: null, spoken: false };

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const facts =
      `Patient: ${c.patientName ?? "unknown"}, age ${c.patientAge ?? "unknown"}. Condition: ${c.condition ?? "unknown"}. ` +
      `Procedure: ${c.procedure ?? "unknown"} (est INR ${c.estCostInr ?? "unknown"}). ` +
      `Insurer: ${c.insurer ?? "none on file"}, policy ${c.policyNumber ?? "-"}, sum insured INR ${c.sumInsuredInr ?? "unknown"}, ` +
      `co-pay terms: ${c.coPay ?? "none stated"}, room rent: ${c.roomRentCap ?? "unknown"}, remaining cover INR ${c.coverageLeftInr ?? "unknown"}. ` +
      `Hospitals found: ${c.hospitals.length ? c.hospitals.join("; ") : "none yet"}.`;

    let answer = "I couldn't reach the language model right now.";
    if (apiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model, temperature: 0.2,
            messages: [
              { role: "system", content: `You are Astra's voice assistant. Answer the family's question in 1-2 short spoken sentences using ONLY these facts. For co-pay: apply an age-gated co-pay ONLY if the patient's age meets it (a '10% above 60' co-pay does NOT apply to an under-60 patient → co-pay is zero). Be concrete with rupee amounts.\n\nFACTS: ${facts}` },
              { role: "user", content: question },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          answer = json.choices?.[0]?.message?.content?.trim() || answer;
        }
      } catch { /* keep fallback */ }
    }

    // Speak it with ElevenLabs.
    let audioUrl: string | null = null;
    let spoken = false;
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      try {
        const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
        const ttsModel = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
          method: "POST",
          headers: { "xi-api-key": elKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text: answer, model_id: ttsModel, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (r.ok) {
          const storageId = await ctx.storage.store(await r.blob());
          audioUrl = await ctx.storage.getUrl(storageId);
          spoken = true;
        }
      } catch { /* text only */ }
    }

    return { answer, audioUrl, spoken };
  },
});
