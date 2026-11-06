import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { badRequest, notFound } from "../lib/http.js";

const categoryBody = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria").max(40, "Máximo de 40 caracteres"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // Nome de ícone do Iconify ("ph:house-line-duotone") ou emoji
  icon: z.string().max(60).regex(/^([a-z0-9-]+:[a-z0-9-]+|[^\s]{1,8})$/, "Ícone inválido").optional(),
  parentId: z.string().nullable().optional(),
});

/** Subcategoria: um nível só, mesmo tipo (entrada/saída) e mesmo grupo da categoria mãe. */
async function assertParent(groupId: string, parentId: string | null | undefined, kind: "INCOME" | "EXPENSE" | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw badRequest("A categoria não pode ser mãe dela mesma");
  const parent = await prisma.category.findFirst({ where: { id: parentId, groupId } });
  if (!parent) throw badRequest("Categoria mãe inválida");
  if (parent.parentId) throw badRequest("Subcategoria não pode ter subcategorias");
  if (kind && parent.kind !== kind) throw badRequest("A subcategoria precisa ser do mesmo tipo da categoria mãe");
  if (selfId && (await prisma.category.count({ where: { parentId: selfId } }))) {
    throw badRequest("Essa categoria tem subcategorias e não pode virar subcategoria");
  }
}

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
    await assertParent(req.ctx.groupId, body.parentId, body.kind);
    return prisma.category.create({ data: { ...body, groupId: req.ctx.groupId } });
  });

  app.patch<{ Params: { id: string } }>("/categories/:id", async (req) => {
    const body = categoryBody.partial().parse(req.body);
    const current = await prisma.category.findFirst({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    if (!current) throw notFound("Categoria");
    await assertParent(req.ctx.groupId, body.parentId, body.kind ?? current.kind, current.id);
    await prisma.category.update({ where: { id: current.id }, data: body });
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
