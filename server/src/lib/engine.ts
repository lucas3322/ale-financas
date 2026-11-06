import type { Card, Category, Transaction, TxOccurrence, User } from "@prisma/client";
import { dateMonthIdx, formatMonth } from "./months.js";

/**
 * Motor de cálculo: transforma as definições de lançamentos (únicos, recorrentes,
 * parcelados, percentuais, no cartão) em ocorrências concretas por mês.
 */

export type TxWithRefs = Transaction & {
  card?: Card | null;
  category?: Category | null;
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

  // Resolve percentuais com base na renda do mês (pessoa ou grupo).
  const incomeByMonth = new Map<number, { group: number; byPerson: Map<string, number> }>();
  for (const o of out) {
    if (o.tx.type !== "INCOME" || o.skipped) continue;
    let agg = incomeByMonth.get(o.monthIdx);
    if (!agg) incomeByMonth.set(o.monthIdx, (agg = { group: 0, byPerson: new Map() }));
    agg.group += o.amountCents;
    if (o.tx.personId) agg.byPerson.set(o.tx.personId, (agg.byPerson.get(o.tx.personId) ?? 0) + o.amountCents);
  }
  for (const o of out) {
    if (o.tx.amountMode !== "PERCENT" || o.overridden) continue;
    // Percentual no cartão cai na fatura, mas a base é a renda do mês da cobrança.
    const agg = incomeByMonth.get(o.chargeMonthIdx);
    const base =
      o.tx.percentBase === "PERSON_INCOME" && o.tx.personId
        ? agg?.byPerson.get(o.tx.personId) ?? 0
        : agg?.group ?? 0;
    o.amountCents = Math.round((base * (o.tx.percentBp ?? 0)) / 10000);
  }

  const result = opts.includeSkipped ? out : out.filter((o) => !o.skipped);
  return result.sort((a, b) => a.monthIdx - b.monthIdx || a.day - b.day);
}

export interface CardUsage {
  committedCents: number;
  invoiceCents: number;
}

/**
 * Limite comprometido do cartão no mês de referência:
 * tudo que já foi comprado até esse mês e ainda não foi pago
 * (parcelas futuras inclusas — a compra parcelada ocupa o limite inteiro).
 */
export function cardUsage(card: Card, txs: TxWithRefs[], states: TxOccurrence[], refIdx: number): CardUsage {
  const cardTxs = txs.filter((t) => t.cardId === card.id && t.paymentMethod === "CARD" && t.type === "EXPENSE");
  // Horizonte longo o bastante para cobrir parcelamentos.
  const occs = buildOccurrences(cardTxs, states, refIdx - 2, refIdx + 72);
  let committed = 0;
  let invoice = 0;
  for (const o of occs) {
    if (o.monthIdx === refIdx) invoice += o.amountCents;
    if (o.paid) continue;
    if (o.chargeMonthIdx > refIdx && o.tx.recurrence !== "INSTALLMENTS") continue; // recorrência futura ainda não cobrada
    if (dateMonthIdx(o.tx.date) > refIdx) continue; // compra ainda não feita
    if (o.monthIdx < refIdx) continue; // fatura já vencida — tratada como página virada
    committed += o.amountCents;
  }
  return { committedCents: committed, invoiceCents: invoice };
}
