import { useCloudCollection, num, str, type Row } from "./cloud-store";
import { monthKey, type Entry, type Scope } from "./finance";
import { accountByCode } from "./finance";

export interface SavingsGoal {
  id: string;
  name: string;
  scope: Scope;
  target: number;
  saved: number;
  deadline: string; // yyyy-mm-dd
}

export interface GoalProjection {
  goal: SavingsGoal;
  remaining: number;
  monthsLeft: number;
  requiredMonthly: number;
  progress: number; // 0-1
  coverage: number; // cuota requerida / flujo neto mensual disponible
  status: "logrado" | "viable" | "ajustado" | "inviable";
  projectedMonths: number; // meses estimados al ritmo del flujo neto
}

/** Flujo neto mensual promedio = (Ingresos - Gastos) / meses con movimientos. */
export function monthlyNetFlow(entries: Entry[]): number {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    const acc = accountByCode(e.accountCode);
    if (!acc) continue;
    if (acc.type === "ingreso") income += e.amount;
    if (acc.type === "gasto") expense += e.amount;
  }
  const months = new Set(entries.map((e) => monthKey(e.date))).size || 1;
  return (income - expense) / months;
}

export function monthsUntil(deadline: string, from = new Date()): number {
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const diff =
    (d.getFullYear() - from.getFullYear()) * 12 +
    (d.getMonth() - from.getMonth()) +
    (d.getDate() >= from.getDate() ? 0 : -1);
  return Math.max(0, diff);
}

export function projectGoal(goal: SavingsGoal, netFlow: number): GoalProjection {
  const remaining = Math.max(0, goal.target - goal.saved);
  const monthsLeft = monthsUntil(goal.deadline);
  const requiredMonthly = remaining === 0 ? 0 : monthsLeft > 0 ? remaining / monthsLeft : remaining;
  const progress = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  const coverage = netFlow > 0 ? requiredMonthly / netFlow : Infinity;
  const projectedMonths = netFlow > 0 ? remaining / netFlow : Infinity;

  let status: GoalProjection["status"] = "viable";
  if (remaining === 0) status = "logrado";
  else if (!Number.isFinite(coverage) || coverage > 1) status = "inviable";
  else if (coverage > 0.75) status = "ajustado";

  return { goal, remaining, monthsLeft, requiredMonthly, progress, coverage, status, projectedMonths };
}

export function goalTotals(rows: GoalProjection[]) {
  return {
    target: rows.reduce((s, r) => s + r.goal.target, 0),
    saved: rows.reduce((s, r) => s + r.goal.saved, 0),
    requiredMonthly: rows.reduce((s, r) => s + r.requiredMonthly, 0),
  };
}

const fromRow = (r: Row): SavingsGoal => ({
  id: str(r["id"]),
  name: str(r["name"]),
  scope: str(r["scope"]) as Scope,
  target: num(r["target"]),
  saved: num(r["saved"]),
  deadline: str(r["deadline"]),
});

const toRow = (g: Partial<Omit<SavingsGoal, "id">>): Row => {
  const row: Row = {};
  if (g.name !== undefined) row["name"] = g.name;
  if (g.scope !== undefined) row["scope"] = g.scope;
  if (g.target !== undefined) row["target"] = g.target;
  if (g.saved !== undefined) row["saved"] = g.saved;
  if (g.deadline !== undefined) row["deadline"] = g.deadline;
  return row;
};

export function useSavingsGoals() {
  const c = useCloudCollection<SavingsGoal>("savings_goals", fromRow, toRow, {
    column: "deadline",
    ascending: true,
  });
  return {
    goals: c.items,
    addGoal: c.add,
    updateGoal: c.update,
    removeGoal: c.remove,
    ready: c.ready,
  };
}
