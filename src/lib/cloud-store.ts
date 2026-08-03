import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export type Row = Record<string, unknown>;
export type TableName = "entries" | "budgets" | "bank_products" | "savings_goals";

/**
 * Colección persistida en la nube y vinculada al usuario autenticado.
 * Sin sesión la colección está vacía: todo usuario nuevo arranca en cero.
 */
export function useCloudCollection<T extends { id: string }>(
  table: TableName,
  fromRow: (row: Row) => T,
  toRow: (value: Partial<Omit<T, "id">>) => Row,
  order: { column: string; ascending: boolean },
) {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = () => supabase.from(table) as any;

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setReady(true);
      return;
    }
    const { data, error } = await q()
      .select("*")
      .order(order.column, { ascending: order.ascending });
    if (error) toast.error("No pudimos cargar tus datos guardados.");
    else setItems(((data ?? []) as Row[]).map(fromRow));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, table]);

  useEffect(() => {
    if (sessionLoading) return;
    setReady(false);
    void reload();
  }, [sessionLoading, reload]);

  const requireUser = () => {
    if (!userId) {
      toast.error("Inicia sesión para guardar tus datos en la nube.");
      return false;
    }
    return true;
  };

  const add = useCallback(
    async (value: Omit<T, "id">) => {
      if (!requireUser()) return;
      const { data, error } = await q()
        .insert({ ...toRow(value), user_id: userId })
        .select("*")
        .single();
      if (error || !data) {
        toast.error("No pudimos guardar el registro.");
        return;
      }
      setItems((prev) => [fromRow(data as Row), ...prev]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, table],
  );

  const update = useCallback(
    async (id: string, value: Partial<Omit<T, "id">>) => {
      if (!requireUser()) return;
      const { data, error } = await q().update(toRow(value)).eq("id", id).select("*").single();
      if (error || !data) {
        toast.error("No pudimos actualizar el registro.");
        return;
      }
      const next = fromRow(data as Row);
      setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, table],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!requireUser()) return;
      const { error } = await q().delete().eq("id", id);
      if (error) {
        toast.error("No pudimos eliminar el registro.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, table],
  );

  return { items, ready, add, update, remove, reload, signedIn: Boolean(userId) };
}

export const num = (v: unknown) => Number(v ?? 0);
export const str = (v: unknown) => String(v ?? "");
