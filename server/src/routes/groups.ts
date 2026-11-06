import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireGroup, userIdFrom } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { createGroupForUser } from "../lib/defaults.js";
import { HttpError, forbidden } from "../lib/http.js";

const INVITE_DAYS = 7;

/** Token curto e fácil de digitar/ditar: ABCD-EFGH (sem caracteres ambíguos). */
function makeToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export async function assertInviteValid(rawToken: string) {
  const token = rawToken.trim().toUpperCase();
  const invite = await prisma.invite.findUnique({ where: { token }, include: { group: { select: { name: true } } } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw new HttpError(400, "Convite inválido ou expirado", "INVITE_INVALID");
  }
  return invite;
}

export async function consumeInvite(userId: string, rawToken: string) {
  const invite = await assertInviteValid(rawToken);
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_groupId: { userId, groupId: invite.groupId } },
      create: { userId, groupId: invite.groupId, role: "MEMBER" },
      update: {},
    }),
    prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date(), usedById: userId } }),
    prisma.user.update({ where: { id: userId }, data: { activeGroupId: invite.groupId } }),
  ]);
  return invite.groupId;
}

export async function groupRoutes(app: FastifyInstance) {
  /** Público: mostra para quem o convite é, antes de criar a conta. */
  app.get<{ Params: { token: string } }>("/invites/:token", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    const invite = await assertInviteValid(req.params.token);
    return { groupName: invite.group.name, expiresAt: invite.expiresAt };
  });

  // Rotas que só exigem login (não dependem do grupo ativo)
  app.post("/groups/join", async (req) => {
    const userId = await userIdFrom(req);
    const { token } = z.object({ token: z.string().min(4) }).parse(req.body);
    await consumeInvite(userId, token);
    return { ok: true };
  });

  app.post("/groups/switch", async (req) => {
    const userId = await userIdFrom(req);
    const { groupId } = z.object({ groupId: z.string() }).parse(req.body);
    const m = await prisma.membership.findUnique({ where: { userId_groupId: { userId, groupId } } });
    if (!m) throw forbidden("Você não participa desse grupo");
    await prisma.user.update({ where: { id: userId }, data: { activeGroupId: groupId } });
    return { ok: true };
  });

  app.post("/groups", async (req) => {
    const userId = await userIdFrom(req);
    const { name } = z.object({ name: z.string().trim().min(2) }).parse(req.body);
    const g = await createGroupForUser(userId, name);
    return { id: g.id };
  });

  // Rotas do grupo ativo
  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireGroup);

    scoped.patch("/group", async (req) => {
      const body = z
        .object({ name: z.string().trim().min(2).optional(), initialBalanceCents: z.number().int().optional() })
        .parse(req.body);
      if (body.name !== undefined && req.ctx.role !== "OWNER") throw forbidden("Só o dono do grupo pode renomeá-lo");
      await prisma.group.update({ where: { id: req.ctx.groupId }, data: body });
      return { ok: true };
    });

    scoped.get("/group/invites", async (req) => {
      return prisma.invite.findMany({
        where: { groupId: req.ctx.groupId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, token: true, expiresAt: true, createdAt: true },
      });
    });

    scoped.post("/group/invites", async (req) => {
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 3600 * 1000);
      return prisma.invite.create({
        data: { groupId: req.ctx.groupId, createdById: req.ctx.userId, token: makeToken(), expiresAt },
        select: { id: true, token: true, expiresAt: true, createdAt: true },
      });
    });

    scoped.delete<{ Params: { id: string } }>("/group/invites/:id", async (req) => {
      await prisma.invite.deleteMany({ where: { id: req.params.id, groupId: req.ctx.groupId } });
      return { ok: true };
    });

    scoped.delete<{ Params: { userId: string } }>("/group/members/:userId", async (req) => {
      const { userId, groupId, role } = req.ctx;
      const target = req.params.userId;
      if (target !== userId && role !== "OWNER") throw forbidden("Só o dono do grupo pode remover membros");
      const owners = await prisma.membership.count({ where: { groupId, role: "OWNER" } });
      const targetM = await prisma.membership.findUnique({ where: { userId_groupId: { userId: target, groupId } } });
      if (!targetM) throw new HttpError(404, "Membro não encontrado");
      if (targetM.role === "OWNER" && owners <= 1) {
        throw new HttpError(400, "O grupo precisa de ao menos um dono. Promova outra pessoa antes de sair.");
      }
      await prisma.membership.delete({ where: { id: targetM.id } });
      await prisma.user.updateMany({ where: { id: target, activeGroupId: groupId }, data: { activeGroupId: null } });
      return { ok: true };
    });

    scoped.patch<{ Params: { userId: string } }>("/group/members/:userId", async (req) => {
      if (req.ctx.role !== "OWNER") throw forbidden("Só o dono do grupo pode alterar papéis");
      const { role } = z.object({ role: z.enum(["OWNER", "MEMBER"]) }).parse(req.body);
      await prisma.membership.update({
        where: { userId_groupId: { userId: req.params.userId, groupId: req.ctx.groupId } },
        data: { role },
      });
      return { ok: true };
    });
  });
}
