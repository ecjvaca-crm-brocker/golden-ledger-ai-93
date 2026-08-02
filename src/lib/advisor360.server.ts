import { z } from "zod";

export const Advisor360Input = z.object({
  perfil: z.object({
    nombre: z.string().optional(),
    pais: z.string().optional(),
    ciudad: z.string().optional(),
    edad: z.number().optional(),
    tipoCuenta: z.string().optional(),
    coberturas: z.object({
      salud: z.boolean(),
      vida: z.boolean(),
      retiro: z.boolean(),
      inversiones: z.boolean(),
    }),
  }),
  finanzas: z.object({
    ingresos: z.number(),
    gastos: z.number(),
    flujoNetoMensual: z.number(),
    tasaAhorro: z.number(),
    liquidez: z.number(),
    pasivos: z.number(),
    endeudamiento: z.number(),
    mesesCobertura: z.number(),
    patrimonio: z.number(),
    usoTarjetas: z.number(),
  }),
  metas: z.array(
    z.object({
      nombre: z.string(),
      objetivo: z.number(),
      ahorrado: z.number(),
      cuotaMensual: z.number(),
      estado: z.string(),
      mesesRestantes: z.number(),
    }),
  ),
  presupuesto: z.array(
    z.object({ categoria: z.string(), planeado: z.number(), real: z.number(), estado: z.string() }),
  ),
});

export type Advisor360InputType = z.infer<typeof Advisor360Input>;

export interface Advisor360Gap {
  titulo: string;
  detalle: string;
  severidad: "alta" | "media" | "baja";
}

export interface Advisor360Action {
  accion: string;
  detalle: string;
  categoria: "gastos" | "ahorro" | "deuda" | "seguros" | "inversion" | "negocio";
}

export interface Advisor360Result {
  diagnostico: string;
  puntaje: number;
  brechas: Advisor360Gap[];
  acciones: Advisor360Action[];
}

export const ADVISOR_SYSTEM = `Eres un Asesor Financiero 360 senior. Analizas el perfil del usuario o su
pequeño negocio junto con su flujo financiero, metas y presupuesto.
Responde SIEMPRE en español y SOLO en JSON válido con esta forma exacta:
{"diagnostico": string (máx 280 caracteres, una o dos frases tipo "Salud financiera estable, pero sin seguro de salud/vida activo"),
"puntaje": number (0-100),
"brechas": [{"titulo": string (máx 70), "detalle": string (máx 260), "severidad": "alta"|"media"|"baja"}],
"acciones": [{"accion": string (máx 80), "detalle": string (máx 260), "categoria": "gastos"|"ahorro"|"deuda"|"seguros"|"inversion"|"negocio"}]}
Entrega entre 3 y 5 brechas y entre 3 y 5 acciones concretas y accionables (ej. ajustar un gasto puntual con cifra,
contactar a un broker de seguros, renegociar tasa, reprogramar la meta X). Usa las cifras del contexto, no inventes datos.
Si faltan coberturas (salud, vida, retiro, inversiones) señálalo explícitamente como brecha.`;

export function normalizeAdvisor360(text: string): Advisor360Result {
  try {
    const p = JSON.parse(text) as Advisor360Result;
    const sev = ["alta", "media", "baja"] as const;
    const cat = ["gastos", "ahorro", "deuda", "seguros", "inversion", "negocio"] as const;
    return {
      diagnostico: String(p.diagnostico ?? "").slice(0, 400),
      puntaje: Math.max(0, Math.min(100, Math.round(Number(p.puntaje) || 0))),
      brechas: (Array.isArray(p.brechas) ? p.brechas : []).slice(0, 6).map((b) => ({
        titulo: String(b.titulo ?? "Brecha").slice(0, 90),
        detalle: String(b.detalle ?? "").slice(0, 400),
        severidad: sev.includes(b.severidad) ? b.severidad : "media",
      })),
      acciones: (Array.isArray(p.acciones) ? p.acciones : []).slice(0, 6).map((a) => ({
        accion: String(a.accion ?? "Acción").slice(0, 110),
        detalle: String(a.detalle ?? "").slice(0, 400),
        categoria: cat.includes(a.categoria) ? a.categoria : "gastos",
      })),
    };
  } catch {
    return { diagnostico: text.slice(0, 400), puntaje: 0, brechas: [], acciones: [] };
  }
}

export async function callAdvisor360(
  apiKey: string,
  data: Advisor360InputType,
): Promise<Advisor360Result> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ADVISOR_SYSTEM },
        {
          role: "user",
          content: `Contexto 360 (JSON):\n${JSON.stringify(data)}\n\nGenera el diagnóstico automático corto, las brechas financieras y las acciones concretas.`,
        },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Demasiadas solicitudes de IA. Intenta en un minuto.");
  if (res.status === 402) throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
  if (!res.ok) throw new Error(`Error de IA (${res.status}): ${await res.text()}`);

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return normalizeAdvisor360(payload.choices?.[0]?.message?.content ?? "");
}
