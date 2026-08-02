const OWNER_KEY = "finanzas-owner-id";

const DATA_KEYS = [
  "finanzas-ledger-v1",
  "finanzas-presupuesto-v1",
  "finanzas-productos-v1",
  "finanzas-metas-ahorro-v1",
];

/**
 * Cada usuario empieza en cero: si la sesión activa pertenece a otro usuario
 * (o es un registro nuevo), se limpian los datos financieros locales.
 */
export function syncUserScope(userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = localStorage.getItem(OWNER_KEY);
    const next = userId ?? "";
    if (previous === next) return false;
    const first = previous === null;
    DATA_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(OWNER_KEY, next);
    return !first;
  } catch {
    return false;
  }
}
