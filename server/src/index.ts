import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { ACCESS_COOKIE, requireGroup } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { HttpError } from "./lib/http.js";
import { authRoutes } from "./routes/auth.js";
import { catalogRoutes } from "./routes/catalog.js";
import { dashboardRoutes } from "./routes/dashboards.js";
import { groupRoutes } from "./routes/groups.js";
import { reportRoutes } from "./routes/reports.js";
import { shoppingRoutes } from "./routes/shopping.js";
import { transactionRoutes } from "./routes/transactions.js";

const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("Defina a variável JWT_SECRET");
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true });

await app.register(cookie);
await app.register(jwt, { secret: JWT_SECRET ?? "dev-secret-troque-em-producao", cookie: { cookieName: ACCESS_COOKIE, signed: false } });
await app.register(rateLimit, { global: false });

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    // fields: { campo: "mensagem" } — o front mostra cada erro embaixo do input certo.
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join(".")] ??= i.message;
    return reply.status(400).send({ error: err.issues[0]?.message ?? "Dados inválidos", code: "VALIDATION", fields });
  }
  if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  if ((err as { statusCode?: number }).statusCode === 429) {
    return reply.status(429).send({ error: "Muitas tentativas. Aguarde um minuto e tente de novo.", code: "RATE_LIMIT" });
  }
  const status = (err as { statusCode?: number }).statusCode;
  if (status && status < 500) return reply.status(status).send({ error: (err as Error).message });
  req.log.error(err);
  return reply.status(500).send({ error: "Erro interno. Tente novamente." });
});

app.get("/api/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true };
});

await app.register(
  async (api) => {
    await api.register(authRoutes);
    await api.register(groupRoutes);
    await api.register(async (scoped) => {
      scoped.addHook("preHandler", requireGroup);
      await scoped.register(catalogRoutes);
      await scoped.register(transactionRoutes);
      await scoped.register(reportRoutes);
      await scoped.register(shoppingRoutes);
      await scoped.register(dashboardRoutes);
    });
  },
  { prefix: "/api" },
);

// Em produção o mesmo container serve o frontend (build do Vite).
const webDir = process.env.WEB_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (existsSync(webDir)) {
  await app.register(fastifyStatic, {
    root: webDir,
    wildcard: false,
    cacheControl: false, // o cabeçalho é definido abaixo, por tipo de arquivo
    // Arquivos com hash no nome nunca mudam: cache longo. O index.html sempre revalida,
    // para que um recarregamento já pegue a versão nova depois de um deploy.
    setHeaders: (res, path) => {
      res.setHeader("Cache-Control", /[\\/]assets[\\/]/.test(path) ? "public, max-age=31536000, immutable" : "no-cache");
    },
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.status(404).send({ error: "Rota não encontrada" });
    // Arquivo de build que não existe (ex.: aba aberta com a versão antiga depois de um deploy):
    // 404 de verdade, e não o index.html — senão o navegador tenta executar HTML como JS e a tela quebra.
    if (req.url.startsWith("/assets/") || /\.(js|css|map|json|png|svg|ico|woff2?)(\?|$)/.test(req.url)) {
      return reply.status(404).header("Cache-Control", "no-store").send("Not found");
    }
    // cacheControl: false — senão o @fastify/static sobrescreve com "max-age=0" e alguns navegadores reaproveitam a versão velha.
    return reply.header("Cache-Control", "no-cache").sendFile("index.html", { cacheControl: false });
  });
}

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

await app.listen({ port: PORT, host: "0.0.0.0" });
