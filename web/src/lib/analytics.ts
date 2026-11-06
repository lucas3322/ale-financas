import type { PaymentMethod, Recurrence } from "./types";

export type Measure = "expense" | "income" | "net" | "flow" | "balance" | "count";
export type Dimension = "none" | "month" | "category" | "person" | "method" | "card" | "type" | "recurrence" | "status";
export type Preset =
  | "selected" | "this_month" | "last_month" | "last_3" | "last_6" | "last_12" | "ytd" | "next_3" | "next_6" | "next_12" | "custom";
export type Viz = "kpi" | "donut" | "pie" | "bar" | "barH" | "stacked" | "line" | "area" | "table" | "progress" | "cards" | "upcoming";
export type Size = "s" | "m" | "l" | "xl";
export type Tone = "red" | "amber" | "green";

export interface QuerySpec {
  measure: Measure;
  aggregate: "sum" | "monthlyAvg";
  groupBy: Dimension;
  splitBy: Dimension;
  range: { preset: Preset; from?: string; to?: string };
  filters: {
    categoryIds?: string[];
    personIds?: string[];
    methods?: PaymentMethod[];
    cardIds?: string[];
    recurrence?: Recurrence[];
    status: "all" | "paid" | "pending";
    search?: string;
  };
  limit: number;
}

export interface Condition { op: "gt" | "lt"; valueCents: number; tone: Tone }

export interface Widget {
  id: string;
  title: string;
  viz: Viz;
  size: Size;
  tall: boolean;
  query: QuerySpec;
  goalCents?: number | null;
  conditions: Condition[];
}

export interface DashboardDef {
  id: string;
  name: string;
  icon: string;
  position: number;
  widgets: Widget[];
}

export interface QueryResult {
  range: { from: string; to: string; months: number };
  labels: { key: string; label: string; color?: string }[];
  series: { key: string; label: string; color?: string; values: number[] }[];
  total: number;
  previousTotal: number | null;
  count: number;
}

export const MEASURES: { value: Measure; label: string; hint: string }[] = [
  { value: "expense", label: "Gastos", hint: "Soma das saídas" },
  { value: "income", label: "Entradas", hint: "Salários e outras entradas" },
  { value: "net", label: "Sobra", hint: "Entradas menos saídas" },
  { value: "flow", label: "Movimentação", hint: "Entradas e saídas, ambas positivas — ideal para comparar as duas" },
  { value: "balance", label: "Saldo acumulado", hint: "Sobra somada mês a mês, a partir do saldo inicial" },
  { value: "count", label: "Quantidade", hint: "Número de lançamentos" },
];

export const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "none", label: "Nada (total)" },
  { value: "month", label: "Mês" },
  { value: "category", label: "Categoria" },
  { value: "person", label: "Pessoa" },
  { value: "method", label: "Forma de pagamento" },
  { value: "card", label: "Cartão" },
  { value: "type", label: "Entrada × saída" },
  { value: "recurrence", label: "Avulso / fixo / parcelado" },
  { value: "status", label: "Pago × pendente" },
];

