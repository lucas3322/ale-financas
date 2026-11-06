import { z } from "zod";
import { loadGroup, occurrencesFor, type GroupData } from "./data.js";
import type { Occurrence } from "./engine.js";
import { currentMonthIdx, formatMonth, parseMonth } from "./months.js";

/**
 * Motor de consulta dos dashboards personalizados.
 * Uma consulta = medida (o quê) × dimensão (agrupar por) × dimensão opcional (quebrar por),
 * num período, com filtros. Funciona sobre as mesmas ocorrências do resto do app,
 * então recorrências, parcelas, fatura do cartão e percentuais já vêm resolvidos.
 */

export const DIMENSIONS = ["none", "month", "category", "subcategory", "person", "method", "card", "type", "recurrence", "status"] as const;
export const MEASURES = ["expense", "income", "net", "flow", "balance", "count"] as const;
export const PRESETS = [
  "selected", "this_month", "last_month", "last_3", "last_6", "last_12", "ytd", "next_3", "next_6", "next_12", "custom",
] as const;

const monthStr = z.string().regex(/^\d{4}-\d{2}$/);

export const querySchema = z.object({
  measure: z.enum(MEASURES).default("expense"),
  aggregate: z.enum(["sum", "monthlyAvg"]).default("sum"),
  groupBy: z.enum(DIMENSIONS).default("none"),
  splitBy: z.enum(DIMENSIONS).default("none"),
  range: z
    .object({ preset: z.enum(PRESETS).default("this_month"), from: monthStr.optional(), to: monthStr.optional() })
    .default({ preset: "this_month" }),
  filters: z
    .object({
      categoryIds: z.array(z.string()).max(50).optional(),
      personIds: z.array(z.string()).max(20).optional(), // "shared" = Casa
      methods: z.array(z.enum(["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"])).optional(),
      cardIds: z.array(z.string()).max(20).optional(),
      recurrence: z.array(z.enum(["ONCE", "MONTHLY", "INSTALLMENTS"])).optional(),
      status: z.enum(["all", "paid", "pending"]).default("all"),
      search: z.string().max(60).optional(),
    })
    .default({ status: "all" }),
  limit: z.number().int().min(1).max(50).default(8),
});

export type QuerySpec = z.infer<typeof querySchema>;

export interface QueryResult {
  range: { from: string; to: string; months: number };
  labels: { key: string; label: string; color?: string; icon?: string }[];
  series: { key: string; label: string; color?: string; icon?: string; values: number[] }[];
  total: number;
  previousTotal: number | null;
  count: number;
}

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix", BOLETO: "Boleto", CARD: "Cartão", DEBIT: "Débito", CASH: "Dinheiro", TRANSFER: "Transferência", none: "Não informado",
};
const METHOD_COLOR: Record<string, string> = {
  PIX: "#14B8A6", BOLETO: "#F59E0B", CARD: "#820AD1", DEBIT: "#3B82F6", CASH: "#22C55E", TRANSFER: "#6366F1", none: "#94A3B8",
};
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Paleta para pessoas/cartões sem cor própria — derivada do roxo da marca. */
const PALETTE = ["#820AD1", "#F59E0B", "#14B8A6", "#EC4899", "#3B82F6", "#22C55E", "#F97316", "#6366F1", "#EF4444", "#0EA5E9"];

export function resolveRange(r: QuerySpec["range"], selectedIdx: number): [number, number] {
  const now = currentMonthIdx();
  switch (r.preset) {
    case "selected": return [selectedIdx, selectedIdx];
    case "this_month": return [now, now];
    case "last_month": return [now - 1, now - 1];
    case "last_3": return [now - 2, now];
    case "last_6": return [now - 5, now];
    case "last_12": return [now - 11, now];
    case "ytd": return [now - (now % 12), now];
    case "next_3": return [now, now + 2];
    case "next_6": return [now, now + 5];
    case "next_12": return [now, now + 11];
    case "custom": {
      const a = r.from ? parseMonth(r.from) : now;
      const b = r.to ? parseMonth(r.to) : a;
      const [from, to] = a <= b ? [a, b] : [b, a];
      return [from, Math.min(to, from + 59)]; // máx. 5 anos por consulta
    }
  }
}

function monthLabel(idx: number) {
  return `${MONTHS[idx % 12]}/${String(Math.floor(idx / 12)).slice(2)}`;
}

