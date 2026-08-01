import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Target, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import { formatMoney, type Entry, type Scope } from "@/lib/finance";
import {
  goalTotals,
  monthlyNetFlow,
  projectGoal,
  type GoalProjection,
  type SavingsGoal,
} from "@/lib/savings";
import { KpiCard } from "@/components/finance/kpi-card";

export function SavingsPanel({
  goals,
  entries,
  onAdd,
  onRemove,
}: {
  goals: SavingsGoal[];
  entries: Entry[];
  onAdd: (g: Omit<SavingsGoal, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("personal");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");

  const netFlow = useMemo(() => monthlyNetFlow(entries), [entries]);
  const rows = useMemo(
    () => goals.map((g) => projectGoal(g, netFlow)).sort((a, b) => a.monthsLeft - b.monthsLeft),
    [goals, netFlow],
  );
  const totals = goalTotals(rows);
  const globalProgress = totals.target > 0 ? totals.saved / totals.target : 0;
  const freeFlow = netFlow - totals.requiredMonthly;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = Number(target);
    const s = Number(saved || "0");
    if (!name.trim()) return toast.error("Ponle un nombre a la meta.");
    if (!Number.isFinite(t) || t <= 0) return toast.error("La meta debe ser mayor a cero.");
    if (!deadline) return toast.error("Selecciona una fecha objetivo.");
    onAdd({ name: name.trim(), scope, target: t, saved: Math.max(0, s), deadline });
    setName("");
    setTarget("");
    setSaved("");
    toast.success("Meta de ahorro proyectada");
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Flujo neto mensual"
          value={formatMoney(netFlow)}
          icon={Target}
          tone={netFlow >= 0 ? "positive" : "negative"}
          hint="(Ingresos − Gastos) ÷ meses registrados"
        />
        <KpiCard
          label="Cuota de ahorro requerida"
          value={formatMoney(totals.requiredMonthly)}
          icon={Target}
          tone="gold"
          hint="Suma mensual de todas las metas"
        />
        <KpiCard
          label="Avance global"
          value={`${(globalProgress * 100).toFixed(1)}%`}
          icon={CheckCircle2}
          hint={`${formatMoney(totals.saved)} de ${formatMoney(totals.target)}`}
        />
        <KpiCard
          label="Margen tras ahorrar"
          value={formatMoney(freeFlow)}
          icon={AlertTriangle}
          tone={freeFlow >= 0 ? "positive" : "negative"}
          hint={freeFlow >= 0 ? "Flujo libre disponible" : "Debes recortar gastos"}
        />
      </section>

      <form onSubmit={submit} className="surface-card grid gap-4 p-5 md:grid-cols-5">
        <div className="md:col-span-2">
          <Label className="text-xs">Nombre de la meta</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fondo de emergencia"
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
        <div>
          <Label className="text-xs">Monto objetivo</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Ya ahorrado</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
            placeholder="0"
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Fecha objetivo</Label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-5">
          <Button type="submit" className="w-full md:w-auto">
            Proyectar meta
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <GoalCard key={r.goal.id} row={r} netFlow={netFlow} onRemove={onRemove} />
        ))}
        {rows.length === 0 && (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Aún no has creado metas de ahorro.
          </div>
        )}
      </div>

      <div className="surface-card flex items-start gap-2 p-5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" />
        <p>
          Cuota mensual = (monto objetivo − ahorrado) ÷ meses restantes. La viabilidad compara esa
          cuota con tu flujo neto mensual promedio (Ingresos − Gastos).
        </p>
      </div>
    </div>
  );
}

function GoalCard({
  row,
  netFlow,
  onRemove,
}: {
  row: GoalProjection;
  netFlow: number;
  onRemove: (id: string) => void;
}) {
  const tone =
    row.status === "inviable"
      ? "text-destructive"
      : row.status === "ajustado"
        ? "text-warning"
        : "text-success";
  const label =
    row.status === "logrado"
      ? "Meta alcanzada"
      : row.status === "viable"
        ? "Viable con tu flujo actual"
        : row.status === "ajustado"
          ? "Ajustado: consume gran parte del flujo"
          : netFlow > 0
            ? "Inviable: la cuota supera tu flujo neto"
            : "Inviable: tu flujo neto no es positivo";

  return (
    <div className="surface-card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.goal.name}</h3>
          <p className="text-xs capitalize text-muted-foreground">
            {row.goal.scope} · objetivo {row.goal.deadline} · {row.monthsLeft} meses restantes
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Eliminar meta"
          onClick={() => onRemove(row.goal.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {formatMoney(row.goal.saved)} de {formatMoney(row.goal.target)}
          </span>
          <span className="font-semibold text-foreground">
            {(row.progress * 100).toFixed(1)}% de avance
          </span>
        </div>
        <Progress value={row.progress * 100} className="mt-1.5 h-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-secondary/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Cuota mensual necesaria
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-gold">
            {formatMoney(row.requiredMonthly)}
          </p>
        </div>
        <div className="rounded-md bg-secondary/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Ritmo actual
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {Number.isFinite(row.projectedMonths)
              ? `${Math.ceil(row.projectedMonths)} meses`
              : "—"}
          </p>
        </div>
      </div>

      <p className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
        {row.status === "viable" || row.status === "logrado" ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <AlertTriangle className="size-3.5" />
        )}
        {label}
        {Number.isFinite(row.coverage) && row.status !== "logrado"
          ? ` · usa el ${(row.coverage * 100).toFixed(0)}% de tu flujo neto`
          : ""}
      </p>
    </div>
  );
}
