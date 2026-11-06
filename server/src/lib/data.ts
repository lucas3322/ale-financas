import { prisma } from "./db.js";
import { buildOccurrences, type Occurrence, type TxWithRefs } from "./engine.js";

export async function loadGroup(groupId: string) {
  const [txs, states, cards, members] = await Promise.all([
    prisma.transaction.findMany({
      where: { groupId },
      include: { card: true, category: { include: { parent: true } }, person: { select: { id: true, name: true } } },
    }),
    prisma.txOccurrence.findMany({ where: { transaction: { groupId } } }),
    prisma.card.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } }),
    prisma.membership.findMany({ where: { groupId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  return { txs: txs as TxWithRefs[], states, cards, members: members.map((m) => m.user) };
}

export type GroupData = Awaited<ReturnType<typeof loadGroup>>;

export function occurrencesFor(data: GroupData, from: number, to: number, includeSkipped = false) {
  return buildOccurrences(data.txs, data.states, from, to, { includeSkipped });
}

export function serializeOcc(o: Occurrence) {
  const t = o.tx;
  return {
    transactionId: o.transactionId,
    month: o.month,
    day: o.day,
    dueDate: o.dueDate,
    installmentLabel: o.installmentLabel,
    amountCents: o.amountCents,
    overridden: o.overridden,
    paid: o.paid,
    skipped: o.skipped,
    type: t.type,
    description: t.description,
    isSalary: t.isSalary,
    recurrence: t.recurrence,
    totalMonths: t.totalMonths,
    amountMode: t.amountMode,
    percentBp: t.percentBp,
    percentBase: t.percentBase,
    percentBaseTxId: t.percentBaseTxId,
    paymentMethod: t.paymentMethod,
    date: t.date.toISOString().slice(0, 10),
    category: t.category
      ? {
          id: t.category.id,
          name: t.category.name,
          color: t.category.color,
          icon: t.category.icon,
          parent: t.category.parent
            ? { id: t.category.parent.id, name: t.category.parent.name, color: t.category.parent.color, icon: t.category.parent.icon }
            : null,
        }
      : null,
    person: t.person ? { id: t.person.id, name: t.person.name } : null,
    card: t.card ? { id: t.card.id, name: t.card.name, color: t.card.color } : null,
  };
}

export function sumBy(occs: Occurrence[], pred: (o: Occurrence) => boolean) {
  return occs.reduce((s, o) => (pred(o) ? s + o.amountCents : s), 0);
}