export const PRESETS: { value: Preset; label: string }[] = [
  { value: "selected", label: "Mês selecionado no topo" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_3", label: "Últimos 3 meses" },
  { value: "last_6", label: "Últimos 6 meses" },
  { value: "last_12", label: "Últimos 12 meses" },
  { value: "ytd", label: "Este ano até agora" },
  { value: "next_3", label: "Próximos 3 meses" },
  { value: "next_6", label: "Próximos 6 meses" },
  { value: "next_12", label: "Próximos 12 meses" },
  { value: "custom", label: "Personalizado…" },
];

export interface VizInfo {
  value: Viz;
  label: string;
  hint: string;
  /** Precisa de "agrupar por"? */
  needsGroup: boolean;
  /** Aceita "quebrar por" (cruzar duas dimensões)? */
  allowsSplit: boolean;
  /** Widget especial que não usa o motor de consulta */
  special?: boolean;
  defaultSize: Size;
}

export const VIZ: VizInfo[] = [
  { value: "kpi", label: "Número", hint: "Um valor em destaque com comparação", needsGroup: false, allowsSplit: false, defaultSize: "s" },
  { value: "donut", label: "Rosca", hint: "Partes de um todo", needsGroup: true, allowsSplit: false, defaultSize: "m" },
  { value: "pie", label: "Pizza", hint: "Partes de um todo", needsGroup: true, allowsSplit: false, defaultSize: "m" },
  { value: "bar", label: "Barras", hint: "Comparar valores", needsGroup: true, allowsSplit: true, defaultSize: "m" },
  { value: "barH", label: "Ranking", hint: "Do maior para o menor", needsGroup: true, allowsSplit: false, defaultSize: "m" },
  { value: "stacked", label: "Empilhado", hint: "Cruzar duas dimensões", needsGroup: true, allowsSplit: true, defaultSize: "l" },
  { value: "line", label: "Evolução", hint: "Como muda ao longo dos meses", needsGroup: true, allowsSplit: true, defaultSize: "l" },
  { value: "area", label: "Área", hint: "Evolução com volume", needsGroup: true, allowsSplit: true, defaultSize: "l" },
  { value: "table", label: "Tabela", hint: "Números exatos, cruzados", needsGroup: true, allowsSplit: true, defaultSize: "l" },
  { value: "progress", label: "Meta", hint: "Quanto já usou de um limite", needsGroup: false, allowsSplit: false, defaultSize: "s" },
  { value: "cards", label: "Cartões", hint: "Limite e fatura de cada cartão", needsGroup: false, allowsSplit: false, special: true, defaultSize: "m" },
  { value: "upcoming", label: "Contas a pagar", hint: "Pendências do mês selecionado", needsGroup: false, allowsSplit: false, special: true, defaultSize: "m" },
];
export const vizInfo = (v: Viz) => VIZ.find((x) => x.value === v)!;

export const SIZE_LABEL: Record<Size, string> = { s: "P", m: "M", l: "G", xl: "GG" };
/** Colunas ocupadas: 2 colunas no celular/tablet, 4 no desktop. Widgets P ficam lado a lado até no celular. */
export const SIZE_CLASS: Record<Size, string> = {
  s: "col-span-1",
  m: "col-span-2",
  l: "col-span-2 lg:col-span-3",
  xl: "col-span-2 lg:col-span-4",
};

export const TONE_CLASS: Record<Tone, { text: string; ring: string; dot: string; label: string }> = {
  red: { text: "text-rose-600", ring: "ring-rose-300/70", dot: "bg-rose-500", label: "Vermelho" },
  amber: { text: "text-amber-600", ring: "ring-amber-300/70", dot: "bg-amber-500", label: "Amarelo" },
  green: { text: "text-emerald-600", ring: "ring-emerald-300/70", dot: "bg-emerald-500", label: "Verde" },
};

export function toneFor(w: Widget, total: number): Tone | null {
  for (const c of w.conditions) {
    if ((c.op === "gt" && total > c.valueCents) || (c.op === "lt" && total < c.valueCents)) return c.tone;
  }
  return null;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function baseQuery(partial: Partial<QuerySpec> = {}): QuerySpec {
  return {
    measure: "expense",
    aggregate: "sum",
    groupBy: "none",
    splitBy: "none",
    range: { preset: "selected" },
    filters: { status: "all" },
    limit: 8,
    ...partial,
  };
}

function w(viz: Viz, title: string, query: Partial<QuerySpec>, extra: Partial<Widget> = {}): Widget {
  return { id: newId(), title, viz, size: vizInfo(viz).defaultSize, tall: false, query: baseQuery(query), conditions: [], ...extra };
}

/** Título sugerido a partir da configuração (a pessoa pode trocar). */
export function suggestTitle(viz: Viz, q: QuerySpec) {
  if (viz === "cards") return "Limite dos cartões";
  if (viz === "upcoming") return "Contas a pagar";
  const m = MEASURES.find((x) => x.value === q.measure)!.label;
  const g = q.groupBy !== "none" ? ` por ${DIMENSIONS.find((x) => x.value === q.groupBy)!.label.toLowerCase()}` : "";
  const s = q.splitBy !== "none" && vizInfo(viz).allowsSplit ? ` × ${DIMENSIONS.find((x) => x.value === q.splitBy)!.label.toLowerCase()}` : "";
  return `${m}${g}${s}`;
}

export const TEMPLATES: { key: string; name: string; icon: string; description: string; build: () => Widget[] }[] = [
  {
    key: "overview",
    name: "Visão geral",
    icon: "✨",
    description: "Sobra, gastos, metas, categorias e o saldo do ano",
    build: () => [
      w("kpi", "Sobra do mês", { measure: "net" }, { conditions: [{ op: "lt", valueCents: 0, tone: "red" }] }),
      w("kpi", "Gastos do mês", { measure: "expense" }),
      w("kpi", "Entradas do mês", { measure: "income" }),
      w("progress", "Limite de gastos do mês", { measure: "expense" }, { goalCents: 800_000 }),
      w("donut", "Gastos por categoria", { measure: "expense", groupBy: "category" }),
      w("cards", "Limite dos cartões", {}),
      w("area", "Saldo acumulado — próximos 12 meses", { measure: "balance", groupBy: "month", range: { preset: "next_12" } }, { size: "xl" }),
      w("stacked", "Gastos por mês e categoria", { measure: "expense", groupBy: "month", splitBy: "category", range: { preset: "next_6" }, limit: 6 }, { size: "xl" }),
      w("upcoming", "Contas a pagar", {}),
    ],
  },
  {
    key: "cards",
    name: "Cartões",
    icon: "💳",
    description: "Fatura, limite e onde o cartão está sendo usado",
    build: () => [
      w("kpi", "Fatura do mês", { measure: "expense", filters: { status: "all", methods: ["CARD"] } }),
      w("kpi", "Fatura média — 6 meses", { measure: "expense", aggregate: "monthlyAvg", range: { preset: "next_6" }, filters: { status: "all", methods: ["CARD"] } }),
      w("cards", "Limite dos cartões", {}),
      w("bar", "Faturas por mês e cartão", { measure: "expense", groupBy: "month", splitBy: "card", range: { preset: "next_6" }, filters: { status: "all", methods: ["CARD"] } }, { size: "l" }),
      w("barH", "No cartão, por categoria", { measure: "expense", groupBy: "category", filters: { status: "all", methods: ["CARD"] } }),
    ],
  },
  {
    key: "couple",
    name: "Casal",
    icon: "💜",
    description: "Quem ganha, quem gasta e a sobra de cada um",
    build: () => [
      w("bar", "Entradas × saídas por pessoa", { measure: "flow", groupBy: "person", splitBy: "type" }, { size: "m" }),
      w("donut", "Gastos por pessoa", { measure: "expense", groupBy: "person" }),
      w("line", "Sobra de cada um — 6 meses", { measure: "net", groupBy: "month", splitBy: "person", range: { preset: "next_6" } }, { size: "xl" }),
      w("table", "Pessoa × forma de pagamento", { measure: "expense", groupBy: "person", splitBy: "method" }, { size: "xl" }),
    ],
  },
];
