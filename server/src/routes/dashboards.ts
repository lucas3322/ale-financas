import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { querySchema, runQuery } from "../lib/analytics.js";
import { loadGroup } from "../lib/data.js";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/http.js";

const VIZ = ["kpi", "donut", "pie", "bar", "barH", "stacked", "line", "area", "table", "progress", "cards", "upcoming"] as const;

export const widgetSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1, "Dê um título ao widget").max(60, "Título muito longo"),
  viz: z.enum(VIZ),
  size: z.enum(["s", "m", "l", "xl"]).default("m"),
  tall: z.boolean().default(false),
  query: querySchema,
  /** Meta (progress) — ex.: limite de gastos do mês */
  goalCents: z.number().int().min(1).max(9_999_999_999).nullable().optional(),
  /** Condições de cor: "se total > X fica vermelho" */
  conditions: z
    .array(z.object({ op: z.enum(["gt", "lt"]), valueCents: z.number().int(), tone: z.enum(["red", "amber", "green"]) }))
    .max(4)
    .default([]),
});

const dashBody = z.object({
  name: z.string().trim().min(1, "Dê um nome ao dashboard").max(40, "Máximo de 40 caracteres"),
  icon: z.string().max(60).default("ph:chart-pie-slice-duotone"),
  widgets: z.array(widgetSchema).max(40, "Máximo de 40 widgets por dashboard").default([]),
});

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboards", async (req) =>
    prisma.dashboard.findMany({
      where: { groupId: req.ctx.groupId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
  );

  app.post("/dashboards", async (req) => {
    const body = dashBody.parse(req.body);
    const count = await prisma.dashboard.count({ where: { groupId: req.ctx.groupId } });
    return prisma.dashboard.create({
      data: { ...body, groupId: req.ctx.groupId, createdById: req.ctx.userId, position: count },
    });
  });

  app.patch<{ Params: { id: string } }>("/dashboards/:id", async (req) => {
    const body = dashBody.partial().extend({ position: z.number().int().min(0).optional() }).parse(req.body);
    const r = await prisma.dashboard.updateMany({ where: { id: req.params.id, groupId: req.ctx.groupId }, data: body });
    if (!r.count) throw notFound("Dashboard");
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/dashboards/:id", async (req) => {
    await prisma.dashboard.deleteMany({ where: { id: req.params.id, groupId: req.ctx.groupId } });
    return { ok: true };
  });

  /** Executa uma ou várias consultas de widgets (o dashboard inteiro carrega em uma requisição). */
  app.post("/analytics/query", async (req) => {
    const body = z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        queries: z.record(z.string().max(40), querySchema).refine((q) => Object.keys(q).length <= 40, "Consultas demais"),
      })
      .parse(req.body);
    const [data, group] = await Promise.all([
      loadGroup(req.ctx.groupId),
      prisma.group.findUniqueOrThrow({ where: { id: req.ctx.groupId }, select: { initialBalanceCents: true } }),
    ]);
    const out: Record<string, Awaited<ReturnType<typeof runQuery>>> = {};
    for (const [key, spec] of Object.entries(body.queries)) {
      out[key] = await runQuery(req.ctx.groupId, spec, body.month, group.initialBalanceCents, data);
    }
    return out;
  });
}
