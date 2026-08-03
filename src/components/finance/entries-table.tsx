import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountByCode, formatMoney, type Entry } from "@/lib/finance";
import { EntryEditDialog } from "./edit-dialogs";

export function EntriesTable({
  entries,
  onRemove,
  onUpdate,
}: {
  entries: Entry[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, value: Omit<Entry, "id">) => void;
}) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="surface-card overflow-hidden">
      <div className="p-5">
        <h3 className="text-sm font-semibold">Movimientos registrados</h3>
        <p className="mt-1 text-xs text-muted-foreground">{entries.length} registros</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((e) => {
              const acc = accountByCode(e.accountCode);
              return (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {e.date}
                  </TableCell>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.accountCode} · {acc?.name}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{e.scope}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${acc?.type === "ingreso" ? "text-success" : acc?.type === "gasto" ? "text-destructive" : ""}`}
                  >
                    {formatMoney(e.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <EntryEditDialog entry={e} onSave={onUpdate} />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar movimiento"
                      onClick={() => onRemove(e.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}