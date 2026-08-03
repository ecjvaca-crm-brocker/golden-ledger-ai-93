import { useCloudCollection, num, str, type Row } from "./cloud-store";

export type ProductType = "ahorro" | "corriente" | "inversion" | "tarjeta" | "credito";

export const PRODUCT_LABEL: Record<ProductType, string> = {
  ahorro: "Cuenta de ahorros",
  corriente: "Cuenta corriente",
  inversion: "Póliza / inversión",
  tarjeta: "Tarjeta de crédito",
  credito: "Crédito / préstamo",
};

export interface BankProduct {
  id: string;
  entity: string;
  type: ProductType;
  alias: string;
  balance: number; // saldo o valor; en tarjetas/créditos es la deuda
  limit?: number; // cupo para tarjetas
  rate?: number; // tasa % E.A.
}

const fromRow = (r: Row): BankProduct => ({
  id: str(r["id"]),
  entity: str(r["entity"]),
  type: str(r["type"]) as ProductType,
  alias: str(r["alias"]),
  balance: num(r["balance"]),
  limit: r["credit_limit"] == null ? undefined : num(r["credit_limit"]),
  rate: r["rate"] == null ? undefined : num(r["rate"]),
});

const toRow = (p: Partial<Omit<BankProduct, "id">>): Row => {
  const row: Row = {};
  if (p.entity !== undefined) row["entity"] = p.entity;
  if (p.type !== undefined) row["type"] = p.type;
  if (p.alias !== undefined) row["alias"] = p.alias;
  if (p.balance !== undefined) row["balance"] = p.balance;
  if ("limit" in p) row["credit_limit"] = p.limit ?? null;
  if ("rate" in p) row["rate"] = p.rate ?? null;
  return row;
};

export function useBankProducts() {
  const c = useCloudCollection<BankProduct>("bank_products", fromRow, toRow, {
    column: "created_at",
    ascending: false,
  });
  return {
    products: c.items,
    addProduct: c.add,
    updateProduct: c.update,
    removeProduct: c.remove,
    ready: c.ready,
  };
}

export function productSummary(products: BankProduct[]) {
  const liquid = products
    .filter((p) => p.type === "ahorro" || p.type === "corriente")
    .reduce((s, p) => s + p.balance, 0);
  const invested = products.filter((p) => p.type === "inversion").reduce((s, p) => s + p.balance, 0);
  const debt = products
    .filter((p) => p.type === "tarjeta" || p.type === "credito")
    .reduce((s, p) => s + p.balance, 0);
  const cardLimit = products
    .filter((p) => p.type === "tarjeta")
    .reduce((s, p) => s + (p.limit ?? 0), 0);
  const cardUsed = products.filter((p) => p.type === "tarjeta").reduce((s, p) => s + p.balance, 0);
  return {
    liquid,
    invested,
    debt,
    netWorth: liquid + invested - debt,
    cardUtilization: cardLimit > 0 ? cardUsed / cardLimit : 0,
  };
}
