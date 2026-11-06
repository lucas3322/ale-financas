import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { METHOD_LABEL, invoiceFor, money, monthLabel, today } from "../lib/format";
import { AppIcon, MethodIcon } from "./AppIcon";
import { CategoryPicker } from "./CategoryPicker";
import { useAction, useCards, useCategories, useMe } from "../lib/queries";
import { intRange, moneyRule, required, useFormValidation, validDate, type Rules } from "../lib/validation";
import type { AmountMode, CardSummary, PaymentMethod, PercentBase, Recurrence, Transaction, TxType } from "../lib/types";
import { QuickCategory } from "./QuickCategory";
import { Field, Modal, MoneyInput, PageLoading, Segmented, cx, useMonth } from "./ui";

export type TxDraft = Partial<Transaction> & { id?: string; /** mês a partir do qual a edição vale */ fromMonth?: string };

interface FormState {
  type: TxType;
  description: string;
  categoryId: string | null;
  personId: string | null;
  amountMode: AmountMode;
  amountCents: number;
  percent: string;
  percentBase: PercentBase;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  date: string;
  recurrence: Recurrence;
  totalMonths: string;
  installmentStart: string;
  installmentValueIsTotal: boolean;
  isSalary: boolean;
  notes: string;
}

const METHODS: PaymentMethod[] = ["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"];

function initialState(d: TxDraft | undefined, userId: string, defaultDate: string): FormState {
  return {
    type: d?.type ?? "EXPENSE",
    description: d?.description ?? "",
    categoryId: d?.categoryId ?? null,
    personId: d && "personId" in d ? d.personId ?? null : userId,
    amountMode: d?.amountMode ?? "FIXED",
    amountCents: d?.amountCents ?? 0,
    percent: d?.percentBp ? String(d.percentBp / 100).replace(".", ",") : "10",
    percentBase: d?.percentBase ?? "PERSON_INCOME",
    paymentMethod: d?.paymentMethod ?? "PIX",
    cardId: d?.cardId ?? null,
    date: d?.date ?? defaultDate,
    recurrence: d?.recurrence ?? "ONCE",
    totalMonths: d?.totalMonths ? String(d.totalMonths) : "",
    installmentStart: String(d?.installmentStart ?? 1),
    installmentValueIsTotal: !d?.id,
    isSalary: d?.isSalary ?? false,
    notes: d?.notes ?? "",
  };
}

export function TransactionModal({ open, draft, onClose }: { open: boolean; draft?: TxDraft; onClose: () => void }) {
  const editingId = draft?.id;
  const full = useQuery({
    queryKey: ["tx", editingId],
    queryFn: () => api.get<Transaction>(`/transactions/${editingId}`),
    enabled: open && !!editingId,
  });
  const title = editingId ? "Editar lançamento" : draft?.type === "INCOME" ? "Nova entrada" : "Novo lançamento";
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {editingId && !full.data ? (
        <PageLoading />
      ) : (
        <TransactionForm key={`${editingId ?? "new"}-${open}`} draft={editingId ? { ...full.data, fromMonth: draft?.fromMonth } : draft} onDone={onClose} />
      )}
    </Modal>
  );
}

