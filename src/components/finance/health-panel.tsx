import { Progress } from "@/components/ui/progress";
import {
  buildIndicators,
  healthLabel,
  healthScore,
  type Metrics,
  type Recommendation,
} from "@/lib/finance";

export function HealthPanel({
  metrics,
  title,
}: {
  metrics: Metrics;
  title: string;
}) {
  const indicators = buildIndicators(metrics);
  const score = healthScore(indicators);

  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="font-display text-2xl font-semibold text-gold">{score}/100</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Situación financiera: <span className="text-foreground">{healthLabel(score)}</span>
      </p>
      <ul className="mt-5 space-y-4">
        {indicators.map((i) => (
          <li key={i.name}>
            <div className="flex items-center justify-between text-sm">
              <span>{i.name}</span>
              <span className="font-semibold">{i.value}</span>
            </div>
            <Progress value={i.score} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">{i.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecommendationList({ items }: { items: Recommendation[] }) {
  const tone = {
    critico: "border-l-destructive",
    atencion: "border-l-warning",
    bien: "border-l-success",
  } as const;
  const label = { critico: "Prioridad alta", atencion: "Revisar", bien: "En buen camino" };

  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Recomendaciones de manejo eficiente</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Generadas a partir de tus indicadores actuales
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((r) => (
          <li key={r.title} className={`rounded-md border-l-4 bg-secondary/60 p-4 ${tone[r.level]}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{r.title}</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {label[r.level]} · {r.scope}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{r.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}