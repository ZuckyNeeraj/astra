import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// The Health Vault agent. Reads the REAL files a user uploads to their vault
// (insurance policies, MRI/lab reports, prescriptions, IDs) and turns each one
// into structured data the rest of Astra can reason over:
//   • docKind          — what the document actually is
//   • extractedFields  — the numbers that matter (sum insured, policy no., diagnosis…)
//   • extractedText    — the plain text the model read out of the page
//   • extractedSummary — one human line for the Vault UI
//
// Uploads are images or PDFs. Images are sent to OpenAI as an image URL (the
// short-lived Convex signed URL); PDFs are uploaded to OpenAI's Files API and
// referenced by id. Everything runs through the Responses API in JSON mode.
//
// Requires OPENAI_API_KEY (Convex env var, already set for the analysis agent).
// OPENAI_MODEL is optional and defaults to a vision-capable model. Without the
// key, parsing is a no-op and the file simply stays unparsed.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gpt-4o-mini";

type VaultItemForParse = {
  userId: Id<"users">;
  label: string;
  category: string;
  storageId: Id<"_storage"> | null;
} | null;

type ParseResult = {
  docKind: string;
  summary: string;
  fields: Record<string, string>;
  text: string;
};

const SYSTEM_PROMPT = `You are Astra's Health Vault agent for an Indian healthcare-journey assistant.
You are given ONE document a family uploaded (an insurance policy, a medical/lab/imaging report, a doctor's prescription, or a government ID). Read it and return STRICT JSON (no prose, no markdown):
{
  "docKind": "insurance_policy" | "medical_report" | "prescription" | "id" | "other",
  "summary": string,            // one plain-language line describing this document for the family
  "fields": {                   // the key facts, as flat string values — include only what's actually present
    // insurance_policy: "insurer", "policyNumber", "sumInsuredInr", "policyHolder", "validTill", "roomRentCap", "coPay"
    // medical_report:   "patientName", "patientAge", "reportType", "diagnosis", "keyFindings", "reportDate", "referringDoctor"
    // prescription:     "patientName", "prescribedBy", "medications", "advice", "date"
    // id:               "idType", "name", "idNumber"   // idNumber MAY be partially masked, that's fine
  },
  "text": string                // the full readable text you extracted from the document (verbatim, trimmed)
}
Rules:
- Return values as strings; put money as plain digits in INR where possible (e.g. "500000"), no symbols or commas.
- Only include fields you can actually read. Never invent a policy number, sum insured, name, or diagnosis.
- If the document is unreadable or not one of the above, use docKind "other" with a best-effort summary and whatever text you can read.`;

// Load the vault item the parser needs. (Content type + bytes come from
// ctx.storage in the action itself, which queries can't reach.)
export const getVaultItemForParse = internalQuery({
  args: { itemId: v.id("vaultItems") },
  handler: async (ctx, { itemId }): Promise<VaultItemForParse> => {
    const item = await ctx.db.get(itemId);
    if (!item) return null;
    return {
      userId: item.userId,
      label: item.label,
      category: item.category,
      storageId: item.storageId ?? null,
    };
  },
});

// Write the parse result back onto the vault item.
export const applyVaultParse = internalMutation({
  args: {
    itemId: v.id("vaultItems"),
    docKind: v.string(),
    extractedSummary: v.string(),
    extractedFields: v.record(v.string(), v.string()),
    extractedText: v.string(),
    parseStatus: v.union(v.literal("parsed"), v.literal("failed")),
  },
  handler: async (ctx, a) => {
    const item = await ctx.db.get(a.itemId);
    if (!item) return null;
    await ctx.db.patch(a.itemId, {
      docKind: a.docKind,
      extractedSummary: a.extractedSummary,
      extractedFields: a.extractedFields,
      extractedText: a.extractedText.slice(0, 8000), // keep the row well under the 1MB doc limit
      parseStatus: a.parseStatus,
      parsedAt: Date.now(),
    });
    return a.itemId;
  },
});

