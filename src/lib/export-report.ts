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

export async function exportXlsx(entries: Entry[], f: ReportFilters) {
  const ExcelJS = (await import("exceljs")).default;

  const rows = filterEntries(entries, f);
  const m = computeMetrics(rows);
  const indicators = buildIndicators(m);
  const score = healthScore(indicators);

  const NAVY = "FF0F2A4A";
  const GOLD = "FFC9A227";
  const money = '"$"#,##0;("$"#,##0);-';

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tracker financiero";
  wb.created = new Date();

  const styleHeader = (row: import("exceljs").Row) => {
    row.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    row.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.alignment = { vertical: "middle" };
    });
    row.height = 20;
  };

  // --- Hoja: Movimientos
  const ws = wb.addWorksheet("Movimientos", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.mergeCells("A1:H1");
  const title = ws.getCell("A1");
  title.value = "Reporte financiero — Movimientos";
  title.font = { name: "Arial", bold: true, size: 14, color: { argb: NAVY } };
  ws.mergeCells("A2:H2");
  const scopeLabel =
    f.scope === "todos" ? "Personal + negocio" : f.scope === "personal" ? "Personal" : "Negocio";
  ws.getCell("A2").value = `Período: ${f.from || "inicio"} a ${f.to || "hoy"} | Ámbito: ${scopeLabel} | Cuentas: ${
    f.accountCodes.length ? `${f.accountCodes.length} seleccionadas` : "todas"
  }`;
  ws.getCell("A2").font = { name: "Arial", size: 9, color: { argb: "FF666666" } };

  ws.getRow(3).values = [
    "Fecha",
    "Descripción",
    "Código",
    "Cuenta NIIF",
    "Tipo",
    "Grupo",
    "Ámbito",
    "Monto",
  ];
  styleHeader(ws.getRow(3));
  ws.columns = [
    { key: "date", width: 12 },
    { key: "description", width: 32 },
    { key: "code", width: 10 },
    { key: "account", width: 30 },
    { key: "type", width: 13 },
    { key: "group", width: 26 },
    { key: "scope", width: 12 },
    { key: "amount", width: 16 },
  ];

  for (const e of rows) {
    const acc = accountByCode(e.accountCode);
    const r = ws.addRow([
      e.date,
      e.description,
      e.accountCode,
      acc?.name ?? "",
      acc ? ACCOUNT_TYPE_LABEL[acc.type] : "",
      acc?.group ?? "",
      e.scope,
      e.amount,
    ]);
    r.font = { name: "Arial", size: 10 };
    r.getCell(8).numFmt = money;
  }

  const first = 4;
  const last = 3 + rows.length;
  const totalRow = ws.addRow([
    "",
    "Total movimientos",
    "",
    "",
    "",
    "",
    "",
    rows.length ? { formula: `SUM(H${first}:H${last})` } : 0,
  ]);
  totalRow.font = { name: "Arial", bold: true, size: 10 };
  totalRow.getCell(8).numFmt = money;
  if (rows.length) ws.autoFilter = { from: "A3", to: `H${last}` };

  // --- Hoja: Resumen (fórmulas contra Movimientos)
  const sum = wb.addWorksheet("Resumen");
  sum.columns = [{ width: 34 }, { width: 20 }, { width: 44 }];
  sum.mergeCells("A1:C1");
  sum.getCell("A1").value = "Resumen e indicadores del período";
  sum.getCell("A1").font = { name: "Arial", bold: true, size: 14, color: { argb: NAVY } };

  sum.getRow(3).values = ["Concepto", "Valor", "Referencia"];
  styleHeader(sum.getRow(3));

  const range = rows.length ? `Movimientos!$H$${first}:$H$${last}` : "";
  const typeRange = rows.length ? `Movimientos!$E$${first}:$E$${last}` : "";
  const byType = (label: string) =>
    rows.length ? { formula: `SUMIF(${typeRange},"${label}",${range})` } : 0;

  const addRow = (label: string, value: unknown, note: string, fmt?: string) => {
    const r = sum.addRow([label, value, note]);
    r.font = { name: "Arial", size: 10 };
    if (fmt) r.getCell(2).numFmt = fmt;
    r.getCell(3).font = { name: "Arial", size: 9, color: { argb: "FF666666" } };
    return r;
  };

  addRow("Ingresos", byType("Ingreso"), "Suma de cuentas grupo 4", money);
  addRow("Gastos", byType("Gasto"), "Suma de cuentas grupo 5", money);
  const netRow = sum.rowCount + 1;
  addRow("Resultado neto", { formula: `B${netRow - 2}-B${netRow - 1}` }, "Ingresos - gastos", money);
  addRow("Activos", byType("Activo"), "Cuentas grupo 1", money);
  addRow("Pasivos", byType("Pasivo"), "Cuentas grupo 2", money);
  addRow("Patrimonio", byType("Patrimonio"), "Cuentas grupo 3", money);
  const savings = sum.rowCount + 1;
  addRow(
    "Tasa de ahorro",
    { formula: `IF(B${netRow - 2}=0,0,B${netRow}/B${netRow - 2})` },
    "Meta saludable: 20%",
    "0.0%",
  );
  void savings;
  addRow("Endeudamiento", m.debtRatio, "Meta: por debajo del 50%", "0.0%");
  addRow("Razón corriente", m.liquidity, "Meta: 1.5 o más", "0.00");
  addRow("Cobertura (meses)", m.runwayMonths, "Meta: 6 meses de gastos", "0.0");
  addRow("Salud financiera", `${score}/100 — ${healthLabel(score)}`, "Promedio de indicadores");

  sum.addRow([]);
  const indHead = sum.addRow(["Indicador", "Valor", "Recomendación"]);
  styleHeader(indHead);
  for (const i of indicators) {
    const r = sum.addRow([i.name, i.value, i.hint]);
    r.font = { name: "Arial", size: 10 };
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).font = { name: "Arial", size: 9, color: { argb: "FF666666" } };
  }

  // --- Hoja: Plan de cuentas con saldos del período
  const plan = wb.addWorksheet("Plan de cuentas");
  plan.columns = [{ width: 10 }, { width: 32 }, { width: 14 }, { width: 26 }, { width: 16 }];
  plan.mergeCells("A1:E1");
  plan.getCell("A1").value = "Plan de cuentas NIIF — saldos del período";
  plan.getCell("A1").font = { name: "Arial", bold: true, size: 14, color: { argb: NAVY } };
  plan.getRow(3).values = ["Código", "Cuenta", "Tipo", "Grupo", "Saldo"];
  styleHeader(plan.getRow(3));

  const balances = new Map<string, number>();
  for (const e of rows) balances.set(e.accountCode, (balances.get(e.accountCode) ?? 0) + e.amount);
  const selected = f.accountCodes.length
    ? CHART_OF_ACCOUNTS.filter((a) => f.accountCodes.includes(a.code))
    : CHART_OF_ACCOUNTS;
  for (const a of selected) {
    const r = plan.addRow([
      a.code,
      a.name,
      ACCOUNT_TYPE_LABEL[a.type],
      a.group,
      balances.get(a.code) ?? 0,
    ]);
    r.font = { name: "Arial", size: 10 };
    r.getCell(5).numFmt = money;
    if ((balances.get(a.code) ?? 0) > 0) r.getCell(5).font = { name: "Arial", size: 10, bold: true };
  }
  const planLast = plan.rowCount;
  const planTotal = plan.addRow([
    "",
    "Total",
    "",
    "",
    { formula: `SUM(E4:E${planLast})` },
  ]);
  planTotal.font = { name: "Arial", bold: true, size: 10 };
  planTotal.getCell(5).numFmt = money;
  planTotal.getCell(2).font = { name: "Arial", bold: true, size: 10, color: { argb: GOLD } };

  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `reporte-financiero-${fileStamp()}.xlsx`,
  );
  return rows.length;
}