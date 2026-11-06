import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DIMENSIONS, MEASURES, PRESETS, SIZE_LABEL, TONE_CLASS, VIZ, baseQuery, newId, suggestTitle, vizInfo,
  type Condition, type Dimension, type QueryResult, type QuerySpec, type Size, type Viz, type Widget,
} from "../../lib/analytics";
import { api } from "../../lib/api";
import { METHOD_LABEL, currentMonth } from "../../lib/format";
import { METHOD_ICONS } from "../../lib/icons/catalog";
import { AppIcon } from "../AppIcon";
import { MonthInput } from "../DateInput";
import { useCategoryTree } from "../CategoryPicker";
import { useCards, useCategories, useMe } from "../../lib/queries";
import type { PaymentMethod, Recurrence } from "../../lib/types";
import { useFormValidation, type Rules } from "../../lib/validation";
import { Field, Modal, MoneyInput, Segmented, cx, useMonth } from "../ui";
import { CardsWidget, Skeleton, UpcomingWidget, WidgetChart } from "./WidgetView";
import { VizIcon } from "./VizIcon";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function blankWidget(viz: Viz = "donut"): Widget {
  const q = baseQuery({ groupBy: vizInfo(viz).needsGroup ? "category" : "none" });
  return { id: newId(), viz, title: suggestTitle(viz, q), size: vizInfo(viz).defaultSize, tall: false, query: q, conditions: [] };
}

/** Ajusta a consulta para fazer sentido no tipo de gráfico escolhido. */
function coerce(viz: Viz, q: QuerySpec): QuerySpec {
  const info = vizInfo(viz);
  let { groupBy, splitBy } = q;
  if (!info.needsGroup) groupBy = "none";
  else if (groupBy === "none") groupBy = viz === "line" || viz === "area" ? "month" : "category";
  if (!info.allowsSplit || splitBy === groupBy) splitBy = "none";
  if (viz === "stacked" && splitBy === "none") splitBy = groupBy === "month" ? "category" : "month";
  return { ...q, groupBy, splitBy };
}

type FormValues = { title: string; goalCents: number; rangeFrom: string; rangeTo: string; splitBy: Dimension };

