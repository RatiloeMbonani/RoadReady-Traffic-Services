import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export type ExtractedDocument = {
  document_type: "fine" | "vehicle_registration" | "other";
  reference_number: string | null;
  offence: string | null;
  offence_date: string | null;
  location: string | null;
  amount: number | null;
  due_date: string | null;
  number_plate: string | null;
  make: string | null;
  model: string | null;
  confidence: number;
  summary: string;
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: { type: "string", enum: ["fine", "vehicle_registration", "other"] },
    reference_number: { type: ["string", "null"] },
    offence: { type: ["string", "null"] },
    offence_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    location: { type: ["string", "null"] },
    amount: { type: ["number", "null"], description: "Rand amount payable" },
    due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    number_plate: { type: ["string", "null"] },
    make: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    confidence: { type: "number", description: "0 to 1" },
    summary: { type: "string" },
  },
  required: [
    "document_type",
    "reference_number",
    "offence",
    "offence_date",
    "location",
    "amount",
    "due_date",
    "number_plate",
    "make",
    "model",
    "confidence",
    "summary",
  ],
} as const;

function gatewayFailure(status: number, body: string): Error {
  if (status === 429) return new Error("The document reader is busy right now. Please try again in a moment.");
  if (status === 402) return new Error("AI credits for this workspace are exhausted. Please top up to keep using the document reader.");
  if (status === 403) return new Error("AI access is blocked for this workspace. Please contact the administrator.");
  return new Error(`The document reader could not process this file (${status}). ${body.slice(0, 180)}`);
}

function readOutputText(payload: unknown): string {
  const data = payload as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string" && part.text.trim()) return part.text;
    }
  }
  return "";
}

async function callGateway(body: Record<string, unknown>): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project.");
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!response.ok) throw gatewayFailure(response.status, await response.text());
  return readOutputText(await response.json());
}

/** OCR + extraction of a photographed fine or vehicle registration document. */
export const analyseTrafficDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        imageDataUrl: z.string().min(32).max(12_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ExtractedDocument> => {
    const text = await callGateway({
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are an OCR and data-extraction engine for a South African traffic services portal. " +
                "Read the attached photograph of a traffic fine notice or a vehicle registration document and extract the fields. " +
                "Amounts are in Rand — return a plain number. Dates must be YYYY-MM-DD. " +
                "Use null for anything not clearly visible; never guess. " +
                "Set confidence between 0 and 1 for how legible the document is, and write a one-sentence plain-language summary.",
            },
            { type: "input_image", image_url: data.imageDataUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "traffic_document", strict: true, schema: extractionSchema } },
    });

    if (!text) throw new Error("The document reader returned nothing. Please try a clearer photograph.");
    try {
      return JSON.parse(text) as ExtractedDocument;
    } catch {
      throw new Error("The document reader could not read this file. Please upload a clearer photograph.");
    }
  });

/** Saves a reviewed extraction as a fine on the citizen's own record. */
export const saveExtractedFine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reference_number: z.string().min(2).max(60),
        offence: z.string().min(2).max(200),
        offence_date: z.string().min(8).max(10),
        location: z.string().min(1).max(200),
        amount: z.number().min(0).max(1_000_000),
        due_date: z.string().min(8).max(10),
        vehicle_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("fines")
      .insert({
        user_id: context.userId,
        reference_number: data.reference_number,
        offence: data.offence,
        offence_date: data.offence_date,
        location: data.location,
        amount: data.amount,
        due_date: data.due_date,
        vehicle_id: data.vehicle_id ?? null,
        payment_status: "unpaid",
      })
      .select("id")
      .single();
    if (error) throw new Error(`This fine could not be saved: ${error.message}`);
    return { id: row.id };
  });

/** Mock secure checkout: records the payment and settles the citizen's own fine. */
export const settleFine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fineId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fine, error: fineError } = await supabaseAdmin
      .from("fines")
      .select("id,user_id,amount,payment_status,reference_number")
      .eq("id", data.fineId)
      .single();
    if (fineError || !fine) throw new Error("This fine could not be found.");
    if (fine.user_id !== context.userId) throw new Error("This fine is not on your record.");
    if (fine.payment_status === "paid") return { alreadyPaid: true, receipt: fine.reference_number };

    const receipt = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const paidAt = new Date().toISOString();

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      fine_id: fine.id,
      amount: fine.amount,
      status: "paid",
      provider: "RoadReady secure checkout (prototype)",
      provider_reference: receipt,
      paid_at: paidAt,
    });
    if (paymentError) throw new Error(`The payment could not be recorded: ${paymentError.message}`);

    const { error: updateError } = await supabaseAdmin
      .from("fines")
      .update({ payment_status: "paid" })
      .eq("id", fine.id);
    if (updateError) throw new Error(`The fine could not be updated: ${updateError.message}`);

    return { alreadyPaid: false, receipt, paidAt };
  });

/** AI answers for the citizen assistant, grounded in the caller's own records. */
export const askTrafficAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(1000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(20)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const [bookings, vehicles, fines] = await Promise.all([
      supabase.from("bookings").select("booking_type,preferred_date,appointment_date,traffic_department,status").order("created_at", { ascending: false }).limit(10),
      supabase.from("vehicles").select("number_plate,make,model,manufacture_year,color,registration_status").limit(20),
      supabase.from("fines").select("reference_number,offence,amount,due_date,payment_status,location").order("created_at", { ascending: false }).limit(20),
    ]);

    const record = JSON.stringify({
      bookings: bookings.data ?? [],
      vehicles: vehicles.data ?? [],
      fines: fines.data ?? [],
    });

    const answer = await callGateway({
      input: [
        {
          role: "system",
          content:
            "You are the RoadReady Traffic Services Assistant for a South African citizen portal. " +
            "Answer only from the citizen record supplied below plus general South African traffic-services guidance. " +
            "Be brief (max 4 short sentences), plain and factual. Amounts are in Rand (R). " +
            "If the record does not contain the answer, say so and point to the right dashboard section " +
            "(Traffic services, My vehicles, Applications, Fines, Documents, Help & support). " +
            "Never ask for passwords, PINs or card details. You give guidance, not legal or licensing decisions.\n\n" +
            `CITIZEN RECORD: ${record}`,
        },
        ...data.history.map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: data.question },
      ],
    });

    return { answer: answer.trim() || "I couldn't work that out. Please try rephrasing your question." };
  });
