import {
  ACCOUNT_TYPE_LABEL,
  accountByCode,
  formatMoney,
  computeMetrics,
  buildIndicators,
  healthLabel,
  healthScore,
  type Entry,
} from "./finance";

export interface ReportFilters {
  from: string;
  to: string;
  scope: "todos" | "personal" | "negocio";
  accountCodes: string[];
}

export function filterEntries(entries: Entry[], f: ReportFilters): Entry[] {
  return entries
    .filter((e) => (f.from ? e.date >= f.from : true))
    .filter((e) => (f.to ? e.date <= f.to : true))
    .filter((e) => (f.scope === "todos" ? true : e.scope === f.scope))
    .filter((e) => (f.accountCodes.length ? f.accountCodes.includes(e.accountCode) : true))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const fileStamp = () => new Date().toISOString().slice(0, 10);

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(entries: Entry[], f: ReportFilters) {
  const rows = filterEntries(entries, f);
  const m = computeMetrics(rows);
  const head = ["Fecha", "Descripcion", "Codigo", "Cuenta", "Tipo", "Grupo", "Ambito", "Monto"];
  const lines = [head.join(",")];

  for (const e of rows) {
    const acc = accountByCode(e.accountCode);
    lines.push(
      [
        e.date,
        e.description,
        e.accountCode,
        acc?.name ?? "",
        acc ? ACCOUNT_TYPE_LABEL[acc.type] : "",
        acc?.group ?? "",
        e.scope,
        e.amount,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  lines.push("");
  lines.push("Resumen del periodo");
  lines.push(["Ingresos", m.income].map(csvCell).join(","));
  lines.push(["Gastos", m.expense].map(csvCell).join(","));
  lines.push(["Resultado neto", m.net].map(csvCell).join(","));
  lines.push(["Activos", m.assets].map(csvCell).join(","));
  lines.push(["Pasivos", m.liabilities].map(csvCell).join(","));
  lines.push(["Patrimonio", m.equity].map(csvCell).join(","));
  lines.push(["Tasa de ahorro", `${(m.savingsRate * 100).toFixed(1)}%`].map(csvCell).join(","));

  download(
    new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `reporte-financiero-${fileStamp()}.csv`,
  );
  return rows.length;
}

export async function exportPdf(entries: Entry[], f: ReportFilters) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;

  const rows = filterEntries(entries, f);
  const m = computeMetrics(rows);
  const indicators = buildIndicators(m);
  const score = healthScore(indicators);

  const navy: [number, number, number] = [15, 42, 74];
  const gold: [number, number, number] = [201, 162, 39];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...navy);
  doc.rect(0, 0, w, 92, "F");
  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.text("CONSULTORIA FINANCIERA", 40, 34);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Reporte financiero", 40, 58);
  doc.setFontSize(9);
  const scopeLabel =
    f.scope === "todos" ? "Personal + negocio" : f.scope === "personal" ? "Personal" : "Negocio";
  doc.text(
    `Periodo: ${f.from || "inicio"} a ${f.to || "hoy"}  |  Ambito: ${scopeLabel}  |  Cuentas: ${
      f.accountCodes.length ? f.accountCodes.length + " seleccionadas" : "todas"
    }`,
    40,
    76,
  );

  autoTable(doc, {
    startY: 112,
    head: [["Indicador", "Valor"]],
    body: [
      ["Ingresos", formatMoney(m.income)],
      ["Gastos", formatMoney(m.expense)],
      ["Resultado neto", formatMoney(m.net)],
      ["Activos", formatMoney(m.assets)],
      ["Pasivos", formatMoney(m.liabilities)],
      ["Patrimonio", formatMoney(m.equity)],
      ["Tasa de ahorro", `${(m.savingsRate * 100).toFixed(1)}%`],
      ["Endeudamiento", `${(m.debtRatio * 100).toFixed(1)}%`],
      ["Salud financiera", `${score}/100 - ${healthLabel(score)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    head: [["Fecha", "Descripcion", "Cuenta NIIF", "Ambito", "Monto"]],
    body: rows.map((e) => {
      const acc = accountByCode(e.accountCode);
      return [
        e.date,
        e.description,
        `${e.accountCode} ${acc?.name ?? ""}`,
        e.scope,
        formatMoney(e.amount),
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 8, cellPadding: 4 },
    columnStyles: { 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generado el ${new Date().toLocaleDateString("es-CO")} - Pagina ${i} de ${pages}`,
      40,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  doc.save(`reporte-financiero-${fileStamp()}.pdf`);
  return rows.length;
}