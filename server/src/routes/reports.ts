import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadGroup, occurrencesFor, serializeOcc, sumBy, type GroupData } from "../lib/data.js";
import { prisma } from "../lib/db.js";
import { cardUsage, type Occurrence } from "../lib/engine.js";
import { notFound } from "../lib/http.js";
import { currentMonthIdx, formatMonth, parseMonth } from "../lib/months.js";

const monthStr = z.string().regex(/^\d{4}-\d{2}$/);

function totals(occs: Occurrence[]) {
  const income = sumBy(occs, (o) => o.tx.type === "INCOME");
  const expense = sumBy(occs, (o) => o.tx.type === "EXPENSE");
  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    receivedCents: sumBy(occs, (o) => o.tx.type === "INCOME" && o.paid),
    paidCents: sumBy(occs, (o) => o.tx.type === "EXPENSE" && o.paid),
    pendingCents: sumBy(occs, (o) => o.tx.type === "EXPENSE" && !o.paid),
  };
}

function cardsSummary(data: GroupData, idx: number) {
  return data.cards
    .filter((c) => !c.archived)
    .map((c) => {
      const u = cardUsage(c, data.txs, data.states, idx);
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
        ownerId: c.ownerId,
        limitCents: c.limitCents,
        committedCents: u.committedCents,
        availableCents: c.limitCents - u.committedCents,
        invoiceCents: u.invoiceCents,
      };
    });
}

/** Itens planejados da lista de compras, como ocorrências virtuais por mês (para a previsão). */
async function plannedByMonth(groupId: string, from: number, to: number) {
  const items = await prisma.shoppingItem.findMany({ where: { groupId, status: "PLANNED", plannedMonth: { not: null } } });
  const map = new Map<number, number>();
  for (const it of items) {
    const start = parseMonth(it.plannedMonth!);
    const n = Math.max(1, it.installments);
    const per = Math.round(it.estimatedCents / n);
    for (let k = 0; k < n; k++) {
      const m = start + k;
      if (m >= from && m <= to) map.set(m, (map.get(m) ?? 0) + per);
    }
  }
  return map;
}

export async function forecast(groupId: string, fromIdx: number, months: number, includePlanned: boolean) {
  const [data, group] = await Promise.all([loadGroup(groupId), prisma.group.findUniqueOrThrow({ where: { id: groupId } })]);
  const toIdx = fromIdx + months - 1;
  const occs = occurrencesFor(data, fromIdx, toIdx);
  const planned = includePlanned ? await plannedByMonth(groupId, fromIdx, toIdx) : new Map<number, number>();

  let acc = group.initialBalanceCents;
  const rows = [];
  for (let m = fromIdx; m <= toIdx; m++) {
    const mo = occs.filter((o) => o.monthIdx === m);
    const t = totals(mo);
    const plannedCents = planned.get(m) ?? 0;
    const net = t.incomeCents - t.expenseCents - plannedCents;
    acc += net;
    rows.push({
      month: formatMonth(m),
      incomeCents: t.incomeCents,
      expenseCents: t.expenseCents,
      plannedCents,
      netCents: net,
      accumulatedCents: acc,
      cardCents: sumBy(mo, (o) => o.tx.type === "EXPENSE" && o.tx.paymentMethod === "CARD"),
      recurringCents: sumBy(mo, (o) => o.tx.type === "EXPENSE" && o.tx.recurrence !== "ONCE"),
    });
  }
  return { initialBalanceCents: group.initialBalanceCents, rows };
}

