import { useCloudCollection, num, str, type Row } from "./cloud-store";
import type { Entry, Scope } from "./finance";

const fromRow = (r: Row): Entry => ({
  id: str(r["id"]),
  date: str(r["date"]),
  description: str(r["description"]),
  amount: num(r["amount"]),
  accountCode: str(r["account_code"]),
  scope: str(r["scope"]) as Scope,
});

const toRow = (e: Partial<Omit<Entry, "id">>): Row => {
  const row: Row = {};
  if (e.date !== undefined) row["date"] = e.date;
  if (e.description !== undefined) row["description"] = e.description;
  if (e.amount !== undefined) row["amount"] = e.amount;
  if (e.accountCode !== undefined) row["account_code"] = e.accountCode;
  if (e.scope !== undefined) row["scope"] = e.scope;
  return row;
};

export function useLedger() {
  const c = useCloudCollection<Entry>("entries", fromRow, toRow, {
    column: "date",
    ascending: false,
  });
  return {
    entries: c.items,
    addEntry: c.add,
    updateEntry: c.update,
    removeEntry: c.remove,
    ready: c.ready,
    signedIn: c.signedIn,
  };
}
