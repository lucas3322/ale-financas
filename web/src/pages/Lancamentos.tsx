import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, MoreVertical, Pencil, Plus, Repeat, Search, SkipForward, Undo2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Empty, Field, MenuItem, Modal, MonthSwitcher, MoneyInput, PageLoading, Popover, Segmented, cx, useMonth } from "../components/ui";
import { InvoiceModal } from "../components/InvoiceModal";
import { useLayout } from "../layouts/AppLayout";
import { api } from "../lib/api";
import { AppIcon, CategoryIcon, PaymentTag } from "../components/AppIcon";
import { firstName, money, monthLabel } from "../lib/format";
import { useAction, useMe } from "../lib/queries";
import type { Occ, Totals, Transaction } from "../lib/types";
import { moneyRule, useFormValidation } from "../lib/validation";

type MonthData = { month: string; totals: Totals; items: Occ[] };
type Filter = { q: string; type: "ALL" | "INCOME" | "EXPENSE"; status: "ALL" | "PENDING" | "PAID"; person: string };

export default function Lancamentos() {
  const [tab, setTab] = useState<"month" | "fixed">("month");
  const { openTx } = useLayout();
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Lançamentos</h1>
        <div className="flex items-center gap-2">
          {tab === "month" && <MonthSwitcher />}
          <button className="btn-primary hidden sm:inline-flex" onClick={() => openTx()}><Plus size={16} /> Novo</button>
        </div>
      </div>
      <div className="mb-4 max-w-sm">
        <Segmented value={tab} onChange={setTab} options={[{ value: "month", label: "Do mês" }, { value: "fixed", label: "Fixos e parcelados" }]} />
      </div>
      {tab === "month" ? <MonthView /> : <FixedView />}
    </div>
  );
}

