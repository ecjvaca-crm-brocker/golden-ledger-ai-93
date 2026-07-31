import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  productos: z.array(
    z.object({
      entidad: z.string(),
      tipo: z.string(),
      alias: z.string(),
      saldo: z.number(),
      cupo: z.number().optional(),
      tasa: z.number().optional(),
    }),
  ),
  movimientos: z.array(
    z.object({
      fecha: z.string(),
      descripcion: z.string(),
      monto: z.number(),
      cuenta: z.string(),
      tipo: z.string(),
    }),
  ),
  resumen: z.object({
    ingresos: z.number(),
    gastos: z.number(),
    tasaAhorro: z.number(),
    liquidez: z.number(),
    deuda: z.number(),
    usoTarjetas: z.number(),
  }),
});

export interface AiInsight {
  titulo: string;
  detalle: string;
  tipo: "alerta" | "gasto_innecesario" | "aporta_valor" | "oportunidad";
}

export interface AiAnalysis {
  resumen: string;
  puntaje: number;
  hallazgos: AiInsight[];
}

const SYSTEM = `Eres un consultor financiero personal senior (NIIF, presupuesto y finanzas del hogar).
Analizas productos bancarios, consumos, compras e ingresos de una persona.
Responde SIEMPRE en español, en JSON válido con esta forma exacta:
{"resumen": string (máx 400 caracteres), "puntaje": number (0-100 de salud de consumo),
"hallazgos": [{"titulo": string (máx 70 caracteres), "detalle": string (máx 320 caracteres),
"tipo": "alerta" | "gasto_innecesario" | "aporta_valor" | "oportunidad"}]}
Entrega entre 4 y 7 hallazgos. Sé concreto con cifras del contexto, señala gastos innecesarios o
recurrentes que no aportan valor, reconoce los que sí aportan a su estilo de vida, y advierte sobre
uso de tarjetas, tasas altas y falta de liquidez. No inventes datos que no estén en el contexto.`;

export const analyzeFinances = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AiAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la configuración de IA (LOVABLE_API_KEY).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Contexto financiero personal (JSON):\n${JSON.stringify(data)}\n\nAnaliza el comportamiento de consumo, compras e ingresos y responde en el JSON solicitado.`,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Demasiadas solicitudes de IA. Intenta en un minuto.");
    if (res.status === 402)
      throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
    if (!res.ok) throw new Error(`Error de IA (${res.status}): ${await res.text()}`);

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(text) as AiAnalysis;
      return {
        resumen: String(parsed.resumen ?? "").slice(0, 600),
        puntaje: Math.max(0, Math.min(100, Math.round(Number(parsed.puntaje) || 0))),
        hallazgos: (Array.isArray(parsed.hallazgos) ? parsed.hallazgos : []).slice(0, 8).map((h) => ({
          titulo: String(h.titulo ?? "Hallazgo").slice(0, 90),
          detalle: String(h.detalle ?? "").slice(0, 500),
          tipo: (["alerta", "gasto_innecesario", "aporta_valor", "oportunidad"] as const).includes(
            h.tipo,
          )
            ? h.tipo
            : "oportunidad",
        })),
      };
    } catch {
      return { resumen: text.slice(0, 600), puntaje: 0, hallazgos: [] };
    }
  });
