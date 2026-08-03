import { useCloudCollection, num, str, type Row } from "./cloud-store";
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

const fromRow = (r: Row): Budget => ({
  id: str(r["id"]),
  scope: str(r["scope"]) as Scope,
  accountCode: str(r["account_code"]),
  month: str(r["month"]),
  amount: num(r["amount"]),
});

const toRow = (b: Partial<Omit<Budget, "id">>): Row => {
  const row: Row = {};
  if (b.scope !== undefined) row["scope"] = b.scope;
  if (b.accountCode !== undefined) row["account_code"] = b.accountCode;
  if (b.month !== undefined) row["month"] = b.month;
  if (b.amount !== undefined) row["amount"] = b.amount;
  return row;
};

export function useBudgets() {
  const c = useCloudCollection<Budget>("budgets", fromRow, toRow, {
    column: "month",
    ascending: false,
  });

  const addBudget = async (b: Omit<Budget, "id">) => {
    const existing = c.items.find(
      (p) => p.scope === b.scope && p.accountCode === b.accountCode && p.month === b.month,
    );
    if (existing) await c.update(existing.id, { amount: b.amount });
    else await c.add(b);
  };

  return {
    budgets: c.items,
    addBudget,
    updateBudget: c.update,
    removeBudget: c.remove,
    ready: c.ready,
  };
}
