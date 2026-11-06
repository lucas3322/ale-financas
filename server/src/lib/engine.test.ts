import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOccurrences, cardInvoiceShift, cardUsage, isRealized, type TxWithRefs } from "./engine.js";
import { parseMonth } from "./months.js";

const card = { id: "c1", groupId: "g", ownerId: null, name: "Nubank", limitCents: 500000, closingDay: 25, dueDay: 5, color: "#8A05BE", archived: false, createdAt: new Date() };

function tx(p: Partial<TxWithRefs>): TxWithRefs {
  return {
    id: Math.random().toString(36), groupId: "g", personId: null, createdById: "u", type: "EXPENSE", description: "x",
    categoryId: null, amountMode: "FIXED", amountCents: 0, percentBp: null, percentBase: null, paymentMethod: "PIX",
    cardId: null, date: new Date("2026-11-10T00:00:00Z"), recurrence: "ONCE", totalMonths: null, installmentStart: 1,
    isSalary: false, notes: null, percentBaseTxId: null, seriesId: null, createdAt: new Date(), updatedAt: new Date(), card: null, category: null, person: null, ...p,
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

test("compra de novembro num cartão que fecha 28 e vence 10 aparece na próxima fatura (dezembro)", () => {
  const mais = { ...card, id: "c2", closingDay: 28, dueDay: 10 };
  const p = tx({ amountCents: 54992, paymentMethod: "CARD", cardId: "c2", card: mais, date: new Date("2026-11-05T00:00:00Z") });
  const u = cardUsage(mais, [p], [], parseMonth("2026-11"));
  assert.equal(u.invoiceCents, 0);
  assert.equal(u.committedCents, 54992);
  assert.deepEqual(u.nextInvoices, [{ month: "2026-12", cents: 54992, count: 1 }]);
});

test("saldo realizado conta só o que foi marcado como pago/recebido", () => {
  const conta = tx({ amountCents: 30000, date: new Date("2026-11-20T00:00:00Z") });
  const [o] = buildOccurrences([conta], [], parseMonth("2026-11"), parseMonth("2026-11"));
  assert.equal(o.dueDate, "2026-11-20");
  assert.equal(isRealized(o), false); // não marcado: não conta, mesmo com a data passando
  assert.equal(isRealized({ ...o, paid: true }), true); // marcado como pago: conta
});

test("vencimento dia 31 em fevereiro cai no último dia do mês", () => {
  const conta = tx({ amountCents: 1000, recurrence: "MONTHLY", date: new Date("2027-01-31T00:00:00Z") });
  const occs = buildOccurrences([conta], [], parseMonth("2027-02"), parseMonth("2027-02"));
  assert.equal(occs[0].dueDate, "2027-02-28");
});

test("próximas faturas incluem recorrentes no cartão (mesmo valor que a fatura terá)", () => {
  const mercado = tx({ amountCents: 120000, paymentMethod: "CARD", cardId: "c1", card, recurrence: "MONTHLY", date: new Date("2026-11-02T00:00:00Z") });
  const u = cardUsage(card, [mercado], [], parseMonth("2026-11"));
  assert.deepEqual(u.nextInvoices.slice(0, 2).map((n) => n.cents), [120000, 120000]);
  assert.equal(u.committedCents, 120000); // limite: só a compra que já aconteceu
});

test("dízimo do Lucas (caso real): empréstimo recebido não entra; dá para vincular a um salário específico", () => {
  const nov5 = new Date("2026-11-05T00:00:00Z");
  const emprestimo = tx({ type: "INCOME", personId: "lucas", amountCents: 2500000, date: nov5, paymentMethod: null });
  const sal5 = tx({ type: "INCOME", personId: "lucas", amountCents: 1150000, date: nov5, isSalary: true, paymentMethod: null });
  const sal30 = tx({ type: "INCOME", personId: "lucas", amountCents: 1500000, date: new Date("2026-11-30T00:00:00Z"), isSalary: true, recurrence: "MONTHLY", paymentMethod: null });
  const salAle = tx({ type: "INCOME", personId: "ale", amountCents: 125520, date: nov5, isSalary: true, paymentMethod: null });
  const base = { personId: "lucas", amountMode: "PERCENT" as const, percentBp: 1000, date: nov5 };
  const todas = tx({ ...base, percentBase: "PERSON_INCOME" });
  const salarios = tx({ ...base, percentBase: "PERSON_SALARY" });
  const doDia5 = tx({ ...base, percentBase: "TRANSACTION", percentBaseTxId: sal5.id });
  const grupoSal = tx({ ...base, personId: null, percentBase: "GROUP_SALARY" });
  const occs = buildOccurrences([emprestimo, sal5, sal30, salAle, todas, salarios, doDia5, grupoSal], [], parseMonth("2026-11"), parseMonth("2026-11"));
  const v = (t: { id: string }) => occs.find((o) => o.transactionId === t.id)!.amountCents;
  assert.equal(v(todas), 515000); // o bug relatado: 10% de 51.500 (com o empréstimo)
  assert.equal(v(salarios), 265000); // 10% de 11.500 + 15.000
  assert.equal(v(doDia5), 115000); // 10% só do salário do dia 5 = R$ 1.150
  assert.equal(v(grupoSal), 277552); // salários do casal
});

test("percentual vinculado a uma entrada que não ocorre no mês dá zero (não inventa valor)", () => {
  const sal = tx({ type: "INCOME", personId: "lucas", amountCents: 1000000, date: new Date("2026-10-05T00:00:00Z"), isSalary: true, paymentMethod: null });
  const p = tx({ personId: "lucas", amountMode: "PERCENT", percentBp: 1000, percentBase: "TRANSACTION", percentBaseTxId: sal.id, recurrence: "MONTHLY", date: new Date("2026-10-05T00:00:00Z") });
  const occs = buildOccurrences([sal, p], [], parseMonth("2026-10"), parseMonth("2026-11"));
  assert.deepEqual(occs.filter((o) => o.transactionId === p.id).map((o) => o.amountCents), [100000, 0]);
});

test("dízimo vinculado ao salário acompanha o aumento feito com 'a partir deste mês'", () => {
  const d = new Date("2026-11-05T00:00:00Z");
  const antigo = tx({ type: "INCOME", personId: "lucas", amountCents: 1150000, date: d, recurrence: "MONTHLY", totalMonths: 2, isSalary: true, paymentMethod: null });
  const novo = tx({ type: "INCOME", personId: "lucas", amountCents: 2000000, date: new Date("2027-01-05T00:00:00Z"), recurrence: "MONTHLY", isSalary: true, paymentMethod: null, seriesId: antigo.id });
  const diz = tx({ personId: "lucas", amountMode: "PERCENT", percentBp: 1000, percentBase: "TRANSACTION", percentBaseTxId: antigo.id, recurrence: "MONTHLY", date: d });
  const occs = buildOccurrences([antigo, novo, diz], [], parseMonth("2026-11"), parseMonth("2027-02"));
  assert.deepEqual(occs.filter((o) => o.transactionId === diz.id).map((o) => o.amountCents), [115000, 115000, 200000, 200000]);
});

test("dízimo acompanha o salário recebido: no mês atual só conta o que foi marcado", () => {
  const nov = parseMonth("2026-11");
  const sal5 = tx({ type: "INCOME", personId: "lucas", amountCents: 1150000, date: new Date("2026-11-05T00:00:00Z"), isSalary: true, paymentMethod: null });
  const sal30 = tx({ type: "INCOME", personId: "lucas", amountCents: 1500000, date: new Date("2026-11-30T00:00:00Z"), isSalary: true, recurrence: "MONTHLY", paymentMethod: null });
  const diz = tx({ personId: "lucas", amountMode: "PERCENT", percentBp: 1000, percentBase: "PERSON_SALARY", recurrence: "MONTHLY", date: new Date("2026-11-05T00:00:00Z") });
  const recebido = (txId: string, month: string) => ({ id: txId + month, transactionId: txId, month, paid: true, paidAt: null, amountCents: null, skipped: false });
  const dizimo = (states: ReturnType<typeof recebido>[]) =>
    buildOccurrences([sal5, sal30, diz], states, nov, nov + 1, { receivedOnlyThrough: nov }).filter((o) => o.transactionId === diz.id).map((o) => o.amountCents);
  assert.deepEqual(dizimo([recebido(sal5.id, "2026-11")]), [115000, 150000]); // nov: só o recebido; dez: previsto
  assert.deepEqual(dizimo([recebido(sal5.id, "2026-11"), recebido(sal30.id, "2026-11")]), [265000, 150000]); // recebeu o do dia 30
  assert.deepEqual(dizimo([]), [0, 150000]); // nada recebido ainda no mês
});
