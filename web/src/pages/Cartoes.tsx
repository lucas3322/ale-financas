import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Empty, Field, Modal, MonthSwitcher, MoneyInput, PageLoading, Progress, cx, useMonth } from "../components/ui";
import { useLayout } from "../layouts/AppLayout";
import { api } from "../lib/api";
import { firstName, money, monthLabel } from "../lib/format";
import { useAction, useCards, useMe } from "../lib/queries";
import type { Card, CardSummary } from "../lib/types";
import { moneyRule, required, useFormValidation, type Rules } from "../lib/validation";

const COLORS = ["#820AD1", "#1B1530", "#EC7000", "#CC092F", "#0B6BCB", "#00A868", "#F5B700", "#E91E63", "#5B5470", "#0EA5E9"];

export default function Cartoes() {
  const { month } = useMonth();
  const { openTx } = useLayout();
  const { data: cards = [] } = useCards();
  const [edit, setEdit] = useState<Partial<Card> | null>(null);
  const q = useQuery({ queryKey: ["cards-summary", month], queryFn: () => api.get<CardSummary[]>(`/cards/summary?month=${month}`) });
  const payInvoice = useAction(
    (p: { id: string; paid: boolean }) => api.post(`/cards/${p.id}/pay-invoice`, { month, paid: p.paid }),
    "Fatura atualizada",
  );
  const archived = cards.filter((c) => c.archived);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cartões</h1>
          <p className="text-sm text-ink-soft">Limite comprometido e fatura de cada mês</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher />
          <button className="btn-primary" onClick={() => setEdit({})}><Plus size={16} /> <span className="hidden sm:inline">Novo cartão</span></button>
        </div>
      </div>

      {q.isLoading || !q.data ? (
        <PageLoading />
      ) : q.data.length === 0 ? (
        <div className="card">
          <Empty icon="💳" title="Nenhum cartão cadastrado" text="Cadastre o limite, o dia de fechamento e o de vencimento. Compras no cartão já comprometem o limite no mês da compra."
            action={<button className="btn-primary" onClick={() => setEdit({})}><Plus size={16} /> Cadastrar cartão</button>} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((c) => {
            const full = cards.find((x) => x.id === c.id);
            const allPaid = !!c.items?.length && c.items.every((i) => i.paid);
            return (
              <section key={c.id} className="card overflow-hidden">
                <div className="relative p-5 text-white" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}CC 60%, #1B1530)` }}>
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-extrabold">{c.name}</p>
                      <p className="text-xs text-white/70">
                        Fecha dia {c.closingDay} · vence dia {c.dueDay}
                        {full?.owner && ` · ${firstName(full.owner.name)}`}
                      </p>
                    </div>
                    <button className="rounded-lg bg-white/15 p-2 hover:bg-white/25" onClick={() => full && setEdit(full)} aria-label={`Editar ${c.name}`}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-white/70">Disponível</p>
                      <p className={cx("text-2xl font-extrabold tabular", c.availableCents < 0 && "text-rose-200")}>{money(c.availableCents)}</p>
                    </div>
                    <p className="text-xs text-white/70">de {money(c.limitCents)}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (c.committedCents / Math.max(1, c.limitCents)) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-white/70">Comprometido: {money(c.committedCents)} (inclui parcelas futuras)</p>
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ink-faint">Fatura de {monthLabel(month, { year: false })}</p>
                      <p className="text-lg font-extrabold tabular">{money(c.invoiceCents)}</p>
                    </div>
                    {!!c.items?.length && (
                      <button
                        className={cx(allPaid ? "btn-ghost text-emerald-600" : "btn-outline")}
                        disabled={payInvoice.isPending}
                        onClick={() => payInvoice.mutate({ id: c.id, paid: !allPaid })}
                      >
                        <CheckCircle2 size={16} /> {allPaid ? "Fatura paga" : "Marcar fatura paga"}
                      </button>
                    )}
                  </div>
                  {c.items?.length ? (
                    <ul className="divide-y divide-brand-950/[0.05]">
                      {c.items.map((o) => (
                        <li key={o.transactionId}>
                          <button className="flex w-full items-center gap-2 py-2 text-left text-sm"
                            onClick={() => openTx({ id: o.transactionId, fromMonth: o.month, recurrence: o.recurrence })}>
                            <span className="w-5 text-center">{o.category?.icon ?? "🛍️"}</span>
                            <span className={cx("min-w-0 flex-1 truncate", o.paid && "text-ink-faint line-through")}>
                              {o.description} {o.installmentLabel && <span className="text-ink-faint">{o.installmentLabel}</span>}
                            </span>
                            <span className="font-semibold tabular">{money(o.amountCents)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-3 text-center text-sm text-ink-faint">Nenhuma compra nesta fatura.</p>
                  )}
                  <button className="btn-ghost mt-2 w-full" onClick={() => openTx({ type: "EXPENSE", paymentMethod: "CARD", cardId: c.id })}>
                    <Plus size={15} /> Lançar compra neste cartão
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Arquivados</p>
          <div className="flex flex-wrap gap-2">
            {archived.map((c) => (
              <button key={c.id} className="btn-outline" onClick={() => setEdit(c)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {edit && <CardModal card={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

type CardForm = { name: string; limitCents: number; closingDay: string; dueDay: string; color: string; ownerId: string };

function dayRule(label: string) {
  return (v: string) => {
    const n = Number(v);
    if (!v) return `Informe o dia de ${label}`;
    if (!Number.isInteger(n) || n < 1 || n > 31) return "Use um dia entre 1 e 31";
    return null;
  };
}

const cardRules: Rules<CardForm> = {
  name: (v) => required("Dê um nome ao cartão")(v) || (v.length > 40 ? "Máximo de 40 caracteres" : null),
  limitCents: moneyRule("o limite"),
  closingDay: dayRule("fechamento"),
  dueDay: dayRule("vencimento"),
};

function CardModal({ card, onClose }: { card: Partial<Card>; onClose: () => void }) {
  const { data: me } = useMe();
  const isEdit = !!card.id;
  const [f, setF] = useState<CardForm>({
    name: card.name ?? "",
    limitCents: card.limitCents ?? 0,
    closingDay: String(card.closingDay ?? ""),
    dueDay: String(card.dueDay ?? ""),
    color: card.color ?? COLORS[0],
    ownerId: card.ownerId ?? "",
  });
  const set = <K extends keyof CardForm>(k: K, val: CardForm[K]) => setF((s) => ({ ...s, [k]: val }));
  const v = useFormValidation(f, cardRules);

  const body = () => ({
    name: f.name.trim(), limitCents: f.limitCents, closingDay: Number(f.closingDay), dueDay: Number(f.dueDay),
    color: f.color, ownerId: f.ownerId || null,
  });
  const save = useAction(
    () => (isEdit ? api.patch(`/cards/${card.id}`, body()) : api.post("/cards", body())),
    isEdit ? "Cartão atualizado" : "Cartão cadastrado",
    onClose,
    v.applyServerError,
  );
  const archive = useAction(() => api.patch(`/cards/${card.id}`, { archived: !card.archived }), card.archived ? "Cartão reativado" : "Cartão arquivado", onClose);
  const remove = useAction(() => api.del(`/cards/${card.id}`), "Cartão excluído", onClose);

  const sameDay = f.closingDay && f.closingDay === f.dueDay;

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar cartão" : "Novo cartão"}>
      <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
        <Field label="Nome do cartão" error={v.error("name")}>
          <input className="field" autoFocus={!isEdit} maxLength={40} placeholder="Ex.: Nubank Lucas, Itaú, Mais" {...v.bind("name")} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Limite total" error={v.error("limitCents")}>
          <MoneyInput {...v.bind("limitCents")} value={f.limitCents} onChange={(c) => set("limitCents", c)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento" error={v.error("closingDay")} hint="Compras depois desse dia vão para a fatura seguinte">
            <input className="field" inputMode="numeric" maxLength={2} placeholder="25" {...v.bind("closingDay")} value={f.closingDay}
              onChange={(e) => set("closingDay", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Dia de vencimento" error={v.error("dueDay")}>
            <input className="field" inputMode="numeric" maxLength={2} placeholder="5" {...v.bind("dueDay")} value={f.dueDay}
              onChange={(e) => set("dueDay", e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        {sameDay && <p className="-mt-2 text-xs text-amber-700">Fechamento e vencimento no mesmo dia é incomum — confira na fatura.</p>}
        <Field label="Titular" optional>
          <select className="field" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">Compartilhado</option>
            {me?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <div>
          <span className="label">Cor</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Cor ${c}`}
                className={cx("h-8 w-8 rounded-full ring-offset-2 transition", f.color === c && "ring-2 ring-brand-500")} style={{ background: c }} />
            ))}
          </div>
        </div>
        {f.limitCents > 0 && (
          <div className="rounded-2xl bg-brand-50/60 p-3">
            <Progress value={0} max={f.limitCents} color={f.color} />
            <p className="mt-1 text-xs text-ink-soft">Limite de {money(f.limitCents)}</p>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
          {isEdit && (
            <div className="flex gap-1 sm:mr-auto">
              <button type="button" className="btn-ghost" disabled={archive.isPending} onClick={() => archive.mutate(undefined)}>
                {card.archived ? "Reativar" : "Arquivar"}
              </button>
              <button type="button" className="btn-danger" disabled={remove.isPending}
                onClick={() => confirm("Excluir o cartão? As compras feitas nele continuam nos lançamentos, mas sem cartão vinculado. Prefira arquivar se ele só foi cancelado.") && remove.mutate(undefined)}>
                Excluir
              </button>
            </div>
          )}
          <button type="submit" className="btn-primary sm:min-w-[140px]" disabled={save.isPending}>{save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar"}</button>
        </div>
      </form>
    </Modal>
  );
}
