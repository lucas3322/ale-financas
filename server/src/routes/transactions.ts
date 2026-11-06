import type { Prisma, Transaction } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { cardInvoiceShift, expandSlots } from "../lib/engine.js";
import { badRequest, notFound } from "../lib/http.js";
import { addMonthsToDate, dateMonthIdx, formatMonth, parseMonth, toDateOnly } from "../lib/months.js";
import { assertRefs } from "../lib/refs.js";

const monthStr = z.string().regex(/^\d{4}-\d{2}$/);

const txBase = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().trim().min(1, "Informe uma descrição"),
  categoryId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  amountMode: z.enum(["FIXED", "PERCENT"]).default("FIXED"),
  amountCents: z.number().int().min(0).default(0),
  percentBp: z.number().int().min(1).max(100000).nullable().optional(),
  percentBase: z.enum(["PERSON_INCOME", "GROUP_INCOME"]).nullable().optional(),
  paymentMethod: z.enum(["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"]).nullable().optional(),
  cardId: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(["ONCE", "MONTHLY", "INSTALLMENTS"]).default("ONCE"),
  totalMonths: z.number().int().min(1).max(600).nullable().optional(),
  installmentStart: z.number().int().min(1).default(1),
  isSalary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

type TxInput = z.infer<typeof txBase>;

function normalize(i: TxInput): Omit<Prisma.TransactionUncheckedCreateInput, "groupId" | "createdById"> {
  if (i.amountMode === "PERCENT" && !i.percentBp) throw badRequest("Informe o percentual");
  if (i.amountMode === "FIXED" && i.amountCents <= 0) throw badRequest("Informe um valor maior que zero");
  if (i.type === "EXPENSE" && i.paymentMethod === "CARD" && !i.cardId) throw badRequest("Escolha o cartão");
  if (i.recurrence === "INSTALLMENTS") {
    if (!i.totalMonths || i.totalMonths < 2) throw badRequest("Parcelado precisa de 2 parcelas ou mais");
    if (i.installmentStart > i.totalMonths) throw badRequest("Parcela inicial maior que o total");
  }
  const isCard = i.type === "EXPENSE" && i.paymentMethod === "CARD";
  return {
    type: i.type,
    description: i.description,
    categoryId: i.categoryId ?? null,
    personId: i.personId ?? null,
    amountMode: i.type === "INCOME" ? "FIXED" : i.amountMode,
    amountCents: i.amountMode === "PERCENT" && i.type === "EXPENSE" ? 0 : i.amountCents,
    percentBp: i.amountMode === "PERCENT" ? i.percentBp ?? null : null,
    percentBase: i.amountMode === "PERCENT" ? i.percentBase ?? "PERSON_INCOME" : null,
    paymentMethod: i.type === "EXPENSE" ? i.paymentMethod ?? null : null,
    cardId: isCard ? i.cardId ?? null : null,
    date: toDateOnly(i.date),
    recurrence: i.recurrence,
    totalMonths: i.recurrence === "ONCE" ? null : i.totalMonths ?? null,
    installmentStart: i.recurrence === "INSTALLMENTS" ? i.installmentStart : 1,
    isSalary: i.type === "INCOME" && i.isSalary,
    notes: i.notes ?? null,
  };
}

/** Primeiro mês (já deslocado para a fatura, se cartão) em que a série aparece. */
async function seriesStartIdx(tx: Transaction) {
  let shift = 0;
  if (tx.type === "EXPENSE" && tx.paymentMethod === "CARD" && tx.cardId) {
    const card = await prisma.card.findUnique({ where: { id: tx.cardId } });
    if (card) shift = cardInvoiceShift(tx.date, card);
  }
  return dateMonthIdx(tx.date) + shift;
}

async function getOwnTx(id: string, groupId: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, groupId } });
  if (!tx) throw notFound("Lançamento");
  return tx;
}

export async function transactionRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { type?: string; recurring?: string } }>("/transactions", async (req) => {
    const where: Prisma.TransactionWhereInput = { groupId: req.ctx.groupId };
    if (req.query.type === "INCOME" || req.query.type === "EXPENSE") where.type = req.query.type;
    if (req.query.recurring === "1") where.recurrence = { in: ["MONTHLY", "INSTALLMENTS"] };
    const txs = await prisma.transaction.findMany({
      where,
      orderBy: [{ type: "asc" }, { description: "asc" }],
      include: {
        category: true,
        card: { select: { id: true, name: true, color: true } },
        person: { select: { id: true, name: true } },
      },
    });
    return txs.map((t) => ({ ...t, date: t.date.toISOString().slice(0, 10) }));
  });

  app.get<{ Params: { id: string } }>("/transactions/:id", async (req) => {
    const t = await getOwnTx(req.params.id, req.ctx.groupId);
    return { ...t, date: t.date.toISOString().slice(0, 10) };
  });

  app.post("/transactions", async (req) => {
    const input = txBase.parse(req.body);
    await assertRefs(req.ctx.groupId, input);
    const data = normalize(input);
    const tx = await prisma.transaction.create({
      data: { ...data, groupId: req.ctx.groupId, createdById: req.ctx.userId },
    });
    return { id: tx.id };
  });

  /**
   * scope=all     → altera a série inteira
   * scope=future  → (mensal) encerra a série antes de `fromMonth` e cria uma nova com os novos dados.
   *                 Ex.: salário aumentou a partir de dezembro.
   */
  app.patch<{ Params: { id: string } }>("/transactions/:id", async (req) => {
    const { scope, fromMonth, ...rest } = z
      .object({ scope: z.enum(["all", "future"]).default("all"), fromMonth: monthStr.optional() })
      .passthrough()
      .parse(req.body);
    const input = txBase.parse(rest);
    await assertRefs(req.ctx.groupId, input);
    const data = normalize(input);
    const old = await getOwnTx(req.params.id, req.ctx.groupId);

    if (scope === "future" && fromMonth && old.recurrence === "MONTHLY" && data.recurrence === "MONTHLY") {
      const diff = parseMonth(fromMonth) - (await seriesStartIdx(old));
      if (old.totalMonths != null && diff >= old.totalMonths) throw badRequest("Esse mês está fora da série");
      if (diff > 0) {
        const created = await prisma.$transaction(async (db) => {
          await db.transaction.update({ where: { id: old.id }, data: { totalMonths: diff } });
          const novo = await db.transaction.create({
            data: {
              ...data,
              date: addMonthsToDate(old.date, diff),
              totalMonths: old.totalMonths != null ? old.totalMonths - diff : data.totalMonths,
              groupId: old.groupId,
              createdById: req.ctx.userId,
            },
          });
          await db.txOccurrence.updateMany({
            where: { transactionId: old.id, month: { gte: fromMonth } },
            data: { transactionId: novo.id },
          });
          return novo;
        });
        return { id: created.id };
      }
    }

    await prisma.transaction.update({ where: { id: old.id }, data });
    return { id: old.id };
  });

  /**
   * scope=all    → apaga tudo
   * scope=future → para de gerar a partir de `fromMonth` (ex.: cancelou a assinatura, quitou o parcelamento)
   */
  app.delete<{ Params: { id: string }; Querystring: { scope?: string; fromMonth?: string } }>(
    "/transactions/:id",
    async (req) => {
      const tx = await getOwnTx(req.params.id, req.ctx.groupId);
      const { scope, fromMonth } = req.query;
      if (scope === "future" && fromMonth && tx.recurrence !== "ONCE") {
        const fromIdx = parseMonth(fromMonth);
        const diff = fromIdx - (await seriesStartIdx(tx));
        if (diff > 0) {
          if (tx.recurrence === "MONTHLY") {
            await prisma.$transaction([
              prisma.transaction.update({ where: { id: tx.id }, data: { totalMonths: diff } }),
              prisma.txOccurrence.deleteMany({ where: { transactionId: tx.id, month: { gte: fromMonth } } }),
            ]);
          } else {
            // Parcelado: mantém a numeração (3/10) e marca as parcelas restantes como canceladas.
            const card = tx.cardId ? await prisma.card.findUnique({ where: { id: tx.cardId } }) : null;
            const slots = expandSlots({ ...tx, card }, fromIdx, fromIdx + 600);
            await prisma.$transaction(
              slots.map((s) =>
                prisma.txOccurrence.upsert({
                  where: { transactionId_month: { transactionId: tx.id, month: formatMonth(s.monthIdx) } },
                  create: { transactionId: tx.id, month: formatMonth(s.monthIdx), skipped: true },
                  update: { skipped: true },
                }),
              ),
            );
          }
          return { ok: true };
        }
      }
      await prisma.transaction.delete({ where: { id: tx.id } });
      return { ok: true };
    },
  );

  /** Estado de uma ocorrência num mês: pago, valor só deste mês, pular este mês. */
  app.put("/occurrences", async (req) => {
    const body = z
      .object({
        transactionId: z.string(),
        month: monthStr,
        paid: z.boolean().optional(),
        amountCents: z.number().int().min(0).nullable().optional(),
        skipped: z.boolean().optional(),
      })
      .parse(req.body);
    await getOwnTx(body.transactionId, req.ctx.groupId);
    const data: Prisma.TxOccurrenceUpdateInput = {};
    if (body.paid !== undefined) {
      data.paid = body.paid;
      data.paidAt = body.paid ? new Date() : null;
    }
    if (body.amountCents !== undefined) data.amountCents = body.amountCents;
    if (body.skipped !== undefined) data.skipped = body.skipped;
    await prisma.txOccurrence.upsert({
      where: { transactionId_month: { transactionId: body.transactionId, month: body.month } },
      create: {
        transactionId: body.transactionId,
        month: body.month,
        paid: body.paid ?? false,
        paidAt: body.paid ? new Date() : null,
        amountCents: body.amountCents ?? null,
        skipped: body.skipped ?? false,
      },
      update: data,
    });
    return { ok: true };
  });
}
