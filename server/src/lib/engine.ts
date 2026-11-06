import type { Card, Category, Transaction, TxOccurrence, User } from "@prisma/client";
import { dateInMonth, dateMonthIdx, formatMonth } from "./months.js";

/**
 * Motor de cálculo: transforma as definições de lançamentos (únicos, recorrentes,
 * parcelados, percentuais, no cartão) em ocorrências concretas por mês.
 */

export type TxWithRefs = Transaction & {
  card?: Card | null;
  category?: (Category & { parent?: Category | null }) | null;
  person?: Pick<User, "id" | "name"> | null;
};

export interface Occurrence {
  transactionId: string;
  month: string;
  monthIdx: number;
  /** Mês em que a compra/cobrança acontece (antes do deslocamento da fatura) */
  chargeMonthIdx: number;
  /** Dia de vencimento/recebimento no mês */
  day: number;
  /** Data efetiva no calendário ("YYYY-MM-DD"): quando o dinheiro entra/sai */
  dueDate: string;
  /** Ex.: "3/6" para parcelado */
  installmentLabel: string | null;
  installmentNo: number | null;
  amountCents: number;
  overridden: boolean;
  paid: boolean;
  skipped: boolean;
  tx: TxWithRefs;
}

/**
 * Mês da fatura em que uma compra no cartão cai (mês do vencimento).
 * Compra depois do fechamento entra na fatura seguinte.
 */
export function cardInvoiceShift(date: Date, card: Pick<Card, "closingDay" | "dueDay">): number {
  const closesNextMonth = date.getUTCDate() > card.closingDay ? 1 : 0;
  const dueAfterClosingMonth = card.dueDay <= card.closingDay ? 1 : 0;
  return closesNextMonth + dueAfterClosingMonth;
}

function usesCard(tx: TxWithRefs): tx is TxWithRefs & { card: Card } {
  return tx.type === "EXPENSE" && tx.paymentMethod === "CARD" && !!tx.card;
}

interface Slot {
  monthIdx: number;
  chargeMonthIdx: number;
  installmentNo: number | null;
}

/** Lista os meses (índices) em que a transação gera ocorrência, dentro de [from, to]. */
export function expandSlots(tx: TxWithRefs, from: number, to: number): Slot[] {
  const chargeStart = dateMonthIdx(tx.date);
  const shift = usesCard(tx) ? cardInvoiceShift(tx.date, tx.card) : 0;
  const start = chargeStart + shift;

  let count: number;
  if (tx.recurrence === "ONCE") count = 1;
  else if (tx.recurrence === "INSTALLMENTS") count = Math.max(1, (tx.totalMonths ?? 1) - tx.installmentStart + 1);
  else count = tx.totalMonths ?? Number.POSITIVE_INFINITY;

  const slots: Slot[] = [];
  const firstK = Math.max(0, from - start);
  const lastK = Math.min(count - 1, to - start);
  for (let k = firstK; k <= lastK; k++) {
    slots.push({
      monthIdx: start + k,
      chargeMonthIdx: chargeStart + k,
      installmentNo: tx.recurrence === "INSTALLMENTS" ? tx.installmentStart + k : null,
    });
  }
  return slots;
}

/**
 * Gera as ocorrências de todas as transações entre os meses `from` e `to` (inclusive),
 * resolvendo valores percentuais (ex.: dízimo = 10% da renda do mês).
 */
export function buildOccurrences(
  txs: TxWithRefs[],
  states: TxOccurrence[],
  from: number,
  to: number,
  opts: { includeSkipped?: boolean } = {},
): Occurrence[] {
  const stateMap = new Map(states.map((s) => [`${s.transactionId}|${s.month}`, s]));
  const out: Occurrence[] = [];

  for (const tx of txs) {
    for (const slot of expandSlots(tx, from, to)) {
      const month = formatMonth(slot.monthIdx);
      const st = stateMap.get(`${tx.id}|${month}`);
      const day = usesCard(tx) ? tx.card.dueDay : tx.date.getUTCDate();
      out.push({
        transactionId: tx.id,
        month,
        monthIdx: slot.monthIdx,
        chargeMonthIdx: slot.chargeMonthIdx,
        day,
        dueDate: dateInMonth(slot.monthIdx, day),
        installmentNo: slot.installmentNo,
        installmentLabel: slot.installmentNo ? `${slot.installmentNo}/${tx.totalMonths}` : null,
        amountCents: st?.amountCents ?? (tx.amountMode === "FIXED" ? tx.amountCents : 0),
        overridden: st?.amountCents != null,
        paid: st?.paid ?? false,
        skipped: st?.skipped ?? false,
        tx,
      });
    }
  }

  // Resolve percentuais (ex.: dízimo) sobre a base escolhida, no mês da cobrança.
  type Agg = { all: number; salary: number; byPerson: Map<string, { all: number; salary: number }>; byTx: Map<string, number> };
  const incomeByMonth = new Map<number, Agg>();
  for (const o of out) {
    if (o.tx.type !== "INCOME" || o.skipped) continue;
    let agg = incomeByMonth.get(o.monthIdx);
    if (!agg) incomeByMonth.set(o.monthIdx, (agg = { all: 0, salary: 0, byPerson: new Map(), byTx: new Map() }));
    const v = o.amountCents;
    agg.all += v;
    if (o.tx.isSalary) agg.salary += v;
    // Chave pela série: depois de "alterar a partir deste mês", a parte nova soma na mesma base.
    const key = o.tx.seriesId ?? o.tx.id;
    agg.byTx.set(key, (agg.byTx.get(key) ?? 0) + v);
    if (o.tx.personId) {
      const p = agg.byPerson.get(o.tx.personId) ?? { all: 0, salary: 0 };
      p.all += v;
      if (o.tx.isSalary) p.salary += v;
      agg.byPerson.set(o.tx.personId, p);
    }
  }
  const seriesOf = new Map(txs.map((t) => [t.id, t.seriesId ?? t.id]));
  for (const o of out) {
    if (o.tx.amountMode !== "PERCENT" || o.overridden) continue;
    o.amountCents = Math.round((percentBaseFor(o.tx, incomeByMonth.get(o.chargeMonthIdx), seriesOf) * (o.tx.percentBp ?? 0)) / 10000);
  }

  const result = opts.includeSkipped ? out : out.filter((o) => !o.skipped);
  return result.sort((a, b) => a.monthIdx - b.monthIdx || a.day - b.day);
}

