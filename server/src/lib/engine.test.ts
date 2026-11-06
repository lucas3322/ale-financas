import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOccurrences, cardInvoiceShift, cardUsage, type TxWithRefs } from "./engine.js";
import { parseMonth } from "./months.js";

const card = { id: "c1", groupId: "g", ownerId: null, name: "Nubank", limitCents: 500000, closingDay: 25, dueDay: 5, color: "#8A05BE", archived: false, createdAt: new Date() };

function tx(p: Partial<TxWithRefs>): TxWithRefs {
  return {
    id: Math.random().toString(36), groupId: "g", personId: null, createdById: "u", type: "EXPENSE", description: "x",
    categoryId: null, amountMode: "FIXED", amountCents: 0, percentBp: null, percentBase: null, paymentMethod: "PIX",
    cardId: null, date: new Date("2026-11-10T00:00:00Z"), recurrence: "ONCE", totalMonths: null, installmentStart: 1,
    isSalary: false, notes: null, createdAt: new Date(), updatedAt: new Date(), card: null, category: null, person: null, ...p,
  } as TxWithRefs;
}

test("compra antes do fechamento cai na fatura do mês seguinte (vence dia 5)", () => {
  assert.equal(cardInvoiceShift(new Date("2026-11-10T00:00:00Z"), card), 1);
  assert.equal(cardInvoiceShift(new Date("2026-11-26T00:00:00Z"), card), 2);
});

test("dízimo 10% acompanha o salário da pessoa, inclusive com ajuste no mês", () => {
  const salary = tx({ type: "INCOME", personId: "lucas", amountCents: 1500000, recurrence: "MONTHLY", isSalary: true, paymentMethod: null });
  const dizimo = tx({ personId: "lucas", amountMode: "PERCENT", percentBp: 1000, percentBase: "PERSON_INCOME", recurrence: "MONTHLY" });
  const states = [{ id: "s", transactionId: salary.id, month: "2026-12", paid: false, paidAt: null, amountCents: 2000000, skipped: false }];
  const occs = buildOccurrences([salary, dizimo], states, parseMonth("2026-11"), parseMonth("2026-12"));
  const d = occs.filter((o) => o.transactionId === dizimo.id).map((o) => o.amountCents);
  assert.deepEqual(d, [150000, 200000]);
});

test("parcelado 3/6 gera só as parcelas restantes", () => {
  const p = tx({ amountCents: 16675, recurrence: "INSTALLMENTS", totalMonths: 6, installmentStart: 3 });
  const occs = buildOccurrences([p], [], parseMonth("2026-01"), parseMonth("2027-12"));
  assert.deepEqual(occs.map((o) => o.installmentLabel), ["3/6", "4/6", "5/6", "6/6"]);
  assert.equal(occs[0].month, "2026-11");
});

test("compra parcelada compromete o limite inteiro no mês da compra", () => {
  const p = tx({ amountCents: 100000, paymentMethod: "CARD", cardId: "c1", card, recurrence: "INSTALLMENTS", totalMonths: 10 });
  const u = cardUsage(card, [p], [], parseMonth("2026-11"));
  assert.equal(u.committedCents, 1000000);
  assert.equal(u.invoiceCents, 0);
  const dez = cardUsage(card, [p], [{ id: "s", transactionId: p.id, month: "2026-12", paid: true, paidAt: null, amountCents: null, skipped: false }], parseMonth("2026-12"));
  assert.equal(dez.committedCents, 900000);
  assert.equal(dez.invoiceCents, 100000);
});