function MonthView() {
  const { month } = useMonth();
  const { data: me } = useMe();
  const { openTx } = useLayout();
  const [filter, setFilter] = useState<Filter>({ q: "", type: "ALL", status: "ALL", person: "" });
  const [adjust, setAdjust] = useState<Occ | null>(null);
  const [invoice, setInvoice] = useState<{ cardId: string; month: string } | null>(null);
  const payInvoice = useAction(
    (p: { cardId: string; paid: boolean }) => api.post(`/cards/${p.cardId}/pay-invoice`, { month, paid: p.paid }),
    "Fatura atualizada",
  );
  const q = useQuery({ queryKey: ["month", month], queryFn: () => api.get<MonthData>(`/months/${month}`) });

  const setOcc = useAction((p: { o: Occ; patch: Partial<Pick<Occ, "paid" | "skipped">> & { amountCents?: number | null } }) =>
    api.put("/occurrences", { transactionId: p.o.transactionId, month: p.o.month, ...p.patch }),
  );

  const items = useMemo(() => {
    const term = filter.q.trim().toLowerCase();
    return (q.data?.items ?? []).filter((o) =>
      (filter.type === "ALL" || o.type === filter.type) &&
      (filter.status === "ALL" || (filter.status === "PAID" ? o.paid : !o.paid && !o.skipped)) &&
      (!filter.person || (filter.person === "shared" ? !o.person : o.person?.id === filter.person)) &&
      (!term || o.description.toLowerCase().includes(term) || o.category?.name.toLowerCase().includes(term)),
    );
  }, [q.data, filter]);

  if (q.isLoading || !q.data) return <PageLoading />;
  const t = q.data.totals;
  const incomes = items.filter((o) => o.type === "INCOME");
  const expenses = items.filter((o) => o.type === "EXPENSE");
  const filtered = filter.q || filter.type !== "ALL" || filter.status !== "ALL" || filter.person;

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {month === t.today.slice(0, 7) ? (
          <>
            <Stat label="Entradas até hoje" value={t.realizedIncomeCents} tone="text-emerald-600"
              sub={t.scheduledIncomeCents ? `+ ${money(t.scheduledIncomeCents)} a receber` : undefined} />
            <Stat label="Saídas até hoje" value={t.realizedExpenseCents} tone="text-rose-600"
              sub={t.scheduledExpenseCents ? `+ ${money(t.scheduledExpenseCents)} agendado` : undefined} />
            <Stat label="Saldo de hoje" value={t.realizedNetCents} tone={t.realizedNetCents < 0 ? "text-rose-600" : "text-brand-700"}
              sub={`Previsto no mês: ${money(t.netCents)}`} />
          </>
        ) : (
          <>
            <Stat label="Entradas" value={t.incomeCents} tone="text-emerald-600" />
            <Stat label="Saídas" value={t.expenseCents} tone="text-rose-600" />
            <Stat label={month > t.today.slice(0, 7) ? "Sobra prevista" : "Sobra"} value={t.netCents} tone={t.netCents < 0 ? "text-rose-600" : "text-brand-700"} />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="field pl-9" placeholder="Buscar descrição ou categoria" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </div>
        <select className="field !w-auto" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value as Filter["type"] })} aria-label="Tipo">
          <option value="ALL">Entradas e saídas</option>
          <option value="INCOME">Só entradas</option>
          <option value="EXPENSE">Só saídas</option>
        </select>
        <select className="field !w-auto" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as Filter["status"] })} aria-label="Situação">
          <option value="ALL">Todas</option>
          <option value="PENDING">A pagar / receber</option>
          <option value="PAID">Pagas / recebidas</option>
        </select>
        <select className="field !w-auto" value={filter.person} onChange={(e) => setFilter({ ...filter, person: e.target.value })} aria-label="Pessoa">
          <option value="">Todos</option>
          {me?.members.map((m) => <option key={m.id} value={m.id}>{firstName(m.name)}</option>)}
          <option value="shared">Casa</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card">
          {filtered ? (
            <Empty icon="ph:magnifying-glass-duotone" title="Nada encontrado" text="Nenhum lançamento bate com os filtros."
              action={<button className="btn-outline" onClick={() => setFilter({ q: "", type: "ALL", status: "ALL", person: "" })}>Limpar filtros</button>} />
          ) : (
            <Empty icon="ph:calendar-blank-duotone" title={`Nada em ${monthLabel(month)}`} text="Adicione salários, contas e compras deste mês."
              action={<button className="btn-primary" onClick={() => openTx()}><Plus size={16} /> Novo lançamento</button>} />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {incomes.length > 0 && (
            <OccList title="Entradas" today={t.today} items={incomes} onToggle={(o) => setOcc.mutate({ o, patch: { paid: !o.paid } })}
              onEdit={(o) => openTx({ id: o.transactionId, fromMonth: o.month, recurrence: o.recurrence })}
              onAdjust={setAdjust} onSkip={(o) => setOcc.mutate({ o, patch: { skipped: !o.skipped } })} />
          )}
          {expenses.length > 0 && (
            <OccList title="Saídas" today={t.today} items={expenses}
              // Compras no cartão viram uma linha por fatura; ao buscar, mostra cada compra para achar o que procura.
              groupCards={!filter.q.trim()}
              onOpenInvoice={(cardId) => setInvoice({ cardId, month })}
              onPayInvoice={(cardId, paid) => payInvoice.mutate({ cardId, paid })}
              onToggle={(o) => setOcc.mutate({ o, patch: { paid: !o.paid } })}
              onEdit={(o) => openTx({ id: o.transactionId, fromMonth: o.month, recurrence: o.recurrence })}
              onAdjust={setAdjust} onSkip={(o) => setOcc.mutate({ o, patch: { skipped: !o.skipped } })} />
          )}
        </div>
      )}

      <AdjustModal occ={adjust} onClose={() => setAdjust(null)} />
      {invoice && (
        <InvoiceModal cardId={invoice.cardId} month={invoice.month} onClose={() => setInvoice(null)}
          onEditItem={(o) => { setInvoice(null); openTx({ id: o.transactionId, fromMonth: o.month, recurrence: o.recurrence }); }} />
      )}
    </>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="text-[11px] font-semibold text-ink-faint sm:text-xs">{label}</p>
      <p className={cx("mt-0.5 truncate text-sm font-extrabold tabular sm:text-lg", tone)}>{money(value)}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] font-medium text-ink-faint sm:text-[11px]">{sub}</p>}
    </div>
  );
}

type InvoiceGroup = { card: NonNullable<Occ["card"]>; items: Occ[]; total: number; day: number; dueDate: string; paid: boolean; paidCount: number };
type Row = { kind: "occ"; o: Occ } | { kind: "invoice"; g: InvoiceGroup };

