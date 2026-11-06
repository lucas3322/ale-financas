import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { badRequest, notFound } from "../lib/http.js";
import { assertRefs } from "../lib/refs.js";

const itemBody = z.object({
  name: z.string().trim().min(1),
  estimatedCents: z.number().int().min(0),
  paymentMethod: z.enum(["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"]).default("PIX"),
  cardId: z.string().nullable().optional(),
  installments: z.number().int().min(1).max(48).default(1),
  plannedMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  priority: z.number().int().min(1).max(3).default(2),
  notes: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

export async function shoppingRoutes(app: FastifyInstance) {
  app.get("/shopping", async (req) =>
    prisma.shoppingItem.findMany({
      where: { groupId: req.ctx.groupId },
      include: { card: { select: { id: true, name: true, color: true } } },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
    }),
  );

  app.post("/shopping", async (req) => {
    const body = itemBody.parse(req.body);
    await assertRefs(req.ctx.groupId, { cardId: body.cardId });
    return prisma.shoppingItem.create({
      data: { ...body, cardId: body.paymentMethod === "CARD" ? body.cardId : null, groupId: req.ctx.groupId },
    });
  });

  app.patch<{ Params: { id: string } }>("/shopping/:id", async (req) => {
    const body = itemBody.partial().parse(req.body);
    await assertRefs(req.ctx.groupId, { cardId: body.cardId });
    const r = await prisma.shoppingItem.updateMany({ where: { id: req.params.id, groupId: req.ctx.groupId }, data: body });
    if (!r.count) throw notFound("Item");
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/shopping/:id", async (req) => {
    await prisma.shoppingItem.deleteMany({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    return { ok: true };
  });

  /** Comprou! Vira um gasto de verdade (parcelado no cartão, se for o caso). */
  app.post<{ Params: { id: string } }>("/shopping/:id/buy", async (req) => {
    const body = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amountCents: z.number().int().min(1),
        categoryId: z.string().nullable().optional(),
        personId: z.string().nullable().optional(),
      })
      .parse(req.body);
    const item = await prisma.shoppingItem.findFirst({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    if (!item) throw notFound("Item");
    if (item.status === "BOUGHT") throw badRequest("Esse item já foi comprado");
    if (item.paymentMethod === "CARD" && !item.cardId) throw badRequest("Escolha o cartão do item antes de comprar");
    await assertRefs(req.ctx.groupId, body);

    const n = Math.max(1, item.installments);
    const [d] = body.date.split("T");
    const tx = await prisma.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          groupId: req.ctx.groupId,
          createdById: req.ctx.userId,
          personId: body.personId ?? null,
          type: "EXPENSE",
          description: item.name,
          categoryId: body.categoryId ?? null,
          amountCents: Math.round(body.amountCents / n),
          paymentMethod: item.paymentMethod,
          cardId: item.paymentMethod === "CARD" ? item.cardId : null,
          date: new Date(`${d}T00:00:00Z`),
          recurrence: n > 1 ? "INSTALLMENTS" : "ONCE",
          totalMonths: n > 1 ? n : null,
          notes: item.notes,
        },
      });
      await db.shoppingItem.update({ where: { id: item.id }, data: { status: "BOUGHT", transactionId: created.id } });
      return created;
    });
    return { transactionId: tx.id };
  });
}
