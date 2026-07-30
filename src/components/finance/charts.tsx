import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { accountByCode, formatMoney, monthKey, type Entry } from "@/lib/finance";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--foreground)",
};

export function CashflowChart({ entries }: { entries: Entry[] }) {
  const map = new Map<string, { month: string; ingresos: number; gastos: number }>();
  for (const e of entries) {
    const acc = accountByCode(e.accountCode);
    if (!acc || (acc.type !== "ingreso" && acc.type !== "gasto")) continue;
    const k = monthKey(e.date);
    const row = map.get(k) ?? { month: k, ingresos: 0, gastos: 0 };
    if (acc.type === "ingreso") row.ingresos += e.amount;
    else row.gastos += e.amount;
    map.set(k, row);
  }
  const data = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Flujo mensual: ingresos vs. gastos</h3>
      <p className="mt-1 text-xs text-muted-foreground">Consolidado de todas tus cuentas</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -18, right: 6, top: 8 }}>
            <defs>
              <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="var(--chart-1)"
              fill="url(#gIn)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="var(--chart-2)"
              fill="url(#gOut)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExpenseByCategoryChart({ entries }: { entries: Entry[] }) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const acc = accountByCode(e.accountCode);
    if (acc?.type !== "gasto") continue;
    map.set(acc.name, (map.get(acc.name) ?? 0) + e.amount);
  }
  const data = [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Gasto por categoría contable</h3>
      <p className="mt-1 text-xs text-muted-foreground">Top 6 cuentas del grupo 5</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ScopeComparisonChart({
  personalNet,
  businessNet,
  personalIncome,
  businessIncome,
}: {
  personalNet: number;
  businessNet: number;
  personalIncome: number;
  businessIncome: number;
}) {
  const data = [
    { name: "Personal", ingresos: personalIncome, resultado: personalNet },
    { name: "Negocio", ingresos: businessIncome, resultado: businessNet },
  ];
  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Personal vs. Negocio</h3>
      <p className="mt-1 text-xs text-muted-foreground">Ingresos y resultado neto del período</p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -18, right: 6, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="resultado" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}