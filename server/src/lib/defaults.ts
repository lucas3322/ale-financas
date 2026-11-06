import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type Def = Pick<Prisma.CategoryCreateManyInput, "name" | "kind" | "color" | "icon">;

/** Ícones do Iconify (Phosphor duotone); marcas usam o set simple-icons. */
const DEFAULT_CATEGORIES: Def[] = [
  { name: "Salário", kind: "INCOME", color: "#16A34A", icon: "ph:briefcase-duotone" },
  { name: "Renda extra", kind: "INCOME", color: "#0EA5E9", icon: "ph:sparkle-duotone" },
  { name: "Moradia", kind: "EXPENSE", color: "#8A05BE", icon: "ph:house-line-duotone" },
  { name: "Mercado", kind: "EXPENSE", color: "#F59E0B", icon: "ph:shopping-cart-duotone" },
  { name: "Transporte", kind: "EXPENSE", color: "#3B82F6", icon: "ph:car-profile-duotone" },
  { name: "Saúde", kind: "EXPENSE", color: "#EF4444", icon: "ph:heartbeat-duotone" },
  { name: "Educação", kind: "EXPENSE", color: "#6366F1", icon: "ph:graduation-cap-duotone" },
  { name: "Contas da casa", kind: "EXPENSE", color: "#14B8A6", icon: "ph:lightbulb-duotone" },
  { name: "Dízimo e doações", kind: "EXPENSE", color: "#A855F7", icon: "ph:hand-heart-duotone" },
  { name: "Empréstimos", kind: "EXPENSE", color: "#DC2626", icon: "ph:bank-duotone" },
  { name: "Cartão de crédito", kind: "EXPENSE", color: "#C026D3", icon: "ph:credit-card-duotone" },
  { name: "Filhos", kind: "EXPENSE", color: "#EC4899", icon: "ph:baby-duotone" },
  { name: "Lazer", kind: "EXPENSE", color: "#F97316", icon: "ph:confetti-duotone" },
  { name: "Impostos", kind: "EXPENSE", color: "#64748B", icon: "ph:receipt-duotone" },
  { name: "Reserva / Guardar", kind: "EXPENSE", color: "#22C55E", icon: "ph:piggy-bank-duotone" },
  { name: "Outros", kind: "EXPENSE", color: "#94A3B8", icon: "ph:package-duotone" },
  { name: "Internet e telefone", kind: "EXPENSE", color: "#0EA5E9", icon: "ph:wifi-high-duotone" },
  { name: "Energia", kind: "EXPENSE", color: "#EAB308", icon: "ph:lightning-duotone" },
  { name: "Água", kind: "EXPENSE", color: "#38BDF8", icon: "ph:drop-duotone" },
  { name: "Gás", kind: "EXPENSE", color: "#F97316", icon: "ph:fire-duotone" },
  { name: "Aluguel", kind: "EXPENSE", color: "#9333EA", icon: "ph:key-duotone" },
  { name: "Condomínio", kind: "EXPENSE", color: "#7C3AED", icon: "ph:buildings-duotone" },
  { name: "Financiamento", kind: "EXPENSE", color: "#B91C1C", icon: "ph:hand-coins-duotone" },
  { name: "Casa e móveis", kind: "EXPENSE", color: "#8B5CF6", icon: "ph:couch-duotone" },
  { name: "Manutenção da casa", kind: "EXPENSE", color: "#78716C", icon: "ph:wrench-duotone" },
  { name: "Assinaturas e streaming", kind: "EXPENSE", color: "#E11D48", icon: "ph:monitor-play-duotone" },
  { name: "Restaurante e delivery", kind: "EXPENSE", color: "#F59E0B", icon: "ph:hamburger-duotone" },
  { name: "Farmácia", kind: "EXPENSE", color: "#EF4444", icon: "ph:pill-duotone" },
  { name: "Plano de saúde", kind: "EXPENSE", color: "#DC2626", icon: "ph:first-aid-kit-duotone" },
  { name: "Academia", kind: "EXPENSE", color: "#10B981", icon: "ph:barbell-duotone" },
  { name: "Combustível", kind: "EXPENSE", color: "#EA580C", icon: "ph:gas-pump-duotone" },
  { name: "Uber e apps", kind: "EXPENSE", color: "#334155", icon: "ph:taxi-duotone" },
  { name: "Seguros", kind: "EXPENSE", color: "#475569", icon: "ph:shield-check-duotone" },
  { name: "Pets", kind: "EXPENSE", color: "#A16207", icon: "ph:dog-duotone" },
  { name: "Roupas", kind: "EXPENSE", color: "#DB2777", icon: "ph:t-shirt-duotone" },
  { name: "Beleza e cuidados", kind: "EXPENSE", color: "#F472B6", icon: "ph:flower-lotus-duotone" },
  { name: "Presentes", kind: "EXPENSE", color: "#C026D3", icon: "ph:gift-duotone" },
  { name: "Viagem", kind: "EXPENSE", color: "#0284C7", icon: "ph:airplane-tilt-duotone" },
  { name: "Investimentos", kind: "EXPENSE", color: "#16A34A", icon: "ph:chart-line-up-duotone" },
  { name: "Tarifas bancárias", kind: "EXPENSE", color: "#64748B", icon: "ph:coins-duotone" },
  { name: "Freelance", kind: "INCOME", color: "#0891B2", icon: "ph:laptop-duotone" },
  { name: "13º salário", kind: "INCOME", color: "#15803D", icon: "ph:calendar-star-duotone" },
  { name: "Férias", kind: "INCOME", color: "#22C55E", icon: "ph:island-duotone" },
  { name: "Reembolso", kind: "INCOME", color: "#14B8A6", icon: "ph:arrow-u-up-left-duotone" },
  { name: "Rendimentos", kind: "INCOME", color: "#059669", icon: "ph:trend-up-duotone" },
  { name: "Vendas", kind: "INCOME", color: "#D97706", icon: "ph:tag-duotone" },
  { name: "Aluguel recebido", kind: "INCOME", color: "#7E22CE", icon: "ph:house-simple-duotone" },
];

