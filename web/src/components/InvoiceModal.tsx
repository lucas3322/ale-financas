import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { addMonths, METHOD_LABEL, firstName, money, monthLabel, monthTitle } from "../lib/format";
import { useAction } from "../lib/queries";
import type { CardSummary, Occ } from "../lib/types";
import { Modal, Spinner, cx } from "./ui";

/**
 * Detalhe de uma fatura específica do cartão, sem mudar o mês da tela.
 * As setas navegam entre faturas dentro da própria modal.
 */
export function InvoiceModal({ cardId, month: initialMonth, onClose, onEditItem }: {
  cardId: string; month: string; onClose: () => void; onEditItem: (o: Occ) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const q = useQuery({
    queryKey: ["cards-summary", month],
    queryFn: () => api.get<CardSummary[]>(`/cards/summary?month=${month}`),
    placeholderData: keepPreviousData,
  });
  const card = q.data?.find((c) => c.id === cardId);
  const items = card?.items ?? [];
  const allPaid = items.length > 0 && items.every((i) => i.paid);
  const pay = useAction(
    (paid: boolean) => api.post(`/cards/${cardId}/pay-invoice`, { month, paid }),
    "Fatura atualizada",
  );

  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const dueDate = card ? `${String(Math.min(card.dueDay, lastDay)).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}` : "";
  const installments = items.filter((i) => i.installmentLabel);
  const recurring = items.filter((i) => i.recurrence === "MONTHLY");

  return (
    <Modal open onClose={onClose} title={card ? `Fatura · ${card.name}` : "Fatura"}>
      <div className="space-y-4">
        {/* Navegação entre faturas */}
        <div className="flex items-center justify-between rounded-2xl bg-brand-50/70 p-1.5">
          <button className="btn-ghost !p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Fatura anterior"><ChevronLeft size={18} /></button>
          <div className="text-center">
            <p className="text-sm font-bold">{monthTitle(month)}</p>
            {card && <p className="text-[11px] text-ink-soft">vence em {dueDate}</p>}
          </div>
          <button className="btn-ghost !p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próxima fatura"><ChevronRight size={18} /></button>
        </div>

        {!card ? (
          <div className="grid place-items-center py-10"><Spinner /></div>
        ) : (
          <div className={cx("space-y-4 transition-opacity duration-150", q.isFetching && "opacity-60")}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink-faint">Total da fatura</p>
                <p className="text-3xl font-extrabold tracking-tight tabular">{money(card.invoiceCents)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {items.length} {items.length === 1 ? "lançamento" : "lançamentos"}
                  {installments.length > 0 && ` · ${installments.length} parcela${installments.length > 1 ? "s" : ""}`}
                  {recurring.length > 0 && ` · ${recurring.length} recorrente${recurring.length > 1 ? "s" : ""}`}
                </p>
              </div>
              {items.length > 0 && (
                <button className={cx(allPaid ? "btn-ghost text-emerald-600" : "btn-primary")} disabled={pay.isPending} onClick={() => pay.mutate(!allPaid)}>
                  <CheckCircle2 size={16} /> {allPaid ? "Fatura paga · desfazer" : "Marcar fatura paga"}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="rounded-2xl bg-brand-950/[0.03] py-8 text-center text-sm text-ink-faint">Nenhuma compra nesta fatura.</p>
            ) : (
              <ul className="divide-y divide-brand-950/[0.05] rounded-2xl border border-brand-950/[0.06]">
                {items.map((o) => (
                  <li key={o.transactionId}>
                    <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-brand-50/50"
                      onClick={() => onEditItem(o)}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm" style={{ background: `${o.category?.color ?? "#94A3B8"}1F` }}>
                        {o.category?.icon ?? "🛍️"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx("block truncate text-sm font-semibold", o.paid && "text-ink-faint line-through")}>
                          {o.description}
                          {o.installmentLabel && <span className="ml-1.5 chip bg-brand-50 text-brand-700">{o.installmentLabel}</span>}
                        </span>
                        <span className="block truncate text-[11px] text-ink-faint">
                          compra em {new Date(`${o.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          {o.person ? ` · ${firstName(o.person.name)}` : " · Casa"}
                          {o.category && ` · ${o.category.name}`}
                          {o.recurrence === "MONTHLY" && " · todo mês"}
                          {o.paymentMethod && o.paymentMethod !== "CARD" && ` · ${METHOD_LABEL[o.paymentMethod]}`}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular">{money(o.amountCents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brand-950/[0.03] p-3 text-xs">
              <div>
                <p className="text-ink-faint">Limite comprometido em {monthLabel(month, { year: false })}</p>
                <p className="font-bold tabular">{money(card.committedCents)}</p>
              </div>
              <div>
                <p className="text-ink-faint">Disponível</p>
                <p className={cx("font-bold tabular", card.availableCents < 0 && "text-rose-600")}>{money(card.availableCents)}</p>
              </div>
            </div>
            <p className="text-[11px] text-ink-faint">Clique numa compra para editar. As setas mostram as outras faturas sem mudar o mês da tela.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