export function WidgetBuilder({ initial, onClose, onSave }: { initial: Widget | null; onClose: () => void; onSave: (w: Widget) => void }) {
  return (
    <Modal open={!!initial} onClose={onClose} title={initial && initial.title && initial.id !== "__new" ? "Editar widget" : "Novo widget"} wide="xl">
      {initial && <Builder key={initial.id} initial={initial} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function Builder({ initial, onClose, onSave }: { initial: Widget; onClose: () => void; onSave: (w: Widget) => void }) {
  const isNew = initial.id === "__new";
  const [w, setW] = useState<Widget>(() => (isNew ? { ...initial, id: newId() } : initial));
  const [titleTouched, setTitleTouched] = useState(!isNew);
  const { month } = useMonth();
  const info = vizInfo(w.viz);

  const setQuery = (patch: Partial<QuerySpec>) =>
    setW((cur) => {
      const query = coerce(cur.viz, { ...cur.query, ...patch });
      return { ...cur, query, title: titleTouched ? cur.title : suggestTitle(cur.viz, query) };
    });
  const setFilters = (patch: Partial<QuerySpec["filters"]>) => setQuery({ filters: { ...w.query.filters, ...patch } });
  const setViz = (viz: Viz) =>
    setW((cur) => {
      const query = coerce(viz, cur.query);
      return { ...cur, viz, query, size: vizInfo(viz).defaultSize, title: titleTouched ? cur.title : suggestTitle(viz, query) };
    });

  const values: FormValues = {
    title: w.title,
    goalCents: w.goalCents ?? 0,
    rangeFrom: w.query.range.from ?? "",
    rangeTo: w.query.range.to ?? "",
    splitBy: w.query.splitBy,
  };
  const rules = useMemo<Rules<FormValues>>(() => ({
    title: (v) => (!v.trim() ? "Dê um título ao widget" : v.length > 60 ? "Máximo de 60 caracteres" : null),
    goalCents: (v) => (w.viz === "progress" && v <= 0 ? "Defina a meta" : null),
    rangeFrom: (v) => (w.query.range.preset === "custom" && !v ? "Escolha o mês inicial" : null),
    rangeTo: (v) => (w.query.range.preset === "custom" && !v ? "Escolha o mês final" : null),
    splitBy: (v) => (w.viz === "stacked" && v === "none" ? "Empilhado precisa de uma segunda dimensão" : null),
  }), [w.viz, w.query.range.preset]);
  const v = useFormValidation(values, rules);

  const preview = useDebounced(w, 250);
  const pq = useQuery({
    queryKey: ["analytics-preview", month, JSON.stringify(preview.query)],
    queryFn: () => api.post<Record<string, QueryResult>>("/analytics/query", { month, queries: { p: preview.query } }).then((r) => r.p),
    enabled: !vizInfo(preview.viz).special,
    placeholderData: keepPreviousData,
  });

  return (
    <form
      ref={v.formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (v.validate()) onSave({ ...w, title: w.title.trim() });
      }}
      className="grid gap-5 lg:grid-cols-[1fr_380px]"
    >
      {/* Prévia ao vivo: no celular vem primeiro, no desktop fica fixa à direita */}
      <div className="order-first lg:order-last">
        <div className="lg:sticky lg:top-0">
          <p className="label">Prévia</p>
          <div className="card p-4">
            <p className="mb-3 truncate font-bold">{w.title || "Sem título"}</p>
            {w.viz === "cards" ? <CardsWidget month={month} /> : w.viz === "upcoming" ? <UpcomingWidget month={month} /> :
              pq.data ? <div className={cx("transition-opacity duration-200", pq.isFetching && "opacity-60")}><WidgetChart w={preview} data={pq.data} height={200} /></div>
              : <Skeleton lines={4} height={200} />}
          </div>
          {!info.special && pq.data && (
            <p className="mt-2 text-[11px] text-ink-faint">
              {pq.data.count} lançamento{pq.data.count === 1 ? "" : "s"} · {pq.data.range.months} {pq.data.range.months === 1 ? "mês" : "meses"}
              {w.query.range.preset === "selected" && " · acompanha o mês escolhido no topo"}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Section n={1} title="Tipo de visualização">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {VIZ.map((x) => (
              <button key={x.value} type="button" onClick={() => setViz(x.value)} aria-pressed={w.viz === x.value}
                className={cx(
                  "group flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-[border-color,background-color,transform] duration-150 active:scale-[.97]",
                  w.viz === x.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-brand-950/10 text-ink-soft hover:border-brand-300",
                )}>
                <VizIcon viz={x.value} active={w.viz === x.value} />
                <span className="text-xs font-semibold">{x.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">{info.hint}</p>
        </Section>

        {!info.special && (
          <>
            <Section n={2} title="Dados">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="O que medir" hint={MEASURES.find((m) => m.value === w.query.measure)?.hint}>
                  <select className="field" value={w.query.measure} onChange={(e) => setQuery({ measure: e.target.value as QuerySpec["measure"] })}>
                    {MEASURES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="Cálculo">
                  <select className="field" value={w.query.aggregate} onChange={(e) => setQuery({ aggregate: e.target.value as QuerySpec["aggregate"] })}
                    disabled={w.query.groupBy === "month" || w.query.measure === "balance" || w.query.measure === "count"}>
                    <option value="sum">Total do período</option>
                    <option value="monthlyAvg">Média por mês</option>
                  </select>
                </Field>
                {info.needsGroup && (
                  <Field label="Agrupar por">
                    <select className="field" value={w.query.groupBy} onChange={(e) => setQuery({ groupBy: e.target.value as Dimension })}>
                      {DIMENSIONS.filter((d) => d.value !== "none").map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </Field>
                )}
                {info.allowsSplit && (
                  <Field label="Cruzar com" error={v.error("splitBy")} hint="Divide cada barra/linha numa segunda dimensão">
                    <select className="field" {...v.bind("splitBy")} value={w.query.splitBy} onChange={(e) => setQuery({ splitBy: e.target.value as Dimension })}>
                      {DIMENSIONS.filter((d) => d.value !== w.query.groupBy && (w.viz !== "stacked" || d.value !== "none")).map((d) => (
                        <option key={d.value} value={d.value}>{d.value === "none" ? "Não cruzar" : d.label}</option>
                      ))}
                    </select>
                  </Field>
                )}
                {info.needsGroup && w.query.groupBy !== "month" && (
                  <Field label="Mostrar no máximo" hint="O restante vira “Outros”">
                    <select className="field" value={w.query.limit} onChange={(e) => setQuery({ limit: Number(e.target.value) })}>
                      {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} itens</option>)}
                    </select>
                  </Field>
                )}
              </div>
            </Section>

            <Section n={3} title="Período">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Período" className="sm:col-span-3">
                  <select className="field" value={w.query.range.preset}
                    onChange={(e) => {
                      const preset = e.target.value as QuerySpec["range"]["preset"];
                      const cm = currentMonth();
                      setQuery({ range: preset === "custom" ? { preset, from: w.query.range.from ?? cm, to: w.query.range.to ?? cm } : { preset } });
                    }}>
                    {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                {w.query.range.preset === "custom" && (
                  <>
                    <Field label="De" error={v.error("rangeFrom")}>
                      <MonthInput {...v.bind("rangeFrom")} value={w.query.range.from ?? ""} onChange={(m) => setQuery({ range: { ...w.query.range, from: m } })} />
                    </Field>
                    <Field label="Até" error={v.error("rangeTo")} hint="Máximo de 5 anos">
                      <MonthInput {...v.bind("rangeTo")} value={w.query.range.to ?? ""} onChange={(m) => setQuery({ range: { ...w.query.range, to: m } })} />
                    </Field>
                  </>
                )}
              </div>
            </Section>

            <Section n={4} title="Filtros" subtitle="Deixe vazio para considerar tudo">
              <Filters q={w.query} set={setFilters} />
            </Section>

            {(w.viz === "kpi" || w.viz === "progress") && (
              <Section n={5} title={w.viz === "progress" ? "Meta e condições" : "Condições de cor"}>
                {w.viz === "progress" && (
                  <Field label="Meta / limite" error={v.error("goalCents")} className="mb-3 max-w-xs">
                    <MoneyInput {...v.bind("goalCents")} value={w.goalCents ?? 0} onChange={(c) => setW({ ...w, goalCents: c })} />
                  </Field>
                )}
                <Conditions value={w.conditions} onChange={(conditions) => setW({ ...w, conditions })} />
              </Section>
            )}
          </>
        )}

        <Section n={info.special ? 2 : w.viz === "kpi" || w.viz === "progress" ? 6 : 5} title="Aparência">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Título" error={v.error("title")}>
              <input className="field" maxLength={60} {...v.bind("title")} value={w.title}
                onChange={(e) => { setTitleTouched(true); setW({ ...w, title: e.target.value }); }} />
            </Field>
            <div>
              <span className="label">Largura</span>
              <Segmented size="sm" value={w.size} onChange={(size: Size) => setW({ ...w, size })}
                options={(Object.keys(SIZE_LABEL) as Size[]).map((s) => ({ value: s, label: SIZE_LABEL[s] }))} />
            </div>
          </div>
          {!["kpi", "progress"].includes(w.viz) && (
            <label className="mt-3 flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={w.tall} onChange={(e) => setW({ ...w, tall: e.target.checked })} />
              Mais alto
            </label>
          )}
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t border-brand-950/[0.06] pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary sm:min-w-[160px]">{isNew ? "Adicionar ao dashboard" : "Salvar widget"}</button>
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{n}</span>
        <h3 className="font-bold">{title}</h3>
        {subtitle && <span className="text-xs text-ink-faint">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string; color?: string; icon?: string }[]; value: T[] | undefined; onChange: (v: T[]) => void;
}) {
  const sel = new Set(value ?? []);
  if (!options.length) return null;
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = sel.has(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on}
              onClick={() => { const n = new Set(sel); on ? n.delete(o.value) : n.add(o.value); onChange([...n]); }}
              className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-150",
                on ? "border-brand-500 bg-brand-600 text-white" : "border-brand-950/10 text-ink-soft hover:border-brand-300")}>
              {o.icon ? <AppIcon icon={o.icon} size={14} color={on ? "#fff" : o.color} /> : o.color && <span className="h-2 w-2 rounded-full" style={{ background: on ? "#fff" : o.color }} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Filters({ q, set }: { q: QuerySpec; set: (p: Partial<QuerySpec["filters"]>) => void }) {
  const { data: me } = useMe();
  const { data: categories = [] } = useCategories();
  const { data: cards = [] } = useCards();
  const f = q.filters;
  const { byId } = useCategoryTree();
  // Mães seguidas das suas subcategorias; filtrar a mãe já inclui as subcategorias.
  const cats = categories
    .filter((c) => (q.measure === "income" ? c.kind === "INCOME" : q.measure === "expense" ? c.kind === "EXPENSE" : true))
    .sort((a, b) => (byId.get(a.parentId ?? "")?.name ?? a.name).localeCompare(byId.get(b.parentId ?? "")?.name ?? b.name) || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-3">
      <Chips label="Categorias" value={f.categoryIds} onChange={(categoryIds) => set({ categoryIds })}
        options={cats.map((c) => ({ value: c.id, label: c.parentId ? `${byId.get(c.parentId)?.name ?? ""} › ${c.name}` : c.name, color: c.color, icon: c.icon }))} />
      <Chips label="Pessoas" value={f.personIds} onChange={(personIds) => set({ personIds })}
        options={[...(me?.members ?? []).map((m) => ({ value: m.id, label: m.name.split(" ")[0] })), { value: "shared", label: "Casa", icon: "ph:house-line-duotone", color: "#64748B" }]} />
      <Chips<PaymentMethod> label="Forma de pagamento" value={f.methods} onChange={(methods) => set({ methods })}
        options={(["PIX", "BOLETO", "CARD", "DEBIT", "CASH", "TRANSFER"] as PaymentMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m], icon: METHOD_ICONS[m], color: m === "PIX" ? "#32BCAD" : "#5B5470" }))} />
      <Chips label="Cartões" value={f.cardIds} onChange={(cardIds) => set({ cardIds })}
        options={cards.map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
      <Chips<Recurrence> label="Tipo de lançamento" value={f.recurrence} onChange={(recurrence) => set({ recurrence })}
        options={[{ value: "ONCE", label: "Avulso" }, { value: "MONTHLY", label: "Fixo mensal" }, { value: "INSTALLMENTS", label: "Parcelado" }]} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Situação">
          <select className="field" value={f.status} onChange={(e) => set({ status: e.target.value as QuerySpec["filters"]["status"] })}>
            <option value="all">Pagos e pendentes</option>
            <option value="paid">Só pagos / recebidos</option>
            <option value="pending">Só pendentes</option>
          </select>
        </Field>
        <Field label="Descrição contém" optional>
          <input className="field" maxLength={60} placeholder="Ex.: mercado" value={f.search ?? ""} onChange={(e) => set({ search: e.target.value || undefined })} />
        </Field>
      </div>
    </div>
  );
}

function Conditions({ value, onChange }: { value: Condition[]; onChange: (c: Condition[]) => void }) {
  const update = (i: number, patch: Partial<Condition>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-brand-50/60 p-2.5 text-sm motion-safe:animate-[fade_.2s_ease-out]">
          <span className="font-medium">Se o total for</span>
          <select className="field !w-auto !py-1.5" value={c.op} onChange={(e) => update(i, { op: e.target.value as Condition["op"] })}>
            <option value="gt">maior que</option>
            <option value="lt">menor que</option>
          </select>
          <div className="w-36"><MoneyInput value={Math.abs(c.valueCents)} onChange={(cents) => update(i, { valueCents: c.valueCents < 0 ? -cents : cents })} placeholder="0,00" /></div>
          <span className="font-medium">fica</span>
          <div className="flex gap-1">
            {(["red", "amber", "green"] as const).map((t) => (
              <button key={t} type="button" aria-label={TONE_CLASS[t].label} aria-pressed={c.tone === t} onClick={() => update(i, { tone: t })}
                className={cx("h-7 w-7 rounded-full ring-offset-2 transition-shadow duration-150", TONE_CLASS[t].dot, c.tone === t && "ring-2 ring-brand-500")} />
            ))}
          </div>
          <button type="button" className="btn-ghost ml-auto !p-1.5" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover condição">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {value.length < 4 && (
        <button type="button" className="btn-outline !py-2 text-xs" onClick={() => onChange([...value, { op: "gt", valueCents: 0, tone: "red" }])}>
          <Plus size={14} /> Adicionar condição
        </button>
      )}
      <p className="text-[11px] text-ink-faint">A primeira condição verdadeira define a cor. Ex.: gastos maior que R$ 5.000 → vermelho.</p>
    </div>
  );
}