/** Subcategorias de streaming, com o logo real de cada serviço. */
export const STREAMING_PARENT = "Assinaturas e streaming";
const STREAMING_SUBS: Omit<Def, "kind">[] = [
  { name: "Netflix", color: "#E50914", icon: "simple-icons:netflix" },
  { name: "Prime Video", color: "#00A8E1", icon: "simple-icons:primevideo" },
  { name: "HBO Max", color: "#5822B4", icon: "simple-icons:hbomax" },
  { name: "Disney+", color: "#113CCF", icon: "ph:film-slate-duotone" },
  { name: "Globoplay", color: "#FB0234", icon: "ph:television-simple-duotone" },
  { name: "Paramount+", color: "#0064FF", icon: "simple-icons:paramountplus" },
  { name: "Apple TV+", color: "#111111", icon: "simple-icons:appletv" },
  { name: "Crunchyroll", color: "#F47521", icon: "simple-icons:crunchyroll" },
  { name: "Funimation", color: "#5B0BB5", icon: "simple-icons:funimation" },
  { name: "Bilibili", color: "#00A1D6", icon: "simple-icons:bilibili" },
  { name: "Spotify", color: "#1DB954", icon: "simple-icons:spotify" },
  { name: "YouTube Premium", color: "#FF0000", icon: "simple-icons:youtube" },
  { name: "Deezer", color: "#A238FF", icon: "simple-icons:deezer" },
  { name: "PlayStation Plus", color: "#0070D1", icon: "simple-icons:playstation" },
  { name: "Xbox Game Pass", color: "#107C10", icon: "simple-icons:xbox" },
  { name: "Nintendo Switch Online", color: "#E60012", icon: "simple-icons:nintendoswitch" },
  { name: "Outros", color: "#64748B", icon: "ph:monitor-play-duotone" },
];

export async function createGroupForUser(userId: string, name: string) {
  return prisma.$transaction(async (db) => {
    const group = await db.group.create({ data: { name } });
    await db.membership.create({ data: { userId, groupId: group.id, role: "OWNER" } });
    await db.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, groupId: group.id })) });
    // Empréstimo de amigos/família (ex.: alguém que emprestou e vocês pagam em parcelas).
    const loans = await db.category.findFirst({ where: { groupId: group.id, name: "Empréstimos" } });
    if (loans) {
      await db.category.create({
        data: { groupId: group.id, parentId: loans.id, kind: "EXPENSE", name: "Pessoas", color: "#DC2626", icon: "ph:user-duotone" },
      });
    }
    const parent = await db.category.findFirst({ where: { groupId: group.id, name: STREAMING_PARENT } });
    if (parent) {
      await db.category.createMany({
        data: STREAMING_SUBS.map((c) => ({ ...c, kind: "EXPENSE" as const, groupId: group.id, parentId: parent.id })),
      });
    }
    await db.user.update({ where: { id: userId }, data: { activeGroupId: group.id } });
    return group;
  });
}