/**
 * Já aconteceu? Conta no "saldo até hoje" quem já foi pago/recebido
 * ou cuja data já chegou. Pagamento agendado para o futuro só entra quando a data chegar.
 */
export function isRealized(o: Pick<Occurrence, "paid" | "dueDate">, today: string) {
  return o.paid || o.dueDate <= today;
}

/** Valor-base do percentual num mês. Sem pessoa definida, "da pessoa" vira "do grupo". */
function percentBaseFor(
  tx: Transaction,
  agg: { all: number; salary: number; byPerson: Map<string, { all: number; salary: number }>; byTx: Map<string, number> } | undefined,
  seriesOf: Map<string, string>,
): number {
  if (!agg) return 0;
  const person = tx.personId ? agg.byPerson.get(tx.personId) : undefined;
  switch (tx.percentBase) {
    case "TRANSACTION":
      return tx.percentBaseTxId ? agg.byTx.get(seriesOf.get(tx.percentBaseTxId) ?? tx.percentBaseTxId) ?? 0 : 0;
    case "PERSON_SALARY":
      return tx.personId ? person?.salary ?? 0 : agg.salary;
    case "GROUP_SALARY":
      return agg.salary;
    case "PERSON_INCOME":
      return tx.personId ? person?.all ?? 0 : agg.all;
    case "GROUP_INCOME":
    default:
      return agg.all;
  }
}

export interface CardUsage {
  committedCents: number;
  invoiceCents: number;
  /** Próximas faturas (meses depois do de referência) com valor, em ordem */
  nextInvoices: { month: string; cents: number; count: number }[];
}

/**
 * Limite comprometido do cartão no mês de referência:
 * tudo que já foi comprado até esse mês e ainda não foi pago
 * (parcelas futuras inclusas — a compra parcelada ocupa o limite inteiro).
 */
export function cardUsage(card: Card, txs: TxWithRefs[], states: TxOccurrence[], refIdx: number): CardUsage {
  const cardTxIds = new Set(txs.filter((t) => t.cardId === card.id && t.paymentMethod === "CARD" && t.type === "EXPENSE").map((t) => t.id));
  if (!cardTxIds.size) return { committedCents: 0, invoiceCents: 0, nextInvoices: [] };
  // Calcula com todas as transações (percentuais no cartão precisam das entradas do mês) e depois filtra o cartão.
  // Horizonte longo o bastante para cobrir parcelamentos.
  const occs = buildOccurrences(txs, states, refIdx - 2, refIdx + 72).filter((o) => cardTxIds.has(o.transactionId));
  let committed = 0;
  let invoice = 0;
  const next = new Map<number, { cents: number; count: number }>();
  for (const o of occs) {
    if (o.monthIdx === refIdx) invoice += o.amountCents;
    // Próximas faturas: valor previsto de cada fatura (parcelas + recorrentes como mercado/assinaturas),
    // o mesmo que a fatura mostrará quando chegar o mês.
    if (o.monthIdx > refIdx && o.monthIdx <= refIdx + 12) {
      const cur = next.get(o.monthIdx) ?? { cents: 0, count: 0 };
      cur.cents += o.amountCents;
      cur.count += 1;
      next.set(o.monthIdx, cur);
    }
    if (o.paid) continue;
    if (o.chargeMonthIdx > refIdx && o.tx.recurrence !== "INSTALLMENTS") continue; // recorrência futura ainda não cobrada
    if (dateMonthIdx(o.tx.date) > refIdx) continue; // compra ainda não feita
    if (o.monthIdx < refIdx) continue; // fatura já vencida — tratada como página virada
    committed += o.amountCents;
  }
  return {
    committedCents: committed,
    invoiceCents: invoice,
    nextInvoices: [...next.entries()]
      .filter(([, v]) => v.cents > 0)
      .sort(([a], [b]) => a - b)
      .slice(0, 6)
      .map(([m, v]) => ({ month: formatMonth(m), ...v })),
  };
}
