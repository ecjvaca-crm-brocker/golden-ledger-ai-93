import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CHART_OF_ACCOUNTS, type Entry, type Scope } from "@/lib/finance";

export function EntryForm({ onAdd }: { onAdd: (e: Omit<Entry, "id">) => void }) {
  const [scope, setScope] = useState<Scope>("personal");
  const [accountCode, setAccountCode] = useState("4135");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Ingresa una descripción y un monto mayor a cero.");
      return;
    }
    onAdd({
      scope,
      accountCode,
      description: description.trim().slice(0, 120),
      amount: value,
      date,
    });
    setDescription("");
    setAmount("");
    toast.success("Movimiento registrado");
  };

  const groups = [...new Set(CHART_OF_ACCOUNTS.map((a) => a.group))];

  return (
    <form onSubmit={submit} className="surface-card grid gap-4 p-5 md:grid-cols-6">
      <div className="md:col-span-2">
        <Label className="text-xs" htmlFor="desc">
          Descripción
        </Label>
        <Input
          id="desc"
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Factura cliente ACME"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label className="text-xs" htmlFor="amount">
          Monto
        </Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label className="text-xs" htmlFor="date">
          Fecha
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label className="text-xs">Ámbito</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="negocio">Negocio</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Cuenta (NIIF)</Label>
        <Select value={accountCode} onValueChange={setAccountCode}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {groups.map((g) => (
              <div key={g}>
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{g}</p>
                {CHART_OF_ACCOUNTS.filter((a) => a.group === g).map((a) => (
                  <SelectItem key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-6">
        <Button type="submit" className="w-full md:w-auto">
          Registrar movimiento
        </Button>
      </div>
    </form>
  );
}