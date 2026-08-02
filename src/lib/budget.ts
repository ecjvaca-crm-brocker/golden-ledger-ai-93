import { useCallback, useEffect, useState } from "react";
import { accountByCode, monthKey, type Entry, type Scope } from "./finance";

export interface Budget {
  id: string;
  scope: Scope;
  accountCode: string;
  month: string; // yyyy-mm
  amount: number;
}

export interface BudgetVariance {
  budget: Budget;
  accountName: string;
  actual: number;
  variance: number; // actual - planeado (positivo = exceso)
  usage: number;
  status: "ok" | "alerta" | "excedido";
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export function computeVariances(budgets: Budget[], entries: Entry[]): BudgetVariance[] {
  return budgets
    .map((b) => {
      const actual = entries
        .filter(
          (e) =>
            e.scope === b.scope && e.accountCode === b.accountCode && monthKey(e.date) === b.month,
        )
        .reduce((s, e) => s + e.amount, 0);
      const usage = b.amount > 0 ? actual / b.amount : 0;
      return {
        budget: b,
        accountName: accountByCode(b.accountCode)?.name ?? b.accountCode,
        actual,
        variance: actual - b.amount,
        usage,
        status: usage > 1 ? "excedido" : usage >= 0.85 ? "alerta" : "ok",
      } as BudgetVariance;
    })
    .sort((a, b) => b.usage - a.usage);
}

export function budgetTotals(rows: BudgetVariance[]) {
  const planned = rows.reduce((s, r) => s + r.budget.amount, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  return {
    planned,
    actual,
    variance: actual - planned,
    exceeded: rows.filter((r) => r.status === "excedido").length,
    warning: rows.filter((r) => r.status === "alerta").length,
  };
}

const KEY = "finanzas-presupuesto-v1";

c

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setBudgets(JSON.parse(raw) as Budget[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(budgets));
    } catch {
      /* ignore */
    }
  }, [budgets, ready]);

  const addBudget = useCallback((b: Omit<Budget, "id">) => {
    setBudgets((prev) => {
      const existing = prev.find(
        (p) => p.scope === b.scope && p.accountCode === b.accountCode && p.month === b.month,
      );
      if (existing) return prev.map((p) => (p.id === existing.id ? { ...p, amount: b.amount } : p));
      return [{ ...b, id: crypto.randomUUID() }, ...prev];
    });
  }, []);

  const removeBudget = useCallback((id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { budgets, addBudget, removeBudget, ready };
}