/** Valor de uma ocorrência para a medida pedida (null = não entra na consulta). */
function valueOf(o: Occurrence, measure: QuerySpec["measure"]): number | null {
  const income = o.tx.type === "INCOME";
  switch (measure) {
    case "expense": return income ? null : o.amountCents;
    case "income": return income ? o.amountCents : null;
    case "net":
    case "balance": return income ? o.amountCents : -o.amountCents;
    case "flow": return o.amountCents;
    case "count": return 1;
  }
}

function dimKey(o: Occurrence, dim: (typeof DIMENSIONS)[number], data: GroupData): { key: string; label: string; color?: string; icon?: string } {
  const t = o.tx;
  switch (dim) {
    case "none": return { key: "all", label: "Total" };
    case "month": return { key: o.month, label: monthLabel(o.monthIdx) };
    case "category": {
      // Agrupa na categoria mãe: Netflix e Spotify somam em "Assinaturas e streaming".
      const c = t.category?.parent ?? t.category;
      return c
        ? { key: c.id, label: c.name, color: c.color, icon: c.icon }
        : { key: "none", label: "Sem categoria", color: "#94A3B8", icon: "ph:package-duotone" };
    }
    case "subcategory": {
      const c = t.category;
      if (!c) return { key: "none", label: "Sem categoria", color: "#94A3B8", icon: "ph:package-duotone" };
      return { key: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name, color: c.color, icon: c.icon };
    }
    case "person": {
      if (!t.personId) return { key: "shared", label: "🏠 Casa", color: "#94A3B8" };
      const i = data.members.findIndex((m) => m.id === t.personId);
      return { key: t.personId, label: data.members[i]?.name ?? "Ex-membro", color: PALETTE[Math.max(0, i) % PALETTE.length] };
    }
    case "method": {
      const m = t.paymentMethod ?? "none";
      return { key: m, label: METHOD_LABEL[m], color: METHOD_COLOR[m] };
    }
    case "card":
      return t.card && t.paymentMethod === "CARD"
        ? { key: t.card.id, label: `💳 ${t.card.name}`, color: t.card.color }
        : { key: "none", label: "Fora do cartão", color: "#94A3B8" };
    case "type":
      return income(o) ? { key: "INCOME", label: "Entradas", color: "#16A34A" } : { key: "EXPENSE", label: "Saídas", color: "#E11D48" };
    case "recurrence":
      return t.recurrence === "ONCE"
        ? { key: "ONCE", label: "Avulso", color: "#94A3B8" }
        : t.recurrence === "MONTHLY"
          ? { key: "MONTHLY", label: "Fixo mensal", color: "#820AD1" }
          : { key: "INSTALLMENTS", label: "Parcelado", color: "#F59E0B" };
    case "status":
      return o.paid ? { key: "paid", label: "Pago", color: "#16A34A" } : { key: "pending", label: "Pendente", color: "#F59E0B" };
  }
}
const income = (o: Occurrence) => o.tx.type === "INCOME";

function passes(o: Occurrence, f: QuerySpec["filters"]): boolean {
  const t = o.tx;
  // Filtrar pela categoria mãe inclui as subcategorias dela.
  if (f.categoryIds?.length && !f.categoryIds.includes(t.categoryId ?? "none") && !(t.category?.parentId && f.categoryIds.includes(t.category.parentId))) return false;
  if (f.personIds?.length && !f.personIds.includes(t.personId ?? "shared")) return false;
  if (f.methods?.length && (!t.paymentMethod || !f.methods.includes(t.paymentMethod))) return false;
  if (f.cardIds?.length && (!t.cardId || t.paymentMethod !== "CARD" || !f.cardIds.includes(t.cardId))) return false;
  if (f.recurrence?.length && !f.recurrence.includes(t.recurrence)) return false;
  if (f.status === "paid" && !o.paid) return false;
  if (f.status === "pending" && o.paid) return false;
  if (f.search && !t.description.toLowerCase().includes(f.search.toLowerCase())) return false;
  return true;
}

