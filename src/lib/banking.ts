import { useCallback, useEffect, useState } from "react";

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

const KEY = "finanzas-productos-v1";

const SEED: BankProduct[] = [
  { id: "p1", entity: "Bancolombia", type: "ahorro", alias: "Ahorro principal", balance: 9800, rate: 4 },
  { id: "p2", entity: "Davivienda", type: "tarjeta", alias: "Visa Signature", balance: 3100, limit: 8000, rate: 28 },
  { id: "p3", entity: "Fiduciaria Global", type: "inversion", alias: "Póliza a 12 meses", balance: 6500, rate: 9.5 },
];

export function useBankProducts() {
  const [products, setProducts] = useState<BankProduct[]>(SEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProducts(JSON.parse(raw) as BankProduct[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(products));
    } catch {
      /* ignore */
    }
  }, [products, ready]);

  const addProduct = useCallback((p: Omit<BankProduct, "id">) => {
    setProducts((prev) => [{ ...p, id: crypto.randomUUID() }, ...prev]);
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { products, addProduct, removeProduct, ready };
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
