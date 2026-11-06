import { prisma } from "./db.js";
import { badRequest } from "./http.js";

/** Garante que ids referenciados pertencem ao grupo ativo. */
export async function assertRefs(
  groupId: string,
  refs: { categoryId?: string | null; cardId?: string | null; personId?: string | null },
) {
  const checks: Promise<void>[] = [];
  if (refs.categoryId)
    checks.push(
      prisma.category.count({ where: { id: refs.categoryId, groupId } }).then((n) => {
        if (!n) throw badRequest("Categoria inválida");
      }),
    );
  if (refs.cardId)
    checks.push(
      prisma.card.count({ where: { id: refs.cardId, groupId } }).then((n) => {
        if (!n) throw badRequest("Cartão inválido");
      }),
    );
  if (refs.personId)
    checks.push(
      prisma.membership.count({ where: { userId: refs.personId, groupId } }).then((n) => {
        if (!n) throw badRequest("Pessoa não faz parte do grupo");
      }),
    );
  await Promise.all(checks);
}
