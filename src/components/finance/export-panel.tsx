import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  accountByCode,
  ACCOUNT_TYPE_LABEL,
  CHART_OF_ACCOUNTS,
  formatMoney,
  type AccountType,
  type Entry,
} from "@/lib/finance";
import {
  exportCsv,
  exportPdf,
  filterEntries,
  goalRows,
  periodBudgets,
  type ReportFilters,
} from "@/lib/export-report";
import { computeVariances, type Budget } from "@/lib/budget";
import type { SavingsGoal } from "@/lib/savings";

const TYPES: AccountType[] = ["activo", "pasivo", "patrimonio", "ingreso", "gasto"];

export function ExportPanel({
  entries,
  budgets = [],
  goals = [],
}: {
  entries: Entry[];
  budgets?: Budget[];
  goals?: SavingsGoal[];
}) {
  const dates = entries.map((e) => e.date).sort();
  const [from, setFrom] = useState(dates[0] ?? "");
  const [to, setTo] = useState(dates[dates.length - 1] ?? "");
  const [scope, setScope] = useState<ReportFilters["scope"]>("todos");
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const filters: ReportFilters = { from, to, scope, accountCodes: codes };
  const preview = useMemo(() => filterEntries(entries, filters), [entries, from, to, scope, codes]);
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of preview) {
      const type = accountByCode(e.accountCode)?.type;
      if (type === "ingreso") income += e.amount;
      if (type === "gasto") expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [preview]);
  const variances = useMemo(
    () => computeVariances(periodBudgets(budgets, filters), preview),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgets, preview, from, to, scope],
  );
  const goalsInScope = useMemo(
    () => goalRows({ goals, budgets }, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, budgets, scope],
  );
  const plannedTotal = variances.reduce((s, v) => s + v.budget.amount, 0);
  const savedTotal = goalsInScope.reduce((s, g) => s + g.saved, 0);
  const targetTotal = goalsInScope.reduce((s, g) => s + g.target, 0);
  const extras = { goals, budgets };

  const toggle = (code: string) =>
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const toggleType = (type: AccountType) => {
    const group = CHART_OF_ACCOUNTS.filter((a) => a.type === type).map((a) => a.code);
    const all = group.every((c) => codes.includes(c));
    setCodes((prev) =>
      all ? prev.filter((c) => !group.includes(c)) : [...new Set([...prev, ...group])],
    );
  };

  const handle = async (kind: "csv" | "pdf") => {
    if (!preview.length) {
      toast.error("No hay movimientos en el rango seleccionado");
      return;
    }
    try {
      setLoading(true);
      const n =
        kind === "csv"
          ? exportCsv(entries, filters, extras)
          : await exportPdf(entries, filters, extras);
      toast.success(`Reporte ${kind.toUpperCase()} generado con ${n} movimientos`);
    } catch {
      toast.error("No se pudo generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="surface-card space-y-5 p-5">
        <div>
          <h3 className="text-sm font-semibold">Rango y ámbito</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Define el período contable y el alcance del reporte.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Ámbito</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as ReportFilters["scope"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Consolidado (personal + negocio)</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="negocio">Negocio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Movimientos incluidos</p>
            <p className="font-display text-2xl font-semibold">{preview.length}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryStat label="Ingresos" value={formatMoney(totals.income)} tone="text-success" />
            <SummaryStat
              label="Gastos"
              value={formatMoney(totals.expense)}
              tone="text-destructive"
            />
            <SummaryStat label="Resultado neto" value={formatMoney(totals.net)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
            <SummaryStat
              label="Presupuesto planeado"
              value={formatMoney(plannedTotal)}
            />
            <SummaryStat
              label={`Metas (${goalsInScope.length})`}
              value={`${formatMoney(savedTotal)} de ${formatMoney(targetTotal)}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handle("pdf")} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <FileDown className="mr-1.5 size-4" />
            )}
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={() => handle("csv")} disabled={loading}>
            <FileSpreadsheet className="mr-1.5 size-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Cuentas NIIF</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {codes.length
                ? `${codes.length} cuentas seleccionadas`
                : "Todas las cuentas incluidas"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCodes([])}
            disabled={!codes.length}
          >
            Limpiar selección
          </Button>
        </div>

        <div className="mt-4">
          <Label className="text-xs">Vista de cuentas</Label>
          <Select
            value={codes.length === 1 ? (codes[0] as string) : "todas"}
            onValueChange={(v) => setCodes(v === "todas" ? [] : [v])}
          >
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="todas">Todas las cuentas (consolidado)</SelectItem>
              {CHART_OF_ACCOUNTS.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            O marca varias cuentas abajo para un reporte combinado.
          </p>
        </div>

        <ScrollArea className="mt-4 h-[320px] pr-3">
          <div className="space-y-5">
            {TYPES.map((type) => {
              const accounts = CHART_OF_ACCOUNTS.filter((a) => a.type === type);
              return (
                <div key={type}>
                  <button
                    type="button"
                    onClick={() => toggleType(type)}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {ACCOUNT_TYPE_LABEL[type]}
                  </button>
                  <div className="mt-2 space-y-2">
                    {accounts.map((a) => (
                      <label
                        key={a.code}
                        className="flex cursor-pointer items-center gap-2.5 text-sm"
                      >
                        <Checkbox
                          checked={codes.includes(a.code)}
                          onCheckedChange={() => toggle(a.code)}
                        />
                        <span className="tabular-nums text-muted-foreground">{a.code}</span>
                        <span>{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
