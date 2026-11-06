import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { endSession, rotateSession, startSession, userIdFrom } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { createGroupForUser } from "../lib/defaults.js";
import { HttpError } from "../lib/http.js";
import { assertInviteValid, consumeInvite } from "./groups.js";

const registerBody = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80, "Nome muito longo"),
  email: z.string().trim().toLowerCase().max(160).email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha precisa ter ao menos 8 caracteres")
    .max(128, "Senha muito longa")
    .regex(/[A-Za-z]/, "A senha precisa ter ao menos uma letra")
    .regex(/\d/, "A senha precisa ter ao menos um número"),
  inviteToken: z.string().trim().max(20).optional().or(z.literal("")),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", authRateLimit, async (req, reply) => {
    const body = registerBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) {
      throw new HttpError(409, "Já existe uma conta com esse e-mail", "EMAIL_TAKEN");
    }
    if (body.inviteToken) await assertInviteValid(body.inviteToken);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10) },
    });
    if (body.inviteToken) {
      await consumeInvite(user.id, body.inviteToken);
    } else {
      await createGroupForUser(user.id, `Finanças de ${body.name.split(" ")[0]}`);
    }
    await startSession(req, reply, user.id);
    return { ok: true };
  });

  app.post("/auth/login", authRateLimit, async (req, reply) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, "E-mail ou senha incorretos", "BAD_CREDENTIALS");
    }
    await startSession(req, reply, user.id);
    return { ok: true };
  });

  app.post("/auth/refresh", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    await rotateSession(req, reply);
    return { ok: true };
  });

  app.post("/auth/logout", async (req, reply) => {
    await endSession(req, reply);
    return { ok: true };
  });

  app.get("/auth/me", async (req) => {
    const userId = await userIdFrom(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { group: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!user) throw new HttpError(401, "Sessão inválida", "SESSION_INVALID");
    const active = user.memberships.find((m) => m.groupId === user.activeGroupId) ?? user.memberships[0];
    const members = active
      ? await prisma.membership.findMany({
          where: { groupId: active.groupId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [];
    return {
      user: { id: user.id, name: user.name, email: user.email },
      activeGroup: active
        ? {
            id: active.group.id,
            name: active.group.name,
            role: active.role,
            initialBalanceCents: active.group.initialBalanceCents,
          }
        : null,
      groups: user.memberships.map((m) => ({ id: m.group.id, name: m.group.name, role: m.role })),
      members: members.map((m) => ({ ...m.user, role: m.role })),
    };
  });
}
