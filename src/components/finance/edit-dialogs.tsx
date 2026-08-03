import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHART_OF_ACCOUNTS, type Entry, type Scope } from "@/lib/finance";
import { PRODUCT_LABEL, type BankProduct, type ProductType } from "@/lib/banking";
import type { SavingsGoal } from "@/lib/savings";

function Shell({
  title,
  children,
  label,
}: {
  title: string;
  children: (close: () => void) => ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

export function EntryEditDialog({
  entry,
  onSave,
}: {
  entry: Entry;
  onSave: (id: string, value: Omit<Entry, "id">) => void;
}) {
  const [form, setForm] = useState({
    description: entry.description,
    amount: String(entry.amount),
    date: entry.date,
    scope: entry.scope,
    accountCode: entry.accountCode,
  });
  const groups = [...new Set(CHART_OF_ACCOUNTS.map((a) => a.group))];

  return (
    <Shell title="Editar movimiento" label="Editar movimiento">
      {(close) => (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Descripción</Label>
            <Input
              value={form.description}
              maxLength={120}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Ámbito</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => setForm({ ...form, scope: v as Scope })}
            >
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
            <Select
              value={form.accountCode}
              onValueChange={(v) => setForm({ ...form, accountCode: v })}
            >
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
          <DialogFooter>
            <Button
              onClick={() => {
                const value = Number(form.amount);
                if (!form.description.trim() || !Number.isFinite(value) || value <= 0) {
                  toast.error("Revisa la descripción y el monto.");
                  return;
                }
                onSave(entry.id, {
                  description: form.description.trim().slice(0, 120),
                  amount: value,
                  date: form.date,
                  scope: form.scope,
                  accountCode: form.accountCode,
                });
                toast.success("Movimiento actualizado");
                close();
              }}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </div>
      )}
    </Shell>
  );
}

export function ProductEditDialog({
  product,
  onSave,
}: {
  product: BankProduct;
  onSave: (id: string, value: Omit<BankProduct, "id">) => void;
}) {
  const [form, setForm] = useState({
    entity: product.entity,
    alias: product.alias,
    type: product.type,
    balance: String(product.balance),
    limit: product.limit != null ? String(product.limit) : "",
    rate: product.rate != null ? String(product.rate) : "",
  });

  return (
    <Shell title="Editar producto financiero" label="Editar producto">
      {(close) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Entidad</Label>
              <Input
                value={form.entity}
                onChange={(e) => setForm({ ...form, entity: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Nombre del producto</Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as ProductType })}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRODUCT_LABEL) as ProductType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {PRODUCT_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Saldo / deuda</Label>
              <Input
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Cupo</Label>
              <Input
                type="number"
                step="0.01"
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Tasa % E.A.</Label>
              <Input
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const balance = Number(form.balance);
                if (!form.entity.trim() || !form.alias.trim() || !Number.isFinite(balance)) {
                  toast.error("Revisa entidad, nombre y saldo.");
                  return;
                }
                onSave(product.id, {
                  entity: form.entity.trim().slice(0, 60),
                  alias: form.alias.trim().slice(0, 60),
                  type: form.type,
                  balance,
                  limit: form.limit ? Number(form.limit) : undefined,
                  rate: form.rate ? Number(form.rate) : undefined,
                });
                toast.success("Producto actualizado");
                close();
              }}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </div>
      )}
    </Shell>
  );
}

export function GoalEditDialog({
  goal,
  onSave,
}: {
  goal: SavingsGoal;
  onSave: (id: string, value: Omit<SavingsGoal, "id">) => void;
}) {
  const [form, setForm] = useState({
    name: goal.name,
    scope: goal.scope,
    target: String(goal.target),
    saved: String(goal.saved),
    deadline: goal.deadline,
  });

  return (
    <Shell title="Editar meta de ahorro" label="Editar meta">
      {(close) => (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nombre de la meta</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Objetivo</Label>
              <Input
                type="number"
                step="0.01"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Ahorrado</Label>
              <Input
                type="number"
                step="0.01"
                value={form.saved}
                onChange={(e) => setForm({ ...form, saved: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Fecha límite</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Ámbito</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm({ ...form, scope: v as Scope })}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="negocio">Negocio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const target = Number(form.target);
                const saved = Number(form.saved);
                if (!form.name.trim() || !Number.isFinite(target) || target <= 0) {
                  toast.error("Revisa el nombre y el objetivo de la meta.");
                  return;
                }
                onSave(goal.id, {
                  name: form.name.trim().slice(0, 80),
                  scope: form.scope,
                  target,
                  saved: Math.max(0, Number.isFinite(saved) ? saved : 0),
                  deadline: form.deadline,
                });
                toast.success("Meta actualizada");
                close();
              }}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </div>
      )}
    </Shell>
  );
}