function OccList({ title, today, items, groupCards, onOpenInvoice, onPayInvoice, onToggle, onEdit, onAdjust, onSkip }: {
  title: string; today: string; items: Occ[]; groupCards?: boolean;
  onOpenInvoice?: (cardId: string) => void; onPayInvoice?: (cardId: string, paid: boolean) => void;
  onToggle: (o: Occ) => void; onEdit: (o: Occ) => void; onAdjust: (o: Occ) => void; onSkip: (o: Occ) => void;
}) {
  const total = items.filter((o) => !o.skipped).reduce((s, o) => s + o.amountCents, 0);
  const rows = useMemo<Row[]>(() => {
    if (!groupCards) return items.map((o) => ({ kind: "occ", o }));
    const groups = new Map<string, InvoiceGroup>();
    const out: Row[] = [];
    for (const o of items) {
      if (o.paymentMethod === "CARD" && o.card) {
        let g = groups.get(o.card.id);
        if (!g) {
          g = { card: o.card, items: [], total: 0, day: o.day, dueDate: o.dueDate, paid: true, paidCount: 0 };
          groups.set(o.card.id, g);
          out.push({ kind: "invoice", g });
        }
        g.items.push(o);
        if (!o.skipped) g.total += o.amountCents;
        if (o.paid) g.paidCount++;
        g.paid = g.paid && o.paid;
      } else {
        out.push({ kind: "occ", o });
      }
    }
    // Mantém a ordem por dia de vencimento, com a fatura no dia em que vence.
    const dayOf = (r: Row) => (r.kind === "occ" ? r.o.day : r.g.day);
    return out.sort((a, b) => dayOf(a) - dayOf(b));
  }, [items, groupCards]);

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-brand-950/[0.05] px-4 py-3">
        <h2 className="font-bold">{title} <span className="ml-1 text-xs font-semibold text-ink-faint">{rows.length}</span></h2>
        <p className="text-sm font-bold tabular">{money(total)}</p>
      </div>
      <ul className="divide-y divide-brand-950/[0.05]">
        {rows.map((r) =>
          r.kind === "occ" ? (
            <OccRow key={r.o.transactionId} o={r.o} today={today} onToggle={onToggle} onEdit={onEdit} onAdjust={onAdjust} onSkip={onSkip} />
          ) : (
            <InvoiceRow key={`inv-${r.g.card.id}`} g={r.g} today={today}
              onOpen={() => onOpenInvoice?.(r.g.card.id)} onPay={(paid) => onPayInvoice?.(r.g.card.id, paid)} />
          ),
        )}
      </ul>
    </section>
  );
}