function TransactionForm({ draft, onDone }: { draft?: TxDraft; onDone: () => void }) {
  const { data: me } = useMe();
  const { data: categories = [] } = useCategories();
  const { data: cards = [] } = useCards();
  const { month } = useMonth();
  const defaultDate = month === today().slice(0, 7) ? today() : `${month}-05`;
  const [f, setF] = useState<FormState>(() => initialState(draft, me!.user.id, defaultDate));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const isEdit = !!draft?.id;
  const isExpense = f.type === "EXPENSE";
  const [newCategory, setNewCategory] = useState(false);
  const [scope, setScope] = useState<"future" | "all">(draft?.fromMonth ? "future" : "all");

  const cardSummary = useQuery({
    queryKey: ["cards-summary", f.date.slice(0, 7)],
    queryFn: () => api.get<CardSummary[]>(`/cards/summary?month=${f.date.slice(0, 7)}`),
    enabled: isExpense && f.paymentMethod === "CARD",
  });
  const activeCards = cards.filter((c) => !c.archived);
  useEffect(() => {
    if (f.paymentMethod === "CARD" && !f.cardId && activeCards[0]) set("cardId", activeCards[0].id);
  }, [f.paymentMethod, activeCards, f.cardId]);

  const cats = useMemo(() => categories.filter((c) => c.kind === f.type), [categories, f.type]);
  // Salário novo já vem com a categoria "Salário" (se existir).
  useEffect(() => {
    if (isEdit || f.type !== "INCOME" || !f.isSalary || f.categoryId) return;
    const sal = cats.find((c) => c.name.toLowerCase() === "salário");
    if (sal) set("categoryId", sal.id);
  }, [isEdit, f.type, f.isSalary, f.categoryId, cats]);
  const installments = Number(f.totalMonths) || 0;
  const startInst = Math.max(1, Number(f.installmentStart) || 1);
  const perInstallment = f.recurrence === "INSTALLMENTS" && f.installmentValueIsTotal && installments > 0
    ? Math.round(f.amountCents / installments)
    : f.amountCents;
  const selectedCard = cardSummary.data?.find((c) => c.id === f.cardId);
  const cardDef = activeCards.find((c) => c.id === f.cardId);
  const invoice = cardDef && !validDate(f.date) ? invoiceFor(f.date, cardDef) : null;
  const remainingInst = Math.max(0, installments - startInst + 1);
  const willCommit = f.recurrence === "INSTALLMENTS" ? perInstallment * remainingInst : perInstallment;

  const rules = useMemo<Rules<FormState>>(() => ({
    description: (v) => required("Dê um nome para o lançamento")(v) || (v.length > 120 ? "Máximo de 120 caracteres" : null),
    amountCents: (v, a) => (a.type === "EXPENSE" && a.amountMode === "PERCENT" ? null : moneyRule("o valor")(v)),
    percent: (v, a) => {
      if (a.type !== "EXPENSE" || a.amountMode !== "PERCENT") return null;
      const n = Number(v.replace(",", "."));
      if (!v || !Number.isFinite(n) || n <= 0) return "Informe o percentual";
      if (n > 100) return "Máximo de 100%";
      return null;
    },
    date: validDate,
    cardId: (v, a) => (a.type === "EXPENSE" && a.paymentMethod === "CARD" && !v ? "Escolha o cartão" : null),
    totalMonths: (v, a) => {
      if (a.recurrence === "INSTALLMENTS") return intRange(2, 120, "o número de parcelas")(v);
      if (a.recurrence === "MONTHLY" && v) return intRange(1, 600, "a quantidade de meses")(v);
      return null;
    },
    installmentStart: (v, a) => {
      if (a.recurrence !== "INSTALLMENTS") return null;
      const n = Number(v);
      if (!v || !Number.isInteger(n) || n < 1) return "Use 1 ou mais";
      if (Number(a.totalMonths) && n > Number(a.totalMonths)) return `Não pode passar de ${a.totalMonths}`;
      return null;
    },
    notes: (v) => (v.length > 500 ? "Máximo de 500 caracteres" : null),
  }), []);
  const v = useFormValidation(f, rules);

  const save = useAction(
    async () => {
      const body = {
        type: f.type,
        description: f.description,
        categoryId: f.categoryId,
        personId: f.personId,
        amountMode: isExpense ? f.amountMode : "FIXED",
        amountCents: perInstallment,
        percentBp: f.amountMode === "PERCENT" ? Math.round(Number(f.percent.replace(",", ".")) * 100) : null,
        percentBase: f.percentBase,
        paymentMethod: isExpense ? f.paymentMethod : null,
        cardId: isExpense && f.paymentMethod === "CARD" ? f.cardId : null,
        date: f.date,
        recurrence: f.recurrence,
        totalMonths: f.recurrence === "ONCE" ? null : Number(f.totalMonths) || null,
        installmentStart: f.recurrence === "INSTALLMENTS" ? startInst : 1,
        isSalary: !isExpense && f.isSalary,
        notes: f.notes || null,
      };
      if (isEdit) return api.patch(`/transactions/${draft!.id}`, { ...body, scope, fromMonth: draft?.fromMonth });
      return api.post("/transactions", body);
    },
    isEdit ? "Lançamento atualizado" : "Lançamento criado",
    onDone,
    v.applyServerError,
  );

  const remove = useAction(
    (s: "all" | "future") =>
      api.del(`/transactions/${draft!.id}?scope=${s}${draft?.fromMonth ? `&fromMonth=${draft.fromMonth}` : ""}`),
    "Lançamento excluído",
    onDone,
  );

  const canEditFuture = isEdit && draft?.recurrence === "MONTHLY" && f.recurrence === "MONTHLY" && !!draft?.fromMonth;

  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
      <Segmented
        value={f.type}
        onChange={(v) => { setNewCategory(false); setF((s) => ({ ...s, type: v, categoryId: null, amountMode: "FIXED", isSalary: v === "INCOME" && !s.description })); }}
        options={[{ value: "EXPENSE", label: "↓ Saída" }, { value: "INCOME", label: "↑ Entrada" }]}
      />

      <Field label="Descrição" error={v.error("description")}>
        <input className="field" maxLength={120} autoFocus={!isEdit} {...v.bind("description")} value={f.description} onChange={(e) => set("description", e.target.value)}
          placeholder={isExpense ? "Ex.: Condomínio, Mercado, Dízimo…" : "Ex.: Salário, Freela, 13º…"} />
      </Field>

      {isExpense && (
        <Segmented size="sm" value={f.amountMode} onChange={(v) => set("amountMode", v)}
          options={[{ value: "FIXED", label: "Valor fixo" }, { value: "PERCENT", label: "% da renda (ex.: dízimo)" }]} />
      )}

      {f.amountMode === "PERCENT" && isExpense ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Percentual" error={v.error("percent")}>
            <div className="relative">
              <input className="field pr-8 font-semibold" inputMode="decimal" {...v.bind("percent")} value={f.percent}
                onChange={(e) => set("percent", e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-faint">%</span>
            </div>
          </Field>
          <Field label="Sobre a renda de">
            <select className="field" value={f.percentBase} onChange={(e) => set("percentBase", e.target.value as PercentBase)}>
              <option value="PERSON_INCOME">Da pessoa</option>
              <option value="GROUP_INCOME">Todo o grupo</option>
            </select>
          </Field>
          <p className="col-span-2 -mt-1 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
            O valor é recalculado todo mês com base nas entradas. Se o salário aumentar, o lançamento acompanha automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={f.recurrence === "INSTALLMENTS" ? (f.installmentValueIsTotal ? "Valor total da compra" : "Valor da parcela") : "Valor"}
            error={v.error("amountCents")}
            hint={f.recurrence === "INSTALLMENTS" && installments > 0 ? (
              <button type="button" className="font-semibold text-brand-600" onClick={() => {
                setF((s) => ({ ...s, installmentValueIsTotal: !s.installmentValueIsTotal, amountCents: s.installmentValueIsTotal ? perInstallment : perInstallment * installments }));
              }}>
                {f.installmentValueIsTotal ? `${installments}x de ${money(perInstallment)} · informar parcela` : "informar valor total"}
              </button>
            ) : undefined}
          >
            <MoneyInput {...v.bind("amountCents")} value={f.amountCents} onChange={(c) => set("amountCents", c)} />
          </Field>
          <Field label={isExpense && f.paymentMethod === "CARD" ? "Data da compra" : isExpense ? "Vencimento" : "Data de recebimento"} error={v.error("date")}>
            <input type="date" className="field" min="2000-01-01" max="2100-12-31" {...v.bind("date")} value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
        </div>
      )}
      {f.amountMode === "PERCENT" && isExpense && (
        <Field label="Data de pagamento" error={v.error("date")}>
          <input type="date" className="field" min="2000-01-01" max="2100-12-31" {...v.bind("date")} value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={isExpense ? "De quem é o gasto" : "Quem recebe"}>
          <select className="field" value={f.personId ?? ""} onChange={(e) => set("personId", e.target.value || null)}>
            {me!.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="">Casa (compartilhado)</option>
          </select>
        </Field>
        <Field label="Categoria">
          <CategoryPicker kind={f.type} value={f.categoryId} onChange={(id) => { setNewCategory(false); set("categoryId", id); }}
            onCreateNew={() => setNewCategory(true)} />
        </Field>
      </div>
      {newCategory && (
        <QuickCategory kind={f.type}
          onCreated={(id) => { set("categoryId", id); setNewCategory(false); }}
          onCancel={() => setNewCategory(false)} />
      )}

      {isExpense && (
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
          {f.paymentMethod === "CARD" && (
            <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-3">
              {activeCards.length === 0 ? (
                <p className="text-sm text-brand-800">
                  Você ainda não tem cartões. <a href="/app/cartoes" className="font-bold underline">Cadastre um cartão</a> para lançar compras nele.
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
                  {invoice && (
                    <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-brand-900">
                      <AppIcon icon="ph:receipt-duotone" size={14} className="mr-1 inline align-[-2px] text-brand-600" />{f.recurrence === "INSTALLMENTS" ? "1ª parcela entra" : "Entra"} na fatura de <b>{monthLabel(invoice.month)}</b> (vence {invoice.due})
                      {cardDef && Number(f.date.slice(8, 10)) > cardDef.closingDay && <span className="font-normal"> — compra depois do fechamento (dia {cardDef.closingDay})</span>}
                    </p>
                  )}
                  {selectedCard && (
                    <div className="mt-2 text-xs text-brand-900">
                      Disponível em {monthLabel(f.date.slice(0, 7), { year: false })}: <b>{money(selectedCard.availableCents)}</b> de {money(selectedCard.limitCents)}
                      {willCommit > 0 && !isEdit && (
                        <span className={cx("block mt-0.5", selectedCard.availableCents - willCommit < 0 ? "text-rose-600 font-bold" : "")}>
                          Depois desta compra: {money(selectedCard.availableCents - willCommit)}
                          {f.recurrence === "INSTALLMENTS" && " (o parcelado compromete o valor total no limite)"}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <span className="label">Repetição</span>
        <Segmented size="sm" value={f.recurrence} onChange={(v) => set("recurrence", v)}
          options={[
            { value: "ONCE", label: "Uma vez" },
            { value: "MONTHLY", label: "Todo mês" },
            ...(isExpense ? [{ value: "INSTALLMENTS" as const, label: "Parcelado" }] : []),
          ]} />
        {f.recurrence === "MONTHLY" && (
          <Field className="mt-3" label="Por quantos meses?" optional error={v.error("totalMonths")} hint="Deixe em branco se não tem data para acabar (ex.: salário, aluguel).">
            <input className="field" inputMode="numeric" maxLength={3} placeholder="Sem fim" {...v.bind("totalMonths")} value={f.totalMonths} onChange={(e) => set("totalMonths", e.target.value.replace(/\D/g, ""))} />
          </Field>
        )}
        {f.recurrence === "INSTALLMENTS" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Total de parcelas" error={v.error("totalMonths")}>
              <input className="field" inputMode="numeric" maxLength={3} {...v.bind("totalMonths")} value={f.totalMonths} onChange={(e) => set("totalMonths", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 10" />
            </Field>
            <Field label="Começa na parcela" error={v.error("installmentStart")} hint="Já está pagando? Ex.: 3 (de 6)">
              <input className="field" inputMode="numeric" maxLength={3} {...v.bind("installmentStart")} value={f.installmentStart} onChange={(e) => set("installmentStart", e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
        )}
      </div>

      {!isExpense && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.isSalary} onChange={(e) => set("isSalary", e.target.checked)} />
          É salário
        </label>
      )}

      <Field label="Observações" optional error={v.error("notes")}>
        <input className="field" maxLength={500} {...v.bind("notes")} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      {canEditFuture && (
        <div className="rounded-2xl bg-amber-50 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-900">Aplicar a alteração em:</p>
          <Segmented size="sm" value={scope} onChange={setScope}
            options={[{ value: "future", label: `A partir de ${monthLabel(draft!.fromMonth!, { short: true })}` }, { value: "all", label: "Todos os meses" }]} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
        {isEdit && (
          <div className="flex gap-1 sm:mr-auto">
            {draft?.recurrence !== "ONCE" && draft?.fromMonth && (
              <button type="button" className="btn-danger !px-3" disabled={remove.isPending}
                onClick={() => confirm(`Parar a partir de ${monthLabel(draft.fromMonth!)}? Os meses anteriores ficam registrados.`) && remove.mutate("future")}>
                Encerrar daqui pra frente
              </button>
            )}
            <button type="button" className="btn-danger !px-3" disabled={remove.isPending}
              onClick={() => confirm("Excluir este lançamento de todos os meses?") && remove.mutate("all")}>
              Excluir tudo
            </button>
          </div>
        )}
        <button type="submit" className="btn-primary sm:min-w-[140px]" disabled={save.isPending}>
          {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}