// Mark an item as "being parsed" so the UI can show a spinner immediately.
export const markParsing = internalMutation({
  args: { itemId: v.id("vaultItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return null;
    await ctx.db.patch(itemId, { parseStatus: "pending" });
    return itemId;
  },
});

// Upload a PDF blob to OpenAI's Files API and return its file id.
async function uploadToOpenAI(apiKey: string, blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", blob, filename);
  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`openai_files_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.id as string;
}

// Ask the model to classify + extract, given either an image URL or a PDF file id.
async function runVision(
  apiKey: string,
  model: string,
  label: string,
  fileContent: Record<string, unknown>,
): Promise<ParseResult> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            // The word "json" MUST appear in an input message for the Responses API
            // to accept text.format = json_object (instructions alone don't count).
            { type: "input_text", text: `The uploaded document is labelled "${label}". Read it and return the structured JSON described in your instructions.` },
            fileContent,
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();

  // Responses API: prefer the aggregated output_text, else dig it out.
  let content: string = typeof json.output_text === "string" ? json.output_text : "";
  if (!content) {
    for (const item of json.output ?? []) {
      for (const c of item.content ?? []) {
        if (typeof c.text === "string") content += c.text;
      }
    }
  }
  const parsed = JSON.parse(content || "{}");

  // Normalise: coerce every field value to a string, drop empties.
  const rawFields = parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {};
  const fields: Record<string, string> = {};
  for (const [k, val] of Object.entries(rawFields)) {
    if (val === null || val === undefined || val === "") continue;
    fields[String(k)] = typeof val === "string" ? val : JSON.stringify(val);
  }

  return {
    docKind: typeof parsed.docKind === "string" ? parsed.docKind : "other",
    summary: String(parsed.summary ?? ""),
    fields,
    text: String(parsed.text ?? ""),
  };
}

// The agent: parse one vault item and write the result back. Scheduled from
// vault.save right after a file is stored, and callable directly.
export const parseVaultItem = internalAction({
  args: { itemId: v.id("vaultItems") },
  handler: async (ctx, { itemId }): Promise<{ status: string; docKind?: string }> => {
    const item: VaultItemForParse = await ctx.runQuery(internal.vaultAgent.getVaultItemForParse, { itemId });
    if (!item) return { status: "item_not_found" };
    if (!item.storageId) return { status: "no_file" };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { status: "no_openai_key" };
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

    await ctx.runMutation(internal.vaultAgent.markParsing, { itemId });

    let result: ParseResult;
    try {
      const blob = await ctx.storage.get(item.storageId);
      if (!blob) return { status: "file_missing" };
      const contentType = blob.type || "application/octet-stream";

      let fileContent: Record<string, unknown>;
      if (contentType.startsWith("image/")) {
        const url = await ctx.storage.getUrl(item.storageId);
        if (!url) return { status: "file_missing" };
        fileContent = { type: "input_image", image_url: url };
      } else {
        // PDFs (and anything else) go through the Files API.
        const filename = `${item.label.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
        const fileId = await uploadToOpenAI(apiKey, blob, filename);
        fileContent = { type: "input_file", file_id: fileId };
      }

      result = await runVision(apiKey, model, item.label, fileContent);
    } catch (err) {
      console.error("parseVaultItem failed:", err instanceof Error ? err.message : err);
      await ctx.runMutation(internal.vaultAgent.applyVaultParse, {
        itemId,
        docKind: "other",
        extractedSummary: "Could not read this document automatically.",
        extractedFields: {},
        extractedText: "",
        parseStatus: "failed",
      });
      return { status: "parse_failed" };
    }

    await ctx.runMutation(internal.vaultAgent.applyVaultParse, {
      itemId,
      docKind: result.docKind,
      extractedSummary: result.summary,
      extractedFields: result.fields,
      extractedText: result.text,
      parseStatus: "parsed",
    });
    return { status: "ok", docKind: result.docKind };
  },
});

// Manual (re)parse of the signed-in user's vault — parses anything not yet
// parsed, and can be pointed at a single item. Handy for the demo / re-runs.
export const parseMyVault = action({
  args: { itemId: v.optional(v.id("vaultItems")), force: v.optional(v.boolean()) },
  handler: async (ctx, { itemId, force }): Promise<{ status: string; parsed: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "unauthenticated", parsed: 0 };
    const ids: Array<Id<"vaultItems">> = await ctx.runQuery(internal.vaultAgent.myParseTargets, {
      itemId: itemId ?? undefined,
      force: force ?? false,
    });
    for (const id of ids) {
      await ctx.runAction(internal.vaultAgent.parseVaultItem, { itemId: id });
    }
    return { status: "ok", parsed: ids.length };
  },
});

// The signed-in user's vault items that still need parsing (or all, if forced).
export const myParseTargets = internalQuery({
  args: { itemId: v.optional(v.id("vaultItems")), force: v.boolean() },
  handler: async (ctx, { itemId, force }): Promise<Array<Id<"vaultItems">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return items
      .filter((i) => i.userId === userId && i.storageId)
      .filter((i) => (itemId ? i._id === itemId : true))
      .filter((i) => force || i.parseStatus !== "parsed")
      .map((i) => i._id);
  },
});