function aggregate(occs: Occurrence[], spec: QuerySpec, data: GroupData, from: number, to: number, initialBalance: number) {
  const months = to - from + 1;
  const rows: { g: ReturnType<typeof dimKey>; s: ReturnType<typeof dimKey>; v: number }[] = [];
  for (const o of occs) {
    if (!passes(o, spec.filters)) continue;
    const v = valueOf(o, spec.measure);
    if (v == null) continue;
    rows.push({ g: dimKey(o, spec.groupBy, data), s: dimKey(o, spec.splitBy, data), v });
  }

  // Rótulos: meses sempre completos (inclusive zerados); demais dimensões ordenadas pelo total.
  const groupTotals = new Map<string, { meta: ReturnType<typeof dimKey>; total: number }>();
  for (const r of rows) {
    const cur = groupTotals.get(r.g.key) ?? { meta: r.g, total: 0 };
    cur.total += r.v;
    groupTotals.set(r.g.key, cur);
  }
  let labels: QueryResult["labels"];
  let otherKeys = new Set<string>();
  if (spec.groupBy === "month") {
    labels = Array.from({ length: months }, (_, i) => ({ key: formatMonth(from + i), label: monthLabel(from + i) }));
  } else {
    const sorted = [...groupTotals.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    const top = sorted.slice(0, spec.limit);
    otherKeys = new Set(sorted.slice(spec.limit).map((x) => x.meta.key));
    labels = top.map((x) => x.meta);
    if (otherKeys.size) labels.push({ key: "__other", label: `Outros (${otherKeys.size})`, color: "#CBD5E1" });
  }
  const labelIndex = new Map(labels.map((l, i) => [l.key, i]));

  // Séries (quebrar por): até 8 + "Outros".
  const seriesTotals = new Map<string, { meta: ReturnType<typeof dimKey>; total: number }>();
  for (const r of rows) {
    const cur = seriesTotals.get(r.s.key) ?? { meta: r.s, total: 0 };
    cur.total += r.v;
    seriesTotals.set(r.s.key, cur);
  }
  const sortedSeries = spec.splitBy === "month"
    ? [...seriesTotals.values()].sort((a, b) => a.meta.key.localeCompare(b.meta.key))
    : [...seriesTotals.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const topSeries = sortedSeries.slice(0, 8);
  const otherSeries = new Set(sortedSeries.slice(8).map((x) => x.meta.key));
  const seriesMeta = topSeries.map((x) => x.meta);
  if (otherSeries.size) seriesMeta.push({ key: "__other", label: "Outros", color: "#CBD5E1" });
  if (!seriesMeta.length) seriesMeta.push(dimKey({} as Occurrence, "none", data));
  const seriesIndex = new Map(seriesMeta.map((s, i) => [s.key, i]));

  const matrix = seriesMeta.map(() => new Array<number>(labels.length).fill(0));
  for (const r of rows) {
    const li = labelIndex.get(otherKeys.has(r.g.key) ? "__other" : r.g.key);
    const si = seriesIndex.get(otherSeries.has(r.s.key) ? "__other" : r.s.key);
    if (li == null || si == null) continue;
    matrix[si][li] += r.v;
  }

  // Média mensal: divide pelo nº de meses do período (não faz sentido quando já agrupa por mês).
  if (spec.aggregate === "monthlyAvg" && spec.groupBy !== "month" && spec.measure !== "count") {
    for (const row of matrix) for (let i = 0; i < row.length; i++) row[i] = Math.round(row[i] / months);
  }

  // Saldo acumulado: só faz sentido na linha do tempo — soma corrida a partir do saldo inicial.
  if (spec.measure === "balance" && spec.groupBy === "month") {
    for (const row of matrix) {
      let acc = seriesMeta.length === 1 ? initialBalance : 0;
      for (let i = 0; i < row.length; i++) row[i] = acc += row[i];
    }
  }

  const total = spec.measure === "balance"
    ? (spec.groupBy === "month" ? matrix.reduce((s, row) => s + (row.at(-1) ?? 0), 0) : initialBalance + rows.reduce((s, r) => s + r.v, 0))
    : matrix.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);

  return {
    labels,
    series: seriesMeta.map((m, i) => ({ ...m, values: matrix[i] })),
    total,
    count: rows.length,
  };
}

export async function runQuery(groupId: string, spec: QuerySpec, selectedMonth: string | undefined, initialBalance: number, data?: GroupData) {
  const selectedIdx = selectedMonth ? parseMonth(selectedMonth) : currentMonthIdx();
  const [from, to] = resolveRange(spec.range, selectedIdx);
  const d = data ?? (await loadGroup(groupId));
  const occs = occurrencesFor(d, from, to);
  const main = aggregate(occs, spec, d, from, to, initialBalance);

  // Período anterior de mesmo tamanho, para o "vs. período anterior" dos KPIs.
  const len = to - from + 1;
  let previousTotal: number | null = null;
  if (spec.measure !== "balance") {
    const prev = aggregate(occurrencesFor(d, from - len, from - 1), { ...spec, groupBy: "none", splitBy: "none" }, d, from - len, from - 1, initialBalance);
    previousTotal = prev.total;
  }

  const result: QueryResult = {
    range: { from: formatMonth(from), to: formatMonth(to), months: len },
    ...main,
    previousTotal,
  };
  return result;
}
