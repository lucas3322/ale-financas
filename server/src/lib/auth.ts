import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { HttpError } from "./http.js";

/**
 * Sessão em dois cookies httpOnly:
 * - ACCESS  (JWT, 15 min): enviado em todas as rotas /api.
 * - REFRESH (opaco, 30 dias): só vai para /api/auth; é rotacionado a cada uso.
 *   Se um refresh já usado reaparecer (possível roubo), todas as sessões do usuário são revogadas.
 */
export const ACCESS_COOKIE = "nc_access";
export const REFRESH_COOKIE = "nc_refresh";
const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_S = 30 * 24 * 3600;
const REFRESH_PATH = "/api/auth";

export interface Ctx {
  userId: string;
  groupId: string;
  role: "OWNER" | "MEMBER";
}

declare module "fastify" {
  interface FastifyRequest {
    ctx: Ctx;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

const secure = process.env.NODE_ENV === "production";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

function setAccess(reply: FastifyReply, userId: string) {
  const token = reply.server.jwt.sign({ sub: userId }, { expiresIn: ACCESS_TTL_S });
  reply.setCookie(ACCESS_COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: ACCESS_TTL_S });
}

async function issueRefresh(reply: FastifyReply, userId: string, userAgent?: string) {
  const raw = randomBytes(48).toString("base64url");
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000),
      userAgent: userAgent?.slice(0, 200),
    },
  });
  reply.setCookie(REFRESH_COOKIE, raw, { path: REFRESH_PATH, httpOnly: true, sameSite: "strict", secure, maxAge: REFRESH_TTL_S });
  return row;
}

export async function startSession(req: FastifyRequest, reply: FastifyReply, userId: string) {
  // Limpeza: tokens vencidos ou revogados há mais de 7 dias não servem mais nem para detectar reuso.
  await prisma.refreshToken.deleteMany({
    where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }] },
  });
  setAccess(reply, userId);
  await issueRefresh(reply, userId, req.headers["user-agent"]);
}

export function clearSessionCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: "/" });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
}

/** Troca o refresh token por um novo par. Lança 401 se inválido. */
export async function rotateSession(req: FastifyRequest, reply: FastifyReply) {
  const raw = req.cookies[REFRESH_COOKIE];
  if (!raw) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row) {
    clearSessionCookies(reply);
    throw new HttpError(401, "Sessão expirada. Entre novamente.");
  }
  if (row.revokedAt) {
    // Reuso de token já rotacionado: revoga tudo desse usuário por segurança.
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    clearSessionCookies(reply);
    throw new HttpError(401, "Sessão encerrada por segurança. Entre novamente.");
  }
  if (row.expiresAt < new Date()) {
    clearSessionCookies(reply);
    throw new HttpError(401, "Sessão expirada. Entre novamente.");
  }
  const next = await issueRefresh(reply, row.userId, req.headers["user-agent"]);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedBy: next.id } });
  setAccess(reply, row.userId);
}

export async function endSession(req: FastifyRequest, reply: FastifyReply) {
  const raw = req.cookies[REFRESH_COOKIE];
  if (raw) await prisma.refreshToken.updateMany({ where: { tokenHash: hash(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  clearSessionCookies(reply);
}

export async function userIdFrom(req: FastifyRequest): Promise<string> {
  try {
    const p = await req.jwtVerify<{ sub: string }>();
    return p.sub;
  } catch {
    // 401 com código próprio: o front sabe que deve tentar /auth/refresh.
    throw new HttpError(401, "Sessão expirada", "TOKEN_EXPIRED");
  }
}

/** Hook: exige login e um grupo ativo; preenche req.ctx. */
export async function requireGroup(req: FastifyRequest) {
  const userId = await userIdFrom(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { orderBy: { createdAt: "asc" } } },
  });
  if (!user) throw new HttpError(401, "Sessão inválida", "SESSION_INVALID");
  const m = user.memberships.find((x) => x.groupId === user.activeGroupId) ?? user.memberships[0];
  if (!m) throw new HttpError(409, "Você não participa de nenhum grupo", "NO_GROUP");
  if (m.groupId !== user.activeGroupId) {
    await prisma.user.update({ where: { id: userId }, data: { activeGroupId: m.groupId } });
  }
  req.ctx = { userId, groupId: m.groupId, role: m.role };
}
