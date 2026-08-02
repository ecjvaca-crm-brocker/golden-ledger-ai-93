export type Scope = "personal" | "negocio";
export type AccountType = "activo" | "pasivo" | "patrimonio" | "ingreso" | "gasto";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  group: string;
}

export interface Entry {
  id: string;
  date: string; // yyyy-mm-dd
  description: string;
  amount: number;
  accountCode: string;
  scope: Scope;
}

/** Plan de cuentas base alineado a la estructura NIIF (grupos 1-5). */
export const CHART_OF_ACCOUNTS: Account[] = [
  { code: "1105", name: "Efectivo y equivalentes", type: "activo", group: "Activo corriente" },
  { code: "1110", name: "Bancos", type: "activo", group: "Activo corriente" },
  { code: "1305", name: "Cuentas por cobrar", type: "activo", group: "Activo corriente" },
  { code: "1435", name: "Inventarios", type: "activo", group: "Activo corriente" },
  { code: "1504", name: "Propiedad, planta y equipo", type: "activo", group: "Activo no corriente" },
  { code: "1705", name: "Inversiones", type: "activo", group: "Activo no corriente" },
  { code: "2205", name: "Proveedores", type: "pasivo", group: "Pasivo corriente" },
  { code: "2305", name: "Tarjetas de crédito", type: "pasivo", group: "Pasivo corriente" },
  { code: "2405", name: "Impuestos por pagar", type: "pasivo", group: "Pasivo corriente" },
  { code: "2105", name: "Obligaciones financieras L/P", type: "pasivo", group: "Pasivo no corriente" },
  { code: "3105", name: "Capital / Aportes", type: "patrimonio", group: "Patrimonio" },
  { code: "3605", name: "Resultados acumulados", type: "patrimonio", group: "Patrimonio" },
  { code: "4105", name: "Ventas / Servicios", type: "ingreso", group: "Ingresos operacionales" },
  { code: "4135", name: "Salario / Honorarios", type: "ingreso", group: "Ingresos operacionales" },
  { code: "4210", name: "Rendimientos financieros", type: "ingreso", group: "Ingresos no operacionales" },
  { code: "4295", name: "Otros ingresos", type: "ingreso", group: "Ingresos no operacionales" },
  { code: "5105", name: "Nómina y personal", type: "gasto", group: "Gastos operacionales" },
  { code: "5110", name: "Honorarios y servicios", type: "gasto", group: "Gastos operacionales" },
  { code: "5120", name: "Arriendos", type: "gasto", group: "Gastos operacionales" },
  { code: "5135", name: "Servicios públicos e internet", type: "gasto", group: "Gastos operacionales" },
  { code: "5140", name: "Transporte y combustible", type: "gasto", group: "Gastos operacionales" },
  { code: "5145", name: "Mercado y alimentación", type: "gasto", group: "Gastos de vida" },
  { code: "5150", name: "Salud y seguros", type: "gasto", group: "Gastos de vida" },
  { code: "5155", name: "Educación", type: "gasto", group: "Gastos de vida" },
  { code: "5160", name: "Ocio y suscripciones", type: "gasto", group: "Gastos de vida" },
  { code: "5305", name: "Intereses y comisiones", type: "gasto", group: "Gastos financieros" },
  { code: "5395", name: "Impuestos y tasas", type: "gasto", group: "Gastos financieros" },
];

export const accountByCode = (code: string) =>
  CHART_OF_ACCOUNTS.find((a) => a.code === code);

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  gasto: "Gasto",
};

export const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const monthKey = (d: string) => d.slice(0, 7);

export interface Metrics {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  assets: number;
  liabilities: number;
  equity: number;
  debtRatio: number;
  liquidity: number;
  runwayMonths: number;
  expenseRatio: number;
}

export function computeMetrics(entries: Entry[]): Metrics {
  let income = 0,
    expense = 0,
    assets = 0,
    liabilities = 0,
    equity = 0,
    cash = 0,
    currentLiabilities = 0;

  for (const e of entries) {
    const acc = accountByCode(e.accountCode);
    if (!acc) continue;
    if (acc.type === "ingreso") income += e.amount;
    if (acc.type === "gasto") expense += e.amount;
    if (acc.type === "activo") {
      assets += e.amount;
      if (acc.group === "Activo corriente") cash += e.amount;
    }
    if (acc.type === "pasivo") {
      liabilities += e.amount;
      if (acc.group === "Pasivo corriente") currentLiabilities += e.amount;
    }
    if (acc.type === "patrimonio") equity += e.amount;
  }

  const net = income - expense;
  const months = new Set(entries.map((e) => monthKey(e.date))).size || 1;
  const monthlyExpense = expense / months;

  return {
    income,
    expense,
    net,
    savingsRate: income > 0 ? net / income : 0,
    assets: assets + Math.max(net, 0),
    liabilities,
    equity: equity + net,
    debtRatio: assets + net > 0 ? liabilities / (assets + Math.max(net, 0)) : 0,
    liquidity: currentLiabilities > 0 ? (cash + Math.max(net, 0)) / currentLiabilities : 0,
    runwayMonths: monthlyExpense > 0 ? (cash + Math.max(net, 0)) / monthlyExpense : 0,
    expenseRatio: income > 0 ? expense / income : 0,
  };
}

