import { useCallback, useEffect, useState } from "react";
import { SEED_ENTRIES, type Entry } from "./finance";

const KEY = "finanzas-ledger-v1";

export function useLedger() {
  const [entries, setEntries] = useState<Entry[]>(SEED_ENTRIES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setEntries(JSON.parse(raw) as Entry[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }, [entries, ready]);

  const addEntry = useCallback((entry: Omit<Entry, "id">) => {
    setEntries((prev) => [{ ...entry, id: crypto.randomUUID() }, ...prev]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, addEntry, removeEntry, ready };
}