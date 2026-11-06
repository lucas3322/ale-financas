import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Field, Modal, MoneyInput, PageHeader, PageLoading, Segmented, cx } from "../components/ui";
import { api } from "../lib/api";
import { METHOD_LABEL, currentMonth, money, monthLabel, today } from "../lib/format";
import { MethodIcon } from "../components/AppIcon";
import { CategoryPicker } from "../components/CategoryPicker";
import { DateInput, MonthInput } from "../components/DateInput";
import { useAction, useCards, useMe } from "../lib/queries";
import type { CardSummary, PaymentMethod, ShoppingItem } from "../lib/types";
import { intRange, moneyRule, useFormValidation, validDate, type Rules } from "../lib/validation";

const METHODS: PaymentMethod[] = ["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"];
const PRIORITY: Record<number, { label: string; cls: string }> = {
  1: { label: "Alta", cls: "bg-rose-50 text-rose-700" },
  2: { label: "Média", cls: "bg-amber-50 text-amber-700" },
  3: { label: "Baixa", cls: "bg-brand-950/[0.05] text-ink-soft" },
};

export default function Compras() {
  const items = useQuery({ queryKey: ["shopping"], queryFn: () => api.get<ShoppingItem[]>("/shopping") });
  const [editing, setEditing] = useState<{ open: boolean; item?: ShoppingItem }>({ open: false });
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const remove = useAction((id: string) => api.del(`/shopping/${id}`), "Item removido");

  if (items.isLoading || !items.data) return <PageLoading />;
  const planned = items.data.filter((i) => i.status === "PLANNED");
  const bought = items.data.filter((i) => i.status === "BOUGHT");
  const totalPlanned = planned.reduce((s, i) => s + i.estimatedCents, 0);
  const totalBought = bought.reduce((s, i) => s + i.estimatedCents, 0);
  const all = totalPlanned + totalBought;

  const row = (i: ShoppingItem) => {
    const done = i.status === "BOUGHT";
    return (
      <li key={i.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:flex-nowrap", done && "opacity-60")}>
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="flex items-center gap-2">
            <p className={cx("truncate font-bold", done && "line-through decoration-ink-faint")}>{i.name}</p>
            {!done && <span className={cx("chip", PRIORITY[i.priority]?.cls)}>{PRIORITY[i.priority]?.label}</span>}
            {i.link && (
              <a href={i.link} target="_blank" rel="noreferrer noopener" className="text-ink-faint hover:text-brand-600" aria-label={`Abrir link de ${i.name}`}>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
            <span className="chip bg-brand-50 text-brand-700"><MethodIcon method={i.paymentMethod} size={12} /> {METHOD_LABEL[i.paymentMethod]}{i.card ? ` · ${i.card.name}` : ""}</span>
            {i.installments > 1 && <span className="tabular">{i.installments}x de {money(Math.round(i.estimatedCents / i.installments))}</span>}
            {i.plannedMonth && <span>· {done ? "planejado p/" : "para"} <span>{monthLabel(i.plannedMonth, { short: true })}</span></span>}
          </div>
        </div>
        <p className="font-bold tabular">{money(i.estimatedCents)}</p>
        <div className="ml-auto flex items-center gap-1">
          {!done && (
            <button className="btn-outline !px-3 !py-1.5 !text-xs" onClick={() => setBuying(i)}>
              <CheckCircle2 size={14} /> Comprei!
            </button>
          )}
          {!done && (
            <button className="btn-ghost !p-2" aria-label={`Editar ${i.name}`} onClick={() => setEditing({ open: true, item: i })}><Pencil size={15} /></button>
          )}
          <button className="btn-danger !p-2" aria-label={`Excluir ${i.name}`} disabled={remove.isPending}
            onClick={() => confirm(done ? `Remover "${i.name}" da lista? O gasto lançado continua registrado.` : `Excluir "${i.name}" da lista?`) && remove.mutate(i.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Lista de compras" subtitle="Planeje o que vão comprar e como vão pagar. Comprou? Vira gasto num toque."
        actions={<button className="btn-primary" onClick={() => setEditing({ open: true })}><Plus size={18} /> Novo item</button>} />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">Falta comprar</p>
          <p className="mt-1 text-xl font-extrabold tabular">{money(totalPlanned)}</p>
          <p className="text-xs text-ink-faint">{planned.length} {planned.length === 1 ? "item" : "itens"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">Já comprado</p>
          <p className="mt-1 text-xl font-extrabold tabular text-emerald-600">{money(totalBought)}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-950/[0.06]">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${all ? (totalBought / all) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {items.data.length === 0 ? (
        <div className="card">
          <Empty icon="ph:shopping-bag-duotone" title="Sua lista está vazia"
            text="Anote o que vocês querem comprar — a pia, os móveis, o cooktop — com valor e forma de pagamento."
            action={<button className="btn-primary" onClick={() => setEditing({ open: true })}><Plus size={18} /> Adicionar primeiro item</button>} />
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-sm font-bold text-ink-soft">Planejado ({planned.length})</h2>
            {planned.length ? (
              <ul className="card divide-y divide-brand-950/[0.06] overflow-hidden">{planned.map(row)}</ul>
            ) : (
              <div className="card"><Empty icon="ph:confetti-duotone" title="Tudo comprado!" /></div>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              Itens com mês planejado entram na <Link to="/app/previsao" className="font-semibold text-brand-600 hover:underline">Previsão</Link> quando
              a opção “incluir lista de compras” está ligada.
            </p>
          </section>
          {bought.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-ink-soft">Comprado ({bought.length})</h2>
              <ul className="card divide-y divide-brand-950/[0.06] overflow-hidden">{bought.map(row)}</ul>
            </section>
          )}
        </div>
      )}

      <Modal open={editing.open} onClose={() => setEditing({ open: false })} title={editing.item ? "Editar item" : "Novo item"}>
        {editing.open && <ItemForm item={editing.item} onDone={() => setEditing({ open: false })} />}
      </Modal>
      <Modal open={!!buying} onClose={() => setBuying(null)} title="Registrar compra">
        {buying && <BuyForm item={buying} onDone={() => setBuying(null)} />}
      </Modal>
    </>
  );
}

/* ---------- Formulário do item ---------- */
type ItemFormState = {
  name: string; estimatedCents: number; paymentMethod: PaymentMethod; cardId: string | null;
  installments: string; plannedMonth: string; priority: number; link: string; notes: string;
};

function ItemForm({ item, onDone }: { item?: ShoppingItem; onDone: () => void }) {
  const { data: cards = [] } = useCards();
  const activeCards = cards.filter((c) => !c.archived);
  const [f, setF] = useState<ItemFormState>({
    name: item?.name ?? "",
    estimatedCents: item?.estimatedCents ?? 0,
    paymentMethod: item?.paymentMethod ?? "PIX",
    cardId: item?.cardId ?? null,
    installments: String(item?.installments ?? 1),
    plannedMonth: item?.plannedMonth ?? "",
    priority: item?.priority ?? 2,
    link: item?.link ?? "",
    notes: item?.notes ?? "",
  });
  const set = <K extends keyof ItemFormState>(k: K, val: ItemFormState[K]) => setF((s) => ({ ...s, [k]: val }));
  const isCard = f.paymentMethod === "CARD";

  useEffect(() => {
    if (isCard && !f.cardId && activeCards[0]) set("cardId", activeCards[0].id);
  }, [isCard, activeCards, f.cardId]);

  const refMonth = f.plannedMonth || currentMonth();
  const summary = useQuery({
    queryKey: ["cards-summary", refMonth],
    queryFn: () => api.get<CardSummary[]>(`/cards/summary?month=${refMonth}`),
    enabled: isCard,
  });
  const card = summary.data?.find((c) => c.id === f.cardId);
  const exceeds = card && f.estimatedCents > card.availableCents;

  const rules = useMemo<Rules<ItemFormState>>(() => ({
    name: (v) => (!v.trim() ? "O que vocês vão comprar?" : v.length > 100 ? "Máximo de 100 caracteres" : null),
    estimatedCents: moneyRule("o valor estimado"),
    cardId: (v, a) => (a.paymentMethod === "CARD" && !v ? "Escolha o cartão" : null),
    installments: intRange(1, 48, "o número de parcelas"),
    plannedMonth: (v) => (v && !/^\d{4}-\d{2}$/.test(v) ? "Mês inválido" : null),
    link: (v) => {
      if (!v.trim()) return null;
      try {
        const u = new URL(v.trim());
        return u.protocol === "http:" || u.protocol === "https:" ? null : "Use um link que comece com http:// ou https://";
      } catch {
        return "Link inválido — cole o endereço completo (https://…)";
      }
    },
    notes: (v) => (v.length > 500 ? "Máximo de 500 caracteres" : null),
  }), []);
  const v = useFormValidation(f, rules);

  const save = useAction(
    () => {
      const body = {
        name: f.name.trim(),
        estimatedCents: f.estimatedCents,
        paymentMethod: f.paymentMethod,
        cardId: isCard ? f.cardId : null,
        installments: Number(f.installments) || 1,
        plannedMonth: f.plannedMonth || null,
        priority: f.priority,
        link: f.link.trim() || null,
        notes: f.notes.trim() || null,
      };
      return item ? api.patch(`/shopping/${item.id}`, body) : api.post("/shopping", body);
    },
    item ? "Item atualizado" : "Item adicionado",
    onDone,
    v.applyServerError,
  );

  const n = Number(f.installments) || 1;

  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
      <Field label="Item" error={v.error("name")}>
        <input className="field" autoFocus={!item} maxLength={100} {...v.bind("name")} value={f.name}
          onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Cooktop, Lava-louças, Lustre do quarto" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor estimado" error={v.error("estimatedCents")}>
          <MoneyInput {...v.bind("estimatedCents")} value={f.estimatedCents} onChange={(c) => set("estimatedCents", c)} />
        </Field>
        <Field label="Quando pretende comprar" optional error={v.error("plannedMonth")}>
          <MonthInput {...v.bind("plannedMonth")} value={f.plannedMonth} clearable placeholder="Sem data definida" onChange={(m) => set("plannedMonth", m)} />
        </Field>
      </div>

      <div>
        <span className="label">Como vai pagar</span>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button key={m} type="button" onClick={() => set("paymentMethod", m)}
              className={cx("rounded-xl border px-2 py-2 text-xs font-semibold transition",
                f.paymentMethod === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-brand-950/10 text-ink-soft hover:border-brand-300")}>
              <span className="inline-flex items-center justify-center gap-1.5"><MethodIcon method={m} size={15} /> {METHOD_LABEL[m]}</span>
            </button>
          ))}
        </div>
      </div>

      {isCard && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-3">
          {activeCards.length === 0 ? (
            <p className="text-sm text-brand-800">
              Você ainda não tem cartões. <Link to="/app/cartoes" className="font-bold underline">Cadastre um cartão</Link> primeiro.
              {v.error("cardId") && <span className="mt-1 block font-semibold text-rose-600">{v.error("cardId")}</span>}
            </p>
          ) : (
            <>
              <Field label="Cartão" error={v.error("cardId")}>
                <select className="field" {...v.bind("cardId")} value={f.cardId ?? ""} onChange={(e) => set("cardId", e.target.value || null)}>
                  <option value="" disabled>Escolha o cartão</option>
                  {activeCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {card && (
                <p className="mt-2 text-xs text-brand-900">
                  Disponível em <span>{monthLabel(refMonth, { year: false })}</span>: <b>{money(card.availableCents)}</b> de {money(card.limitCents)}
                  {f.estimatedCents > 0 && (
                    <span className={cx("mt-0.5 block", exceeds && "font-bold text-rose-600")}>
                      {exceeds ? "Atenção: essa compra passa do limite disponível" : `Depois da compra: ${money(card.availableCents - f.estimatedCents)}`}
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Parcelas" error={v.error("installments")}
          hint={n > 1 && f.estimatedCents > 0 ? `${n}x de ${money(Math.round(f.estimatedCents / n))}` : "1 = à vista"}>
          <input className="field" inputMode="numeric" maxLength={2} {...v.bind("installments")} value={f.installments}
            onChange={(e) => set("installments", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div>
          <span className="label">Prioridade</span>
          <Segmented size="sm" value={String(f.priority)} onChange={(p) => set("priority", Number(p))}
            options={[{ value: "1", label: "Alta" }, { value: "2", label: "Média" }, { value: "3", label: "Baixa" }]} />
        </div>
      </div>

      <Field label="Link do produto" optional error={v.error("link")}>
        <input className="field" type="url" inputMode="url" maxLength={500} {...v.bind("link")} value={f.link}
          onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Observações" optional error={v.error("notes")}>
        <input className="field" maxLength={500} {...v.bind("notes")} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : item ? "Salvar" : "Adicionar à lista"}
      </button>
    </form>
  );
}

/* ---------- Comprei! ---------- */
type BuyState = { date: string; amountCents: number; categoryId: string | null; personId: string | null };

function BuyForm({ item, onDone }: { item: ShoppingItem; onDone: () => void }) {
  const { data: me } = useMe();
  const [f, setF] = useState<BuyState>({ date: today(), amountCents: item.estimatedCents, categoryId: null, personId: null });
  const set = <K extends keyof BuyState>(k: K, val: BuyState[K]) => setF((s) => ({ ...s, [k]: val }));
  const rules = useMemo<Rules<BuyState>>(() => ({ date: validDate, amountCents: moneyRule("quanto pagou") }), []);
  const v = useFormValidation(f, rules);

  const buy = useAction(() => api.post(`/shopping/${item.id}/buy`, f), "Compra registrada nos lançamentos 🎉", onDone, v.applyServerError);

  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) buy.mutate(undefined); }}>
      <div className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">
        <p className="flex items-center gap-2 font-bold"><ShoppingCart size={16} /> {item.name}</p>
        <p className="mt-0.5 text-xs">
          <MethodIcon method={item.paymentMethod} size={13} /> {METHOD_LABEL[item.paymentMethod]}{item.card ? ` · ${item.card.name}` : ""}
          {item.installments > 1 ? ` · ${item.installments}x` : ""} — vira um gasto em Lançamentos.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quanto pagou" error={v.error("amountCents")}
          hint={item.installments > 1 && f.amountCents > 0 ? `${item.installments}x de ${money(Math.round(f.amountCents / item.installments))}` : undefined}>
          <MoneyInput {...v.bind("amountCents")} value={f.amountCents} onChange={(c) => set("amountCents", c)} />
        </Field>
        <Field label="Data da compra" error={v.error("date")}>
          <DateInput {...v.bind("date")} value={f.date} onChange={(d) => set("date", d)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <CategoryPicker kind="EXPENSE" value={f.categoryId} onChange={(id) => set("categoryId", id)} />
        </Field>
        <Field label="De quem é o gasto">
          <select className="field" value={f.personId ?? ""} onChange={(e) => set("personId", e.target.value || null)}>
            <option value="">Casa (compartilhado)</option>
            {me?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={buy.isPending}>
        {buy.isPending ? "Salvando…" : "Confirmar compra"}
      </button>
    </form>
  );
}
