import { useCallback, useEffect, useState } from "react";
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

const KEY = "finanzas-metas-ahorro-v1";

const SEED: SavingsGoal[] = [
  { id: "g1", name: "Fondo de emergencia", scope: "personal", target: 12000, saved: 4200, deadline: "2027-06-30" },
  { id: "g2", name: "Cuota inicial vivienda", scope: "personal", target: 30000, saved: 6500, deadline: "2028-12-31" },
  { id: "g3", name: "Reserva de capital de trabajo", scope: "negocio", target: 20000, saved: 8000, deadline: "2027-03-31" },
];

export function useSavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>(SEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setGoals(JSON.parse(raw) as SavingsGoal[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(goals));
    } catch {
      /* ignore */
    }
  }, [goals, ready]);

  const addGoal = useCallback((g: Omit<SavingsGoal, "id">) => {
    setGoals((prev) => [{ ...g, id: crypto.randomUUID() }, ...prev]);
  }, []);

  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  return { goals, addGoal, removeGoal, ready };
}
