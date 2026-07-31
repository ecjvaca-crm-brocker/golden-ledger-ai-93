import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CHART_OF_ACCOUNTS, formatMoney, type Entry, type Scope } from "@/lib/finance";
import {
  budgetTotals,
  computeVariances,
  currentMonth,
  type Budget,
  type BudgetVariance,
} from "@/lib/budget";

const EXPENSE_ACCOUNTS = CHART_OF_ACCOUNTS.filter((a) => a.type === "gasto");

export function BudgetPanel({
  budgets,
  entries,
  onAdd,
  onRemove,
}: {
  budgets: Budget[];
  entries: Entry[];
  onAdd: (b: Omit<Budget, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth(), ...budgets.map((b) => b.month)]);
    entries.forEach((e) => set.add(e.date.slice(0, 7)));
    return [...set].sort().reverse();
  }, [budgets, entries]);

  const [month, setMonth] = useState(() => months[0] ?? currentMonth());
  const [scope, setScope] = useState<Scope>("personal");
  const [accountCode, setAccountCode] = useState("5120");
  const [amount, setAmount] = useState("");

  const rows = useMemo(
    () => computeVariances(budgets.filter((b) => b.month === month), entries),
    [budgets, entries, month],
  );
  const personal = rows.filter((r) => r.budget.scope === "personal");
  const business = rows.filter((r) => r.budget.scope === "negocio");
  const alerts = rows.filter((r) => r.status !== "ok");

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Ingresa un monto presupuestado mayor a cero.");
      return;
    }
    onAdd({ scope, accountCode, month, amount: value });
    setAmount("");
    toast.success("Presupuesto guardado");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="surface-card grid gap-4 p-5 md:grid-cols-5">
        <div>
          <Label className="text-xs">Mes</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Ámbito</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="negocio">Negocio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Categoría (cuenta NIIF)</Label>
          <Select value={accountCode} onValueChange={setAccountCode}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {EXPENSE_ACCOUNTS.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Monto planeado</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-5">
          <Button type="submit" className="w-full md:w-auto">
            Guardar presupuesto
          </Button>
        </div>
      </form>

      {alerts.length > 0 ? (
        <div className="surface-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="size-4 text-warning" /> Alertas de presupuesto ({month})
          </h3>
          <ul className="mt-3 space-y-2">
            {alerts.map((r) => (
              <li
                key={r.budget.id}
                className={`rounded-md border-l-4 bg-secondary/60 p-3 text-sm ${
                  r.status === "excedido" ? "border-l-destructive" : "border-l-warning"
                }`}
              >
                <span className="font-semibold capitalize">{r.budget.scope}</span> ·{" "}
                {r.accountName}:{" "}
                {r.status === "excedido"
                  ? `excediste el presupuesto en ${formatMoney(r.variance)} (${(r.usage * 100).toFixed(0)}% ejecutado).`
                  : `vas en ${(r.usage * 100).toFixed(0)}% del presupuesto, quedan ${formatMoney(-r.variance)}.`}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="surface-card flex items-center gap-2 p-5 text-sm">
          <CheckCircle2 className="size-4 text-success" />
          Sin categorías excedidas en {month}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <VarianceTable title="Presupuesto personal" rows={personal} onRemove={onRemove} />
        <VarianceTable title="Presupuesto del negocio" rows={business} onRemove={onRemove} />
      </div>
    </div>
  );
}

function VarianceTable({
  title,
  rows,
  onRemove,
}: {
  title: string;
  rows: BudgetVariance[];
  onRemove: (id: string) => void;
}) {
  const t = budgetTotals(rows);
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Planeado {formatMoney(t.planned)} · Real {formatMoney(t.actual)} ·{" "}
          <span className={t.variance > 0 ? "text-destructive" : "text-success"}>
            {t.variance > 0 ? "+" : ""}
            {formatMoney(t.variance)}
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Planeado</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Variación</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.budget.id}>
                <TableCell>
                  <div className="font-medium">{r.accountName}</div>
                  <Progress value={Math.min(100, r.usage * 100)} className="mt-1.5 h-1.5 w-32" />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(r.budget.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.actual)}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    r.status === "excedido"
                      ? "text-destructive"
                      : r.status === "alerta"
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {r.status === "excedido" && <AlertTriangle className="size-3.5" />}
                    {r.variance > 0 ? "+" : ""}
                    {formatMoney(r.variance)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar presupuesto"
                    onClick={() => onRemove(r.budget.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay presupuesto para este mes y ámbito.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