export async function reportRoutes(app: FastifyInstance) {
  /** Todas as ocorrências de um mês (lista de lançamentos). */
  app.get<{ Params: { month: string } }>("/months/:month", async (req) => {
    const idx = parseMonth(monthStr.parse(req.params.month));
    const data = await loadGroup(req.ctx.groupId);
    const occs = occurrencesFor(data, idx, idx, true);
    return {
      month: req.params.month,
      totals: totals(occs.filter((o) => !o.skipped)),
      items: occs.map(serializeOcc),
    };
  });

  app.get<{ Querystring: { month?: string } }>("/dashboard", async (req) => {
    const idx = req.query.month ? parseMonth(monthStr.parse(req.query.month)) : currentMonthIdx();
    const data = await loadGroup(req.ctx.groupId);
    const occs = occurrencesFor(data, idx, idx);
    const expenses = occs.filter((o) => o.tx.type === "EXPENSE");

    const byCategory = new Map<string, { id: string | null; name: string; color: string; icon: string; totalCents: number }>();
    for (const o of expenses) {
      const c = o.tx.category;
      const key = c?.id ?? "none";
      const cur = byCategory.get(key) ?? {
        id: c?.id ?? null,
        name: c?.name ?? "Sem categoria",
        color: c?.color ?? "#94A3B8",
        icon: c?.icon ?? "📦",
        totalCents: 0,
      };
      cur.totalCents += o.amountCents;
      byCategory.set(key, cur);
    }

    const byMethod = new Map<string, number>();
    for (const o of expenses) {
      const k = o.tx.paymentMethod ?? "OTHER";
      byMethod.set(k, (byMethod.get(k) ?? 0) + o.amountCents);
    }

    const byPerson = data.members.map((m) => {
      const mine = occs.filter((o) => o.tx.personId === m.id);
      const t = totals(mine);
      return { id: m.id, name: m.name, incomeCents: t.incomeCents, expenseCents: t.expenseCents, netCents: t.netCents };
    });
    const shared = occs.filter((o) => !o.tx.personId);
    if (shared.length) {
      const t = totals(shared);
      byPerson.push({ id: "shared", name: "Casa (compartilhado)", incomeCents: t.incomeCents, expenseCents: t.expenseCents, netCents: t.netCents });
    }

    const fc = await forecast(req.ctx.groupId, idx, 6, false);

    return {
      month: formatMonth(idx),
      totals: totals(occs),
      byCategory: [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents),
      byMethod: [...byMethod.entries()].map(([method, totalCents]) => ({ method, totalCents })),
      byPerson,
      cards: cardsSummary(data, idx),
      upcoming: expenses.filter((o) => !o.paid).slice(0, 8).map(serializeOcc),
      incomes: occs.filter((o) => o.tx.type === "INCOME").map(serializeOcc),
      forecast: fc.rows,
    };
  });

  app.get<{ Querystring: { month?: string } }>("/cards/summary", async (req) => {
    const idx = req.query.month ? parseMonth(monthStr.parse(req.query.month)) : currentMonthIdx();
    const data = await loadGroup(req.ctx.groupId);
    const occs = occurrencesFor(data, idx, idx).filter((o) => o.tx.paymentMethod === "CARD" && o.tx.type === "EXPENSE");
    return cardsSummary(data, idx).map((c) => ({
      ...c,
      items: occs.filter((o) => o.tx.cardId === c.id).map(serializeOcc),
    }));
  });

  /** Marca a fatura inteira do cartão no mês como paga (ou desfaz). */
  app.post<{ Params: { id: string } }>("/cards/:id/pay-invoice", async (req) => {
    const { month, paid } = z.object({ month: monthStr, paid: z.boolean().default(true) }).parse(req.body);
    const card = await prisma.card.findFirst({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    if (!card) throw notFound("Cartão");
    const idx = parseMonth(month);
    const data = await loadGroup(req.ctx.groupId);
    const occs = occurrencesFor(data, idx, idx).filter((o) => o.tx.cardId === card.id && o.tx.paymentMethod === "CARD");
    await prisma.$transaction(
      occs.map((o) =>
        prisma.txOccurrence.upsert({
          where: { transactionId_month: { transactionId: o.transactionId, month } },
          create: { transactionId: o.transactionId, month, paid, paidAt: paid ? new Date() : null },
          update: { paid, paidAt: paid ? new Date() : null },
        }),
      ),
    );
    return { ok: true, count: occs.length };
  });

  app.get<{ Querystring: { from?: string; months?: string; includePlanned?: string } }>("/forecast", async (req) => {
    const fromIdx = req.query.from ? parseMonth(monthStr.parse(req.query.from)) : currentMonthIdx();
    const months = Math.min(60, Math.max(1, Number(req.query.months ?? 12) || 12));
    return forecast(req.ctx.groupId, fromIdx, months, req.query.includePlanned === "1");
  });
}
