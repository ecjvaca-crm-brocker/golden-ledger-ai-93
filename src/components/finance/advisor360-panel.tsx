import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  CircleAlert,
  Loader2,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { diagnose360 } from "@/lib/advisor360.functions";
import type { Advisor360Result } from "@/lib/advisor360.server";
import { computeMetrics, formatMoney, type Entry, type Metrics } from "@/lib/finance";
import { computeVariances, type Budget } from "@/lib/budget";
import { monthlyNetFlow, projectGoal, type SavingsGoal } from "@/lib/savings";
import { productSummary, type BankProduct } from "@/lib/banking";

interface ProfileData {
  full_name: string | null;
  country: string | null;
  city: string | null;
  age: number | null;
  account_type: string;
  coverage_health: boolean;
  coverage_life: boolean;
  coverage_retirement: boolean;
  coverage_investments: boolean;
}

const COVERAGE_LABEL: Record<string, string> = {
  coverage_health: "Seguro de salud",
  coverage_life: "Seguro de vida",
  coverage_retirement: "Plan de retiro",
  coverage_investments: "Inversiones",
};

export function Advisor360Panel({
  entries,
  goals,
  budgets,
  products,
  metrics,
}: {
  entries: Entry[];
  goals: SavingsGoal[];
  budgets: Budget[];
  products: BankProduct[];
  metrics: Metrics;
}) {
  const run = useServerFn(diagnose360);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Advisor360Result | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !active) return;
      setSignedIn(true);
      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name, country, city, age, account_type, coverage_health, coverage_life, coverage_retirement, coverage_investments",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (active && data) setProfile(data as ProfileData);
    })();
    return () => {
      active = false;
    };
  }, []);

  const missingCoverages = profile
    ? (
        [
          "coverage_health",
          "coverage_life",
          "coverage_retirement",
          "coverage_investments",
        ] as const
      ).filter((k) => !profile[k])
    : [];

  const analyze = async () => {
    setLoading(true);
    try {
      const total = computeMetrics(entries);
      const netFlow = monthlyNetFlow(entries);
      const bank = productSummary(products);
      const res = await run({
        data: {
          perfil: {
            nombre: profile?.full_name ?? undefined,
            pais: profile?.country ?? undefined,
            ciudad: profile?.city ?? undefined,
            age: undefined,
            edad: profile?.age ?? undefined,
            tipoCuenta: profile?.account_type ?? "personal",
            coberturas: {
              salud: profile?.coverage_health ?? false,
              vida: profile?.coverage_life ?? false,
              retiro: profile?.coverage_retirement ?? false,
              inversiones: profile?.coverage_investments ?? false,
            },
          } as never,
          finanzas: {
            ingresos: total.income,
            gastos: total.expense,
            flujoNetoMensual: netFlow,
            tasaAhorro: total.savingsRate,
            liquidez: bank.liquid || total.assets,
            pasivos: total.liabilities,
            endeudamiento: total.debtRatio,
            mesesCobertura: total.runwayMonths,
            patrimonio: bank.netWorth,
            usoTarjetas: bank.cardUtilization,
          },
          metas: goals.map((g) => {
            const p = projectGoal(g, netFlow);
            return {
              nombre: g.name,
              objetivo: g.target,
              ahorrado: g.saved,
              cuotaMensual: Math.round(p.requiredMonthly),
              estado: p.status,
              mesesRestantes: p.monthsLeft,
            };
          }),
          presupuesto: computeVariances(budgets, entries).map((v) => ({
            categoria: `${v.accountName} (${v.budget.scope})`,
            planeado: v.budget.amount,
            real: v.actual,
            estado: v.status,
          })),
        },
      });
      setResult(res);
      toast.success("Diagnóstico 360 generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos generar el diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Bot className="size-5 text-gold" /> Agente IA — Asesor Financiero 360
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cruza tu perfil y coberturas con el flujo de caja, presupuesto y metas para entregar
              un diagnóstico corto, las brechas detectadas y acciones concretas.
            </p>
          </div>
          <Button onClick={analyze} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" /> Analizando…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 size-4" /> Generar diagnóstico
              </>
            )}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Flujo neto mensual" value={formatMoney(monthlyNetFlow(entries))} />
          <MiniStat
            label="Tasa de ahorro"
            value={`${(metrics.savingsRate * 100).toFixed(1)}%`}
          />
          <MiniStat
            label="Coberturas al día"
            value={profile ? `${4 - missingCoverages.length} de 4` : "Sin perfil"}
          />
        </div>

        {!signedIn ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 p-3 text-xs">
            <ShieldQuestion className="size-4 text-gold" />
            Inicia sesión y completa{" "}
            <Link to="/perfil" className="font-semibold underline">
              tu perfil
            </Link>{" "}
            para incluir coberturas y datos del titular en el diagnóstico.
          </p>
        ) : missingCoverages.length ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
            Coberturas sin marcar:{" "}
            <strong>{missingCoverages.map((k) => COVERAGE_LABEL[k]).join(", ")}</strong>. El agente
            las considerará brechas de protección.
          </p>
        ) : null}
      </section>

      {result ? (
        <>
          <section className="surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Diagnóstico automático
                </p>
                <p className="mt-2 max-w-2xl text-sm">{result.diagnostico}</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-semibold text-gold">{result.puntaje}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Puntaje 360
                </p>
              </div>
            </div>
          </section>

          {result.brechas.length ? (
            <section className="surface-card p-6">
              <h3 className="text-sm font-semibold">Brechas financieras detectadas</h3>
              <ul className="mt-4 space-y-3">
                {result.brechas.map((b, i) => (
                  <li key={i} className="rounded-md border bg-secondary/40 p-4">
                    <div className="flex items-center gap-2">
                      {b.severidad === "alta" ? (
                        <CircleAlert className="size-4 text-destructive" />
                      ) : b.severidad === "media" ? (
                        <AlertTriangle className="size-4 text-gold" />
                      ) : (
                        <BadgeCheck className="size-4 text-success" />
                      )}
                      <p className="text-sm font-semibold">{b.titulo}</p>
                      <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
                        {b.severidad}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{b.detalle}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.acciones.length ? (
            <section className="surface-card p-6">
              <h3 className="text-sm font-semibold">Acciones recomendadas</h3>
              <ol className="mt-4 space-y-3">
                {result.acciones.map((a, i) => (
                  <li key={i} className="flex gap-3 rounded-md border p-4">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{a.accion}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{a.detalle}</p>
                      <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {a.categoria}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold">{value}</p>
    </div>
  );
}
