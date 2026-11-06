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
  { name: "Internet e telefone", kind: "EXPENSE", color: "#0EA5E9", icon: "🌐" },
  { name: "Energia", kind: "EXPENSE", color: "#EAB308", icon: "⚡" },
  { name: "Água", kind: "EXPENSE", color: "#38BDF8", icon: "💧" },
  { name: "Gás", kind: "EXPENSE", color: "#F97316", icon: "🔥" },
  { name: "Aluguel", kind: "EXPENSE", color: "#9333EA", icon: "🔑" },
  { name: "Condomínio", kind: "EXPENSE", color: "#7C3AED", icon: "🏢" },
  { name: "Financiamento", kind: "EXPENSE", color: "#B91C1C", icon: "🏗️" },
  { name: "Casa e móveis", kind: "EXPENSE", color: "#8B5CF6", icon: "🛋️" },
  { name: "Manutenção da casa", kind: "EXPENSE", color: "#78716C", icon: "🔧" },
  { name: "Assinaturas e streaming", kind: "EXPENSE", color: "#E11D48", icon: "📺" },
  { name: "Restaurante e delivery", kind: "EXPENSE", color: "#F59E0B", icon: "🍔" },
  { name: "Farmácia", kind: "EXPENSE", color: "#EF4444", icon: "🩹" },
  { name: "Plano de saúde", kind: "EXPENSE", color: "#DC2626", icon: "🩺" },
  { name: "Academia", kind: "EXPENSE", color: "#10B981", icon: "🏋️" },
  { name: "Combustível", kind: "EXPENSE", color: "#EA580C", icon: "⛽" },
  { name: "Uber e apps", kind: "EXPENSE", color: "#334155", icon: "🚕" },
  { name: "Seguros", kind: "EXPENSE", color: "#475569", icon: "🛡️" },
  { name: "Pets", kind: "EXPENSE", color: "#A16207", icon: "🐶" },
  { name: "Roupas", kind: "EXPENSE", color: "#DB2777", icon: "👕" },
  { name: "Beleza e cuidados", kind: "EXPENSE", color: "#F472B6", icon: "💅" },
  { name: "Presentes", kind: "EXPENSE", color: "#C026D3", icon: "🎁" },
  { name: "Viagem", kind: "EXPENSE", color: "#0284C7", icon: "✈️" },
  { name: "Investimentos", kind: "EXPENSE", color: "#16A34A", icon: "📈" },
  { name: "Tarifas bancárias", kind: "EXPENSE", color: "#64748B", icon: "🏧" },
  { name: "Freelance", kind: "INCOME", color: "#0891B2", icon: "💻" },
  { name: "13º salário", kind: "INCOME", color: "#15803D", icon: "🎄" },
  { name: "Férias", kind: "INCOME", color: "#22C55E", icon: "🏖️" },
  { name: "Reembolso", kind: "INCOME", color: "#14B8A6", icon: "↩️" },
  { name: "Rendimentos", kind: "INCOME", color: "#059669", icon: "🪙" },
  { name: "Vendas", kind: "INCOME", color: "#D97706", icon: "🏷️" },
  { name: "Aluguel recebido", kind: "INCOME", color: "#7E22CE", icon: "🏠" },
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
