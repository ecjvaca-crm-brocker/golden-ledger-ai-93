import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHART_OF_ACCOUNTS } from "./finance";

export interface ReceiptResult {
  date: string;
  description: string;
  amount: number;
  accountCode: string;
  scope: "personal" | "negocio";
}

const Input = z.object({
  image: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,/),
});

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<ReceiptResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la configuración de IA.");
    const accounts = CHART_OF_ACCOUNTS.filter((a) => a.type === "ingreso" || a.type === "gasto")
      .map((a) => `${a.code}=${a.name} (${a.type})`)
      .join("; ");
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Lees comprobantes (facturas, notas de venta, transferencias, recibos). Devuelve SOLO JSON:
{"date":"YYYY-MM-DD","description":string (comercio + concepto, máx 100),"amount":number (total pagado),"accountCode":string,"scope":"personal"|"negocio"}.
accountCode debe ser uno de: ${accounts}. Si es un cobro/venta recibida usa un código de ingreso. Si no hay fecha usa ${today}.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrae el movimiento de este comprobante." },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Demasiadas solicitudes. Intenta en un minuto.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA.");
    if (!res.ok) throw new Error(`No pudimos leer el comprobante (${res.status}).`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let p: Partial<ReceiptResult> = {};
    try {
      p = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("No pudimos interpretar el comprobante.");
    }
    const valid = CHART_OF_ACCOUNTS.some((a) => a.code === p.accountCode);
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) ? String(p.date) : today,
      description: String(p.description ?? "Comprobante").slice(0, 120),
      amount: Math.abs(Number(p.amount) || 0),
      accountCode: valid ? String(p.accountCode) : "5145",
      scope: p.scope === "negocio" ? "negocio" : "personal",
    };
  });
