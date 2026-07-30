import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPE_LABEL,
  CHART_OF_ACCOUNTS,
  formatMoney,
  type Entry,
} from "@/lib/finance";

export function AccountsTable({ entries }: { entries: Entry[] }) {
  const totals = new Map<string, number>();
  for (const e of entries) totals.set(e.accountCode, (totals.get(e.accountCode) ?? 0) + e.amount);

  return (
    <div className="surface-card overflow-hidden">
      <div className="p-5">
        <h3 className="text-sm font-semibold">Plan de cuentas (estructura NIIF)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Saldos consolidados de personal y negocio por cuenta
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Naturaleza</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CHART_OF_ACCOUNTS.map((a) => (
              <TableRow key={a.code}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground">{a.group}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ACCOUNT_TYPE_LABEL[a.type]}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(totals.get(a.code) ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}