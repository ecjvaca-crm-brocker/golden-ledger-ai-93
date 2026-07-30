import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  Briefcase,
  FileDown,
  Landmark,
  PiggyBank,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/finance/kpi-card";
import { EntryForm } from "@/components/finance/entry-form";
import { EntriesTable } from "@/components/finance/entries-table";
import { AccountsTable } from "@/components/finance/accounts-table";
import { HealthPanel, RecommendationList } from "@/components/finance/health-panel";
import { ExportPanel } from "@/components/finance/export-panel";
import {
  CashflowChart,
  ExpenseByCategoryChart,
  ScopeComparisonChart,
} from "@/components/finance/charts";
import { useLedger } from "@/lib/use-ledger";
import { buildRecommendations, computeMetrics, formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tracker Financiero Personal y de Negocio | Plan de cuentas NIIF" },
      {
        name: "description",
        content:
          "Controla ingresos, gastos por categoría contable NIIF, indicadores de salud financiera y recomendaciones de presupuesto personal y empresarial.",
      },
      { property: "og:title", content: "Tracker Financiero Personal y de Negocio" },
      {
        property: "og:description",
        content:
          "Dashboard consolidado con plan de cuentas NIIF, indicadores económicos y recomendaciones de presupuesto.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { entries, addEntry, removeEntry } = useLedger();

  const personalEntries = useMemo(
    () => entries.filter((e) => e.scope === "personal"),
    [entries],
  );
  const businessEntries = useMemo(() => entries.filter((e) => e.scope === "negocio"), [entries]);

  const total = useMemo(() => computeMetrics(entries), [entries]);
  const personal = useMemo(() => computeMetrics(personalEntries), [personalEntries]);
  const business = useMemo(() => computeMetrics(businessEntries), [businessEntries]);
  const recs = useMemo(
    () => buildRecommendations(entries, personal, business),
    [entries, personal, business],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-panel">
        <div className="mx-auto max-w-7xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Consultoría financiera
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
            Tracker de finanzas personales y de negocio
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-primary-foreground/75">
            Registra ingresos y gastos con plan de cuentas NIIF, consolida todas tus cuentas y
            evalúa tu situación financiera con indicadores y recomendaciones.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <HeroStat label="Patrimonio consolidado" value={formatMoney(total.equity)} />
            <HeroStat label="Resultado del período" value={formatMoney(total.net)} />
            <HeroStat
              label="Tasa de ahorro global"
              value={`${(total.savingsRate * 100).toFixed(1)}%`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Ingresos totales"
            value={formatMoney(total.income)}
            icon={TrendingUp}
            tone="positive"
            hint="Personal + negocio"
          />
          <KpiCard
            label="Gastos totales"
            value={formatMoney(total.expense)}
            icon={TrendingDown}
            tone="negative"
            hint={`${(total.expenseRatio * 100).toFixed(0)}% de los ingresos`}
          />
          <KpiCard
            label="Liquidez disponible"
            value={formatMoney(total.assets)}
            icon={Wallet}
            tone="gold"
            hint={`Cobertura: ${total.runwayMonths.toFixed(1)} meses`}
          />
          <KpiCard
            label="Pasivos"
            value={formatMoney(total.liabilities)}
            icon={Scale}
            hint={`Endeudamiento ${(total.debtRatio * 100).toFixed(0)}%`}
          />
        </section>

        <Tabs defaultValue="dashboard" className="mt-8">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">
              <Activity className="mr-1.5 size-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="movimientos">
              <PiggyBank className="mr-1.5 size-4" /> Movimientos
            </TabsTrigger>
            <TabsTrigger value="cuentas">
              <Landmark className="mr-1.5 size-4" /> Plan de cuentas
            </TabsTrigger>
            <TabsTrigger value="salud">
              <Briefcase className="mr-1.5 size-4" /> Salud financiera
            </TabsTrigger>
            <TabsTrigger value="reportes">
              <FileDown className="mr-1.5 size-4" /> Reportes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <CashflowChart entries={entries} />
              <ExpenseByCategoryChart entries={entries} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ScopeComparisonChart
                personalNet={personal.net}
                businessNet={business.net}
                personalIncome={personal.income}
                businessIncome={business.income}
              />
              <RecommendationList items={recs.slice(0, 3)} />
            </div>
          </TabsContent>

          <TabsContent value="movimientos" className="mt-6 space-y-6">
            <EntryForm onAdd={addEntry} />
            <EntriesTable entries={entries} onRemove={removeEntry} />
          </TabsContent>

          <TabsContent value="cuentas" className="mt-6">
            <AccountsTable entries={entries} />
          </TabsContent>

          <TabsContent value="salud" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <HealthPanel metrics={personal} title="Indicadores — Finanzas personales" />
              <HealthPanel metrics={business} title="Indicadores — Negocio" />
            </div>
            <RecommendationList items={recs} />
          </TabsContent>

          <TabsContent value="reportes" className="mt-6">
            <ExportPanel entries={entries} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Los indicadores son orientativos y no sustituyen asesoría contable o tributaria formal.
      </footer>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold/30 bg-primary-foreground/5 p-4 backdrop-blur">
      <p className="text-[11px] uppercase tracking-wider text-primary-foreground/60">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold text-gold">{value}</p>
    </div>
  );
}
