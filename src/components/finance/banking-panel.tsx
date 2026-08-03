import { useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  PiggyBank,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { accountByCode, formatMoney, type Entry, type Metrics } from "@/lib/finance";
import {
  PRODUCT_LABEL,
  productSummary,
  type BankProduct,
  type ProductType,
} from "@/lib/banking";
import { analyzeFinances, type AiAnalysis } from "@/lib/ai-advisor.functions";
import { ProductEditDialog } from "./edit-dialogs";

const TYPE_ICON: Record<ProductType, typeof Landmark> = {
  ahorro: PiggyBank,
  corriente: Banknote,
  inversion: TrendingUp,
  tarjeta: CreditCard,
  credito: Landmark,
};

const INSIGHT_STYLE = {
  alerta: { border: "border-l-destructive", label: "Alerta" },
  gasto_innecesario: { border: "border-l-warning", label: "Gasto innecesario" },
  aporta_valor: { border: "border-l-success", label: "Aporta valor" },
  oportunidad: { border: "border-l-gold", label: "Oportunidad" },
} as const;

export function BankingPanel({
  products,
  entries,
  metrics,
  onAdd,
  onRemove,
  onUpdate,
}: {
  products: BankProduct[];
  entries: Entry[];
  metrics: Metrics;
  onAdd: (p: Omit<BankProduct, "id">) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, value: Omit<BankProduct, "id">) => void;
}) {
  const [entity, setEntity] = useState("");
  const [alias, setAlias] = useState("");
  const [type, setType] = useState<ProductType>("ahorro");
  const [balance, setBalance] = useState("");
  const [limit, setLimit] = useState("");
  const [rate, setRate] = useState("");

  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const runAnalysis = useServerFn(analyzeFinances);

  const summary = useMemo(() => productSummary(products), [products]);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const value = Number(balance);
    if (!entity.trim() || !alias.trim() || !Number.isFinite(value)) {
      toast.error("Completa entidad, nombre del producto y saldo.");
      return;
    }
    onAdd({
      entity: entity.trim().slice(0, 60),
      alias: alias.trim().slice(0, 60),
      type,
      balance: value,
      limit: limit ? Number(limit) : undefined,
      rate: rate ? Number(rate) : undefined,
    });
    setEntity("");
    setAlias("");
    setBalance("");
    setLimit("");
    setRate("");
    toast.success("Producto financiero agregado");
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const result = await runAnalysis({
        data: {
          productos: products.map((p) => ({
            entidad: p.entity,
            tipo: PRODUCT_LABEL[p.type],
            alias: p.alias,
            saldo: p.balance,
            cupo: p.limit,
            tasa: p.rate,
          })),
          movimientos: entries
            .filter((e) => e.scope === "personal")
            .slice(0, 120)
            .map((e) => ({
              fecha: e.date,
              descripcion: e.description,
              monto: e.amount,
              cuenta: accountByCode(e.accountCode)?.name ?? e.accountCode,
              tipo: accountByCode(e.accountCode)?.type ?? "otro",
            })),
          resumen: {
            ingresos: metrics.income,
            gastos: metrics.expense,
            tasaAhorro: Number((metrics.savingsRate * 100).toFixed(1)),
            liquidez: summary.liquid,
            deuda: summary.debt,
            usoTarjetas: Number((summary.cardUtilization * 100).toFixed(1)),
          },
        },
      });
      setAnalysis(result);
      toast.success("Análisis listo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el análisis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Liquidez en cuentas" value={formatMoney(summary.liquid)} />
        <MiniStat label="Inversiones y pólizas" value={formatMoney(summary.invested)} />
        <MiniStat label="Deuda (tarjetas y créditos)" value={formatMoney(summary.debt)} />
        <MiniStat
          label="Uso del cupo de tarjetas"
          value={`${(summary.cardUtilization * 100).toFixed(0)}%`}
        />
      </div>

      <form onSubmit={submit} className="surface-card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label className="text-xs">Entidad bancaria</Label>
          <Input
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="Ej. Bancolombia"
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Nombre del producto</Label>
          <Input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ej. Ahorro nómina"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as ProductType)}>
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
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Cupo (tarjetas)</Label>
          <Input
            type="number"
            step="0.01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Opcional"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Tasa % E.A.</Label>
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Opcional"
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-4 md:self-end">
          <Button type="submit" className="w-full md:w-auto">
            Agregar producto
          </Button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const Icon = TYPE_ICON[p.type];
          const util = p.limit ? p.balance / p.limit : 0;
          return (
            <div key={p.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4 text-gold" /> {p.alias}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.entity} · {PRODUCT_LABEL[p.type]}
                    {p.rate ? ` · ${p.rate}% E.A.` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                <ProductEditDialog product={p} onSave={onUpdate} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar producto"
                  onClick={() => onRemove(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
                </div>
              </div>
              <p className="mt-4 font-display text-xl font-semibold tabular-nums">
                {formatMoney(p.balance)}
              </p>
              {p.limit ? (
                <>
                  <Progress value={Math.min(100, util * 100)} className="mt-3 h-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(util * 100).toFixed(0)}% del cupo de {formatMoney(p.limit)}
                  </p>
                </>
              ) : null}
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no has registrado productos financieros.
          </p>
        )}
      </div>

      <div className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-gold" /> Análisis inteligente de consumo
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Revisamos tus productos, compras e ingresos y señalamos gastos innecesarios,
              alertas y gastos que sí aportan a tu estilo de vida.
            </p>
          </div>
          <Button onClick={analyze} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {loading ? "Analizando…" : "Analizar consumos"}
          </Button>
        </div>

        {analysis ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground">{analysis.resumen}</p>
              {analysis.puntaje > 0 && (
                <span className="font-display text-2xl font-semibold text-gold">
                  {analysis.puntaje}/100
                </span>
              )}
            </div>
            <ul className="mt-4 space-y-3">
              {analysis.hallazgos.map((h, i) => (
                <li
                  key={`${h.titulo}-${i}`}
                  className={`rounded-md border-l-4 bg-secondary/60 p-4 ${INSIGHT_STYLE[h.tipo].border}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{h.titulo}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {INSIGHT_STYLE[h.tipo].label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{h.detalle}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Ejecuta el análisis para recibir criterios y recomendaciones personalizadas.
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
