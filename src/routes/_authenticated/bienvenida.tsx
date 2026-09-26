import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Compass, Loader2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createRoadmap, type Roadmap } from "@/lib/onboarding.functions";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/bienvenida")({
  head: () => ({
    meta: [
      { title: "Bienvenida y hoja de ruta | ESCALA Cash Flow" },
      {
        name: "description",
        content:
          "Responde el cuestionario de situación inicial y recibe tu balance y una hoja de ruta con microobjetivos semanales.",
      },
      { property: "og:title", content: "Bienvenida y hoja de ruta | ESCALA Cash Flow" },
      {
        property: "og:description",
        content: "Tu balance inicial y microobjetivos semanales para mejorar tus finanzas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});

type Saved = Roadmap & { hechas?: number[] };

const NUM_FIELDS = [
  ["ingresos", "Ingresos mensuales (US$)"],
  ["gastosFijos", "Gastos fijos mensuales (arriendo, servicios, colegios)"],
  ["gastosVariables", "Gastos variables mensuales (comida, ocio, compras)"],
  ["cuotasDeuda", "Pagos mensuales de deudas y tarjetas"],
  ["ahorros", "Ahorros disponibles hoy"],
  ["inversiones", "Inversiones (pólizas, fondos, acciones)"],
  ["deudas", "Total de deudas pendientes"],
] as const;

const EMERGENCY = ["No tengo", "Menos de 1 mes", "1 a 3 meses", "3 a 6 meses", "Más de 6 meses"];

function WelcomePage() {
  const create = useServerFn(createRoadmap);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [f, setF] = useState<Record<string, string>>({
    tipoCuenta: "personal",
    fondoEmergencia: "No tengo",
    meta: "",
    montoMeta: "",
    plazoMeses: "12",
    preocupacion: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("onboarding" as never).select("*").maybeSingle();
      const row = data as { answers?: Record<string, unknown>; roadmap?: Saved } | null;
      if (row?.answers) {
        setF(Object.fromEntries(Object.entries(row.answers).map(([k, v]) => [k, String(v)])));
      }
      if (row?.roadmap) setSaved(row.roadmap);
      setLoading(false);
    })();
  }, []);

  const n = (k: string) => Number(f[k] || 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!n("ingresos") && !n("gastosFijos")) {
      toast.error("Ingresa al menos tus ingresos y gastos mensuales.");
      return;
    }
    if (!f.meta?.trim()) {
      toast.error("Cuéntanos tu meta principal.");
      return;
    }
    setBusy(true);
    try {
      const r = await create({
        data: {
          tipoCuenta: f.tipoCuenta,
          ingresos: n("ingresos"),
          gastosFijos: n("gastosFijos"),
          gastosVariables: n("gastosVariables"),
          ahorros: n("ahorros"),
          inversiones: n("inversiones"),
          deudas: n("deudas"),
          cuotasDeuda: n("cuotasDeuda"),
          fondoEmergencia: f.fondoEmergencia,
          meta: f.meta.trim(),
          montoMeta: n("montoMeta"),
          plazoMeses: Math.max(1, Math.round(n("plazoMeses") || 12)),
          preocupacion: (f.preocupacion ?? "").trim(),
        },
      });
      setSaved({ ...r, hechas: [] });
      toast.success("Tu hoja de ruta está lista");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos generar tu hoja de ruta.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (semana: number) => {
    if (!saved) return;
    const hechas = saved.hechas ?? [];
    const next = hechas.includes(semana) ? hechas.filter((s) => s !== semana) : [...hechas, semana];
    const updated = { ...saved, hechas: next };
    setSaved(updated);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("onboarding" as never)
      .update({ roadmap: updated } as never)
      .eq("user_id" as never, u.user?.id as never);
    if (error) toast.error("No pudimos guardar tu avance.");
  };

  const done = saved?.hechas?.length ?? 0;
  const total = saved?.semanas.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-panel">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Bienvenida</p>
            <h1 className="mt-2 text-2xl font-semibold">Tu situación inicial y hoja de ruta</h1>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-4" /> Tablero
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        {loading ? (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            {saved && (
              <section className="surface-card space-y-5 p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Compass className="size-4 text-gold" /> Balance inicial
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Patrimonio neto" value={formatMoney(saved.balance.patrimonio)} />
                  <Stat label="Flujo libre mensual" value={formatMoney(saved.balance.flujoMensual)} />
                  <Stat label="Tasa de ahorro" value={`${saved.balance.tasaAhorro}%`} />
                </div>
                {saved.diagnostico && (
                  <p className="text-sm text-muted-foreground">{saved.diagnostico}</p>
                )}
                <div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Microobjetivos semanales</span>
                    <span className="text-xs text-muted-foreground">
                      {done} de {total} cumplidos
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-gold transition-all"
                      style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                    />
                  </div>
                  <ul className="mt-4 space-y-2">
                    {saved.semanas.map((w) => {
                      const ok = saved.hechas?.includes(w.semana);
                      return (
                        <li key={w.semana}>
                          <label className="flex cursor-pointer gap-3 rounded-md border bg-secondary/40 p-3">
                            <Checkbox checked={ok} onCheckedChange={() => toggle(w.semana)} />
                            <div>
                              <p className={`text-sm font-medium ${ok ? "line-through opacity-60" : ""}`}>
                                Semana {w.semana}: {w.objetivo}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{w.detalle}</p>
                            </div>
                            {ok && <CheckCircle2 className="ml-auto size-4 shrink-0 text-gold" />}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            )}

            <form onSubmit={submit} className="surface-card space-y-5 p-6">
              <div>
                <h2 className="text-sm font-semibold">
                  {saved ? "Actualizar mi situación" : "Cuestionario de situación inicial"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valores aproximados en dólares. Con esto calculamos tu balance y armamos tu plan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["personal", "Personal"],
                    ["negocio", "Pequeño negocio"],
                  ] as const
                ).map(([v, l]) => (
                  <Button
                    key={v}
                    type="button"
                    variant={f.tipoCuenta === v ? "default" : "outline"}
                    onClick={() => setF({ ...f, tipoCuenta: v })}
                  >
                    {l}
                  </Button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {NUM_FIELDS.map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-xs">{label}</Label>
                    <Input
                      inputMode="decimal"
                      value={f[k] ?? ""}
                      onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^0-9.]/g, "") })}
                      placeholder="0"
                      className="mt-1.5"
                    />
                  </div>
                ))}
                <div>
                  <Label className="text-xs">¿Cuántos meses cubre tu fondo de emergencia?</Label>
                  <select
                    value={f.fondoEmergencia}
                    onChange={(e) => setF({ ...f, fondoEmergencia: e.target.value })}
                    className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {EMERGENCY.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <Label className="text-xs">Tu meta principal</Label>
                  <Input
                    value={f.meta ?? ""}
                    maxLength={200}
                    onChange={(e) => setF({ ...f, meta: e.target.value })}
                    placeholder="Ej. salir de deudas, comprar un auto, fondo de emergencia"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Monto de la meta</Label>
                  <Input
                    inputMode="decimal"
                    value={f.montoMeta ?? ""}
                    onChange={(e) => setF({ ...f, montoMeta: e.target.value.replace(/[^0-9.]/g, "") })}
                    placeholder="0"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Plazo (meses)</Label>
                  <Input
                    inputMode="numeric"
                    value={f.plazoMeses ?? ""}
                    onChange={(e) => setF({ ...f, plazoMeses: e.target.value.replace(/[^0-9]/g, "") })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">¿Qué es lo que más te preocupa de tus finanzas?</Label>
                <Textarea
                  value={f.preocupacion ?? ""}
                  maxLength={300}
                  onChange={(e) => setF({ ...f, preocupacion: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" /> Generando tu hoja de ruta…
                  </>
                ) : saved ? (
                  <>
                    <RefreshCw className="mr-1.5 size-4" /> Regenerar hoja de ruta
                  </>
                ) : (
                  "Generar mi hoja de ruta"
                )}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