export interface Indicator {
  name: string;
  value: string;
  score: number; // 0-100
  hint: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function buildIndicators(m: Metrics): Indicator[] {
  return [
    {
      name: "Tasa de ahorro",
      value: `${(m.savingsRate * 100).toFixed(1)}%`,
      score: clamp((m.savingsRate / 0.2) * 100),
      hint: "Meta saludable: ahorrar al menos el 20% de los ingresos.",
    },
    {
      name: "Razón corriente (liquidez)",
      value: m.liquidity ? m.liquidity.toFixed(2) : "—",
      score: clamp((m.liquidity / 1.5) * 100),
      hint: "Meta: 1.5 o más para cubrir obligaciones de corto plazo.",
    },
    {
      name: "Nivel de endeudamiento",
      value: `${(m.debtRatio * 100).toFixed(1)}%`,
      score: clamp(100 - (m.debtRatio / 0.5) * 100),
      hint: "Meta: mantener la deuda por debajo del 50% de los activos.",
    },
    {
      name: "Eficiencia del gasto",
      value: `${(m.expenseRatio * 100).toFixed(1)}%`,
      score: clamp(100 - (m.expenseRatio / 0.9) * 100),
      hint: "Meta: gastar menos del 90% de lo que ingresa.",
    },
    {
      name: "Fondo de maniobra (meses)",
      value: m.runwayMonths ? m.runwayMonths.toFixed(1) : "—",
      score: clamp((m.runwayMonths / 6) * 100),
      hint: "Meta: 6 meses de gastos cubiertos con liquidez.",
    },
  ];
}

export function healthScore(indicators: Indicator[]) {
  if (!indicators.length) return 0;
  return Math.round(indicators.reduce((s, i) => s + i.score, 0) / indicators.length);
}

export function healthLabel(score: number) {
  if (score >= 80) return "Sólida";
  if (score >= 60) return "Estable";
  if (score >= 40) return "En observación";
  return "En riesgo";
}

export interface Recommendation {
  title: string;
  detail: string;
  level: "critico" | "atencion" | "bien";
  scope: Scope | "ambos";
}

export function buildRecommendations(
  entries: Entry[],
  personal: Metrics,
  business: Metrics,
): Recommendation[] {
  const recs: Recommendation[] = [];

  const push = (r: Recommendation) => recs.push(r);

  if (personal.savingsRate < 0.1) {
    push({
      title: "Aumenta tu tasa de ahorro personal",
      detail:
        "Estás ahorrando menos del 10%. Aplica la regla 50/30/20: 50% necesidades, 30% estilo de vida y 20% ahorro e inversión automatizada el mismo día que recibes ingresos.",
      level: "critico",
      scope: "personal",
    });
  } else if (personal.savingsRate < 0.2) {
    push({
      title: "Estás cerca de la meta de ahorro",
      detail:
        "Sube 2 puntos porcentuales tu ahorro recortando gastos de ocio y suscripciones; eso te acerca al 20% recomendado.",
      level: "atencion",
      scope: "personal",
    });
  } else {
    push({
      title: "Ahorro personal saludable",
      detail:
        "Mantén el hábito y destina el excedente a un portafolio diversificado antes que a mayor gasto corriente.",
      level: "bien",
      scope: "personal",
    });
  }

  if (personal.runwayMonths < 3) {
    push({
      title: "Construye tu fondo de emergencia",
      detail:
        "Tienes menos de 3 meses de gastos cubiertos. Prioriza llegar a 6 meses en una cuenta líquida y separada antes de nuevas inversiones.",
      level: "critico",
      scope: "personal",
    });
  }

  if (business.expenseRatio > 0.9 && business.income > 0) {
    push({
      title: "Margen operativo comprimido en el negocio",
      detail:
        "Los gastos consumen más del 90% de los ingresos. Revisa costos fijos (arriendo, nómina, servicios) y renegocia con proveedores o ajusta precios.",
      level: "critico",
      scope: "negocio",
    });
  } else if (business.income > 0) {
    push({
      title: "Presupuesto de negocio bajo control",
      detail:
        "Fija un presupuesto por categoría con tope mensual y revísalo cada cierre para sostener el margen actual.",
      level: "bien",
      scope: "negocio",
    });
  }

  if (business.debtRatio > 0.5) {
    push({
      title: "Endeudamiento del negocio elevado",
      detail:
        "La deuda supera el 50% de los activos. Prioriza amortizar pasivos de corto plazo con mayor tasa y evita nuevo crédito de consumo.",
      level: "atencion",
      scope: "negocio",
    });
  }

  const byAccount = new Map<string, number>();
  entries
    .filter((e) => accountByCode(e.accountCode)?.type === "gasto")
    .forEach((e) => byAccount.set(e.accountCode, (byAccount.get(e.accountCode) ?? 0) + e.amount));
  const totalExp = [...byAccount.values()].reduce((a, b) => a + b, 0);
  const top = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && totalExp > 0 && top[1] / totalExp > 0.35) {
    push({
      title: `Concentración de gasto en ${accountByCode(top[0])?.name}`,
      detail: `Esta cuenta representa el ${((top[1] / totalExp) * 100).toFixed(0)}% del gasto total. Fija un tope mensual y busca alternativas para reducirlo al menos un 10%.`,
      level: "atencion",
      scope: "ambos",
    });
  }

  push({
    title: "Separa las finanzas personales de las del negocio",
    detail:
      "Mantén cuentas y tarjetas independientes y asígnate un salario fijo desde el negocio; eso hace confiables tus indicadores y tu declaración tributaria.",
    level: "bien",
    scope: "ambos",
  });

  return recs;
}

