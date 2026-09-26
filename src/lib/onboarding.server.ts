import { z } from "zod";

export const OnboardingInput = z.object({
  tipoCuenta: z.string().max(20),
  ingresos: z.number().min(0),
  gastosFijos: z.number().min(0),
  gastosVariables: z.number().min(0),
  ahorros: z.number().min(0),
  inversiones: z.number().min(0),
  deudas: z.number().min(0),
  cuotasDeuda: z.number().min(0),
  fondoEmergencia: z.string().max(40),
  meta: z.string().max(200),
  montoMeta: z.number().min(0),
  plazoMeses: z.number().int().min(1).max(600),
  preocupacion: z.string().max(300),
});
export type OnboardingAnswers = z.infer<typeof OnboardingInput>;

export interface RoadmapWeek {
  semana: number;
  objetivo: string;
  detalle: string;
}
export interface Roadmap {
  diagnostico: string;
  balance: { patrimonio: number; flujoMensual: number; tasaAhorro: number };
  semanas: RoadmapWeek[];
  generado: string;
}

export function computeBalance(a: OnboardingAnswers) {
  const patrimonio = a.ahorros + a.inversiones - a.deudas;
  const flujoMensual = a.ingresos - a.gastosFijos - a.gastosVariables - a.cuotasDeuda;
  const tasaAhorro = a.ingresos > 0 ? Math.round((flujoMensual / a.ingresos) * 100) : 0;
  return { patrimonio, flujoMensual, tasaAhorro };
}

const SYSTEM = `Eres un asesor financiero. Con la situación inicial del usuario crea una hoja de ruta de 8 semanas
con UN microobjetivo semanal, concreto, medible y alcanzable (con cifras en dólares cuando aplique), que avance
hacia su meta principal. Responde SOLO JSON válido en español:
{"diagnostico": string (máx 300 caracteres), "semanas": [{"semana": number, "objetivo": string (máx 80), "detalle": string (máx 220)}]}`;

export async function generateRoadmap(apiKey: string, a: OnboardingAnswers): Promise<Roadmap> {
  const balance = computeBalance(a);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_object" } },
      instructions: SYSTEM,
      input: `Situación inicial (JSON): ${JSON.stringify({ ...a, balance })}`,
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas solicitudes de IA. Intenta en un minuto.");
  if (res.status === 402) throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
  if (!res.ok || !res.body) throw new Error(`Error de IA (${res.status}).`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      } catch {
        /* ignore */
      }
    }
  }

  let parsed: { diagnostico?: string; semanas?: RoadmapWeek[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("La IA no devolvió una hoja de ruta válida. Intenta de nuevo.");
  }
  return {
    diagnostico: String(parsed.diagnostico ?? "").slice(0, 400),
    balance,
    semanas: (Array.isArray(parsed.semanas) ? parsed.semanas : []).slice(0, 12).map((w, i) => ({
      semana: Number(w.semana) || i + 1,
      objetivo: String(w.objetivo ?? "").slice(0, 120),
      detalle: String(w.detalle ?? "").slice(0, 300),
    })),
    generado: new Date().toISOString(),
  };
}
