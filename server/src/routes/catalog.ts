import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/http.js";

const categoryBody = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(8).optional(),
});

const cardBody = z.object({
  name: z.string().trim().min(1),
  limitCents: z.number().int().min(0),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ownerId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

/** Registrado dentro de um escopo que já aplicou requireGroup. */
export async function catalogRoutes(app: FastifyInstance) {
  app.get("/categories", async (req) =>
    prisma.category.findMany({ where: { groupId: req.ctx.groupId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  );

  app.post("/categories", async (req) => {
    const body = categoryBody.parse(req.body);
    return prisma.category.create({ data: { ...body, groupId: req.ctx.groupId } });
  });

  app.patch<{ Params: { id: string } }>("/categories/:id", async (req) => {
    const body = categoryBody.partial().parse(req.body);
    const r = await prisma.category.updateMany({ where: { id: req.params.id, groupId: req.ctx.groupId }, data: body });
    if (!r.count) throw notFound("Categoria");
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/categories/:id", async (req) => {
    await prisma.category.deleteMany({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    return { ok: true };
  });

  app.get("/cards", async (req) =>
    prisma.card.findMany({
      where: { groupId: req.ctx.groupId },
      orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
      include: { owner: { select: { id: true, name: true } } },
    }),
  );

  app.post("/cards", async (req) => {
    const body = cardBody.parse(req.body);
    return prisma.card.create({ data: { ...body, groupId: req.ctx.groupId } });
  });

  app.patch<{ Params: { id: string } }>("/cards/:id", async (req) => {
    const body = cardBody.partial().parse(req.body);
    const r = await prisma.card.updateMany({ where: { id: req.params.id, groupId: req.ctx.groupId }, data: body });
    if (!r.count) throw notFound("Cartão");
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/cards/:id", async (req) => {
    await prisma.card.deleteMany({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    return { ok: true };
  });
}