/** Uma linha por fatura de cartão: total, vencimento e quantas compras. Clique mostra o detalhe. */
function InvoiceRow({ g, today, onOpen, onPay }: { g: InvoiceGroup; today: string; onOpen: () => void; onPay: (paid: boolean) => void }) {
  const people = [...new Set(g.items.map((o) => (o.person ? firstName(o.person.name) : "Casa")))];
  const installments = g.items.filter((o) => o.installmentLabel).length;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onPay(!g.paid)}
        aria-label={g.paid ? `Desmarcar fatura ${g.card.name}` : `Marcar fatura ${g.card.name} como paga`}
        title={g.paid ? "Desmarcar fatura" : "Marcar fatura inteira como paga"}
        className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
          g.paid ? "border-emerald-500 bg-emerald-500 text-white" : "border-brand-200 text-transparent hover:border-brand-500 hover:text-brand-400")}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: g.card.color }}><AppIcon icon="ph:credit-card-duotone" size={19} /></div>
      <button className="min-w-0 flex-1 text-left" onClick={onOpen} aria-label={`Ver fatura ${g.card.name}`}>
        <p className={cx("truncate text-sm font-semibold", g.paid && "text-ink-soft line-through decoration-ink-faint/50")}>
          Fatura {g.card.name}
          <span className="ml-1.5 chip bg-brand-50 text-brand-700">{g.items.length} {g.items.length === 1 ? "compra" : "compras"}</span>
        </p>
        <p className="truncate text-xs text-ink-faint">
          vence dia {g.day} · {people.join(", ")}
          {installments > 0 && ` · ${installments} parcela${installments > 1 ? "s" : ""}`}
          {!g.paid && g.paidCount > 0 && ` · ${g.paidCount} de ${g.items.length} pagas`}
        </p>
        {!g.paid && g.dueDate > today && (
          <span className="chip mt-1 bg-sky-50 text-sky-700"><AppIcon icon="ph:calendar-dots-duotone" size={12} /> agendado · {new Date(`${g.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
        )}
        {!g.paid && g.dueDate < today && <span className="chip mt-1 bg-amber-50 text-amber-700"><AppIcon icon="ph:warning-duotone" size={12} /> vencido</span>}
      </button>
      <p className="text-right text-sm font-bold tabular">− {money(g.total)}</p>
      <button className="btn-ghost !p-1.5" onClick={onOpen} aria-label={`Detalhes da fatura ${g.card.name}`}><ChevronRight size={16} /></button>
    </li>
  );
}

function OccRow({ o, today, onToggle, onEdit, onAdjust, onSkip }: {
  o: Occ; today: string; onToggle: (o: Occ) => void; onEdit: (o: Occ) => void; onAdjust: (o: Occ) => void; onSkip: (o: Occ) => void;
}) {
  const income = o.type === "INCOME";
  const isRecurring = o.recurrence !== "ONCE";

  return (
    <li className={cx("flex items-center gap-3 px-4 py-3", o.skipped && "opacity-50")}>
      <button
        onClick={() => onToggle(o)}
        disabled={o.skipped}
        aria-label={o.paid ? "Desmarcar" : income ? "Marcar como recebido" : "Marcar como pago"}
        title={o.paid ? "Desmarcar" : income ? "Marcar como recebido" : "Marcar como pago"}
        className={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
          o.paid ? "border-emerald-500 bg-emerald-500 text-white" : "border-brand-200 text-transparent hover:border-brand-500 hover:text-brand-400",
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <CategoryIcon category={o.category} fallback={income ? "ph:money-duotone" : "ph:package-duotone"} />
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(o)}>
        <p className={cx("truncate text-sm font-semibold", o.paid && "text-ink-soft line-through decoration-ink-faint/50", o.skipped && "line-through")}>
          {o.description}
          {o.installmentLabel && <span className="ml-1.5 chip bg-brand-50 text-brand-700">{o.installmentLabel}</span>}
          {o.recurrence === "MONTHLY" && <Repeat size={12} className="ml-1.5 inline text-ink-faint" />}
        </p>
        <p className="truncate text-xs text-ink-faint">
          dia {o.day}
          {o.person ? ` · ${firstName(o.person.name)}` : " · Casa"}
          {(o.card || o.paymentMethod) && <> · <PaymentTag card={o.card} method={o.paymentMethod} /></>}
          {o.category?.parent && ` · ${o.category.parent.name} › ${o.category.name}`}
          {o.amountMode === "PERCENT" && ` · ${(o.percentBp ?? 0) / 100}% da renda`}
          {o.skipped && " · pulado neste mês"}
        </p>
        {!o.paid && !o.skipped && o.dueDate > today && (
          <span className="chip mt-1 bg-sky-50 text-sky-700" title="Ainda não entra no saldo de hoje">
            <AppIcon icon="ph:calendar-dots-duotone" size={12} /> {income ? "a receber" : "agendado"} · {new Date(`${o.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        )}
        {!o.paid && !o.skipped && !income && o.dueDate < today && (
          <span className="chip mt-1 bg-amber-50 text-amber-700" title="A data passou e não foi marcado como pago"><AppIcon icon="ph:warning-duotone" size={12} /> vencido</span>
        )}
      </button>
      <div className="text-right">
        <p className={cx("text-sm font-bold tabular", income ? "text-emerald-600" : "text-ink")}>
          {income ? "+" : "−"} {money(o.amountCents)}
        </p>
        {o.overridden && <p className="text-[10px] font-semibold text-amber-600">valor ajustado</p>}
      </div>
      <Popover trigger={(p) => (
        <button {...p} className="btn-ghost !p-1.5" aria-label={`Mais ações de ${o.description}`}><MoreVertical size={16} /></button>
      )}>
        {(close) => (
          <>
            {!o.skipped && (
              <MenuItem icon={Check} label={o.paid ? "Desmarcar" : income ? "Marcar como recebido" : "Marcar como pago"}
                onClick={() => { close(); onToggle(o); }} />
            )}
            <MenuItem icon={Pencil} label={isRecurring ? "Editar (este e próximos)" : "Editar"} onClick={() => { close(); onEdit(o); }} />
            {isRecurring && <MenuItem icon={Wallet} label="Mudar valor só deste mês" onClick={() => { close(); onAdjust(o); }} />}
            {isRecurring && (
              <MenuItem icon={o.skipped ? Undo2 : SkipForward} label={o.skipped ? "Voltar a cobrar neste mês" : "Pular só este mês"}
                onClick={() => { close(); onSkip(o); }} />
            )}
          </>
        )}
      </Popover>
    </li>
  );
}


/** Ajusta o valor de uma ocorrência só naquele mês (ex.: conta de luz veio diferente, salário teve bônus). */
function AdjustModal({ occ, onClose }: { occ: Occ | null; onClose: () => void }) {
  const [values, setValues] = useState({ amountCents: 0 });
  useEffect(() => { if (occ) setValues({ amountCents: occ.amountCents }); }, [occ]);
  const v = useFormValidation(values, { amountCents: moneyRule("o valor", { allowZero: true }) });
  const save = useAction(
    (amountCents: number | null) => api.put("/occurrences", { transactionId: occ!.transactionId, month: occ!.month, amountCents }),
    "Valor do mês atualizado",
    onClose,
    v.applyServerError,
  );
  if (!occ) return null;
  return (
    <Modal open onClose={onClose} title="Valor só deste mês">
      <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(values.amountCents); }}>
        <p className="text-sm text-ink-soft">
          <b className="text-ink">{occ.description}</b> em {monthLabel(occ.month)}. Os outros meses continuam com o valor normal.
          {occ.amountMode === "PERCENT" && " Isso substitui o cálculo pelo percentual apenas neste mês."}
        </p>
        <Field label="Valor neste mês" error={v.error("amountCents")}>
          <MoneyInput autoFocus {...v.bind("amountCents")} value={values.amountCents} onChange={(c) => setValues({ amountCents: c })} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {occ.overridden && (
            <button type="button" className="btn-ghost" disabled={save.isPending} onClick={() => save.mutate(null)}>Voltar ao valor padrão</button>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

function recurrenceText(t: Transaction) {
  if (t.recurrence === "INSTALLMENTS") return `Parcelado em ${t.totalMonths}x${t.installmentStart > 1 ? ` (começou na ${t.installmentStart}ª)` : ""}`;
  return t.totalMonths ? `Todo mês por ${t.totalMonths} ${t.totalMonths === 1 ? "mês" : "meses"}` : "Todo mês, sem data para acabar";
}

function FixedView() {
  const { openTx } = useLayout();
  const q = useQuery({ queryKey: ["transactions", "recurring"], queryFn: () => api.get<Transaction[]>("/transactions?recurring=1") });
  if (q.isLoading || !q.data) return <PageLoading />;
  if (q.data.length === 0)
    return (
      <div className="card">
        <Empty icon="ph:repeat-duotone" title="Nenhum lançamento fixo" text="Salários, contas mensais, assinaturas, financiamentos e compras parceladas aparecem aqui."
          action={<button className="btn-primary" onClick={() => openTx({ recurrence: "MONTHLY" })}><Plus size={16} /> Adicionar fixo</button>} />
      </div>
    );

  const groups: [string, Transaction[]][] = [
    ["Entradas fixas", q.data.filter((t) => t.type === "INCOME")],
    ["Gastos mensais", q.data.filter((t) => t.type === "EXPENSE" && t.recurrence === "MONTHLY")],
    ["Parcelados", q.data.filter((t) => t.recurrence === "INSTALLMENTS")],
  ];
  return (
    <div className="space-y-4">
      {groups.filter(([, l]) => l.length).map(([title, list]) => (
        <section key={title} className="card overflow-hidden">
          <h2 className="border-b border-brand-950/[0.05] px-4 py-3 font-bold">{title}</h2>
          <ul className="divide-y divide-brand-950/[0.05]">
            {list.map((t) => (
              <li key={t.id}>
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50/40" onClick={() => openTx({ id: t.id })}>
                  <CategoryIcon category={t.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.description}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {recurrenceText(t)} · desde {new Date(`${t.date}T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                      {t.person ? ` · ${firstName(t.person.name)}` : " · Casa"}
                      {t.card && <> · <PaymentTag card={t.card} /></>}
                    </p>
                  </div>
                  <p className={cx("text-sm font-bold tabular", t.type === "INCOME" && "text-emerald-600")}>
                    {t.amountMode === "PERCENT" ? `${(t.percentBp ?? 0) / 100}% da renda` : money(t.amountCents)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
