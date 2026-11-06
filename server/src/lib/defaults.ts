import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const DEFAULT_CATEGORIES: Array<Pick<Prisma.CategoryCreateManyInput, "name" | "kind" | "color" | "icon">> = [
  { name: "Salário", kind: "INCOME", color: "#16A34A", icon: "💼" },
  { name: "Renda extra", kind: "INCOME", color: "#0EA5E9", icon: "✨" },
  { name: "Moradia", kind: "EXPENSE", color: "#8A05BE", icon: "🏠" },
  { name: "Mercado", kind: "EXPENSE", color: "#F59E0B", icon: "🛒" },
  { name: "Transporte", kind: "EXPENSE", color: "#3B82F6", icon: "🚗" },
  { name: "Saúde", kind: "EXPENSE", color: "#EF4444", icon: "💊" },
  { name: "Educação", kind: "EXPENSE", color: "#6366F1", icon: "🎓" },
  { name: "Contas da casa", kind: "EXPENSE", color: "#14B8A6", icon: "💡" },
  { name: "Dízimo e doações", kind: "EXPENSE", color: "#A855F7", icon: "🙏" },
  { name: "Empréstimos", kind: "EXPENSE", color: "#DC2626", icon: "🏦" },
  { name: "Cartão de crédito", kind: "EXPENSE", color: "#C026D3", icon: "💳" },
  { name: "Filhos", kind: "EXPENSE", color: "#EC4899", icon: "🧸" },
  { name: "Lazer", kind: "EXPENSE", color: "#F97316", icon: "🎉" },
  { name: "Impostos", kind: "EXPENSE", color: "#64748B", icon: "🧾" },
  { name: "Reserva / Guardar", kind: "EXPENSE", color: "#22C55E", icon: "🐷" },
  { name: "Outros", kind: "EXPENSE", color: "#94A3B8", icon: "📦" },
];

export async function createGroupForUser(userId: string, name: string) {
  return prisma.$transaction(async (db) => {
    const group = await db.group.create({ data: { name } });
    await db.membership.create({ data: { userId, groupId: group.id, role: "OWNER" } });
    await db.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, groupId: group.id })) });
    await db.user.update({ where: { id: userId }, data: { activeGroupId: group.id } });
    return group;
  });
}
