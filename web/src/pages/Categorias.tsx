import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Empty, Field, Modal, PageHeader, PageLoading, Segmented, cx } from "../components/ui";
import { api } from "../lib/api";
import { useAction, useCategories } from "../lib/queries";
import type { Category, TxType } from "../lib/types";
import { useFormValidation, type Rules } from "../lib/validation";

const COLORS = [
  "#820AD1", "#A855F7", "#6366F1", "#3B82F6", "#0EA5E9", "#14B8A6",
  "#16A34A", "#84CC16", "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#64748B",
];
const ICONS = [
  "🏠", "🛒", "🚗", "💊", "🎓", "💡", "🙏", "🏦", "💳", "🧸", "🎉", "🧾",
  "🐷", "📦", "🍔", "✈️", "🐶", "👕", "📱", "🏋️", "💼", "✨", "🎁", "🔧",
];

type Editing = { open: boolean; category?: Category };

export default function Categorias() {
  const { data, isLoading } = useCategories();
  const [tab, setTab] = useState<TxType>("EXPENSE");
  const [editing, setEditing] = useState<Editing>({ open: false });

  const remove = useAction((id: string) => api.del(`/categories/${id}`), "Categoria excluída");

  if (isLoading || !data) return <PageLoading />;
  const expense = data.filter((c) => c.kind === "EXPENSE");
  const income = data.filter((c) => c.kind === "INCOME");

  const list = (items: Category[], kind: TxType) => (
    <div className="card p-2">
      {items.length === 0 ? (
        <Empty icon={kind === "EXPENSE" ? "🏷️" : "💰"} title="Nenhuma categoria"
          action={<button className="btn-outline" onClick={() => setEditing({ open: true, category: { kind } as Category })}><Plus size={16} /> Adicionar</button>} />
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-950/[0.02]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${c.color}1A` }}>{c.icon}</div>
              <p className="flex-1 truncate text-sm font-semibold">{c.name}</p>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
              <button className="btn-ghost !p-2" aria-label={`Editar ${c.name}`} onClick={() => setEditing({ open: true, category: c })}><Pencil size={15} /></button>
              <button className="btn-danger !p-2" aria-label={`Excluir ${c.name}`} disabled={remove.isPending}
                onClick={() => confirm(`Excluir a categoria "${c.name}"?\n\nOs lançamentos dela continuam existindo, mas ficam "sem categoria".`) && remove.mutate(c.id)}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Categorias" subtitle="Organize entradas e saídas do jeito de vocês."
        actions={<button className="btn-primary" onClick={() => setEditing({ open: true, category: { kind: tab } as Category })}><Plus size={18} /> Nova categoria</button>} />

      <div className="mb-4 lg:hidden">
        <Segmented value={tab} onChange={setTab} options={[
          { value: "EXPENSE", label: `Saídas (${expense.length})` },
          { value: "INCOME", label: `Entradas (${income.length})` },
        ]} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cx(tab !== "EXPENSE" && "hidden lg:block")}>
          <h2 className="mb-2 hidden text-sm font-bold text-ink-soft lg:block">↓ Saídas ({expense.length})</h2>
          {list(expense, "EXPENSE")}
        </section>
        <section className={cx(tab !== "INCOME" && "hidden lg:block")}>
          <h2 className="mb-2 hidden text-sm font-bold text-ink-soft lg:block">↑ Entradas ({income.length})</h2>
          {list(income, "INCOME")}
        </section>
      </div>

      <Modal open={editing.open} onClose={() => setEditing({ open: false })} title={editing.category?.id ? "Editar categoria" : "Nova categoria"}>
        {editing.open && <CategoryForm category={editing.category} onDone={() => setEditing({ open: false })} />}
      </Modal>
    </>
  );
}

type CatForm = { name: string; kind: TxType; color: string; icon: string };

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const isEdit = !!category?.id;
  const [f, setF] = useState<CatForm>({
    name: category?.name ?? "",
    kind: category?.kind ?? "EXPENSE",
    color: category?.color ?? COLORS[0],
    icon: category?.icon ?? ICONS[0],
  });
  const set = <K extends keyof CatForm>(k: K, v: CatForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const rules = useMemo<Rules<CatForm>>(() => ({
    name: (v) => (!v.trim() ? "Dê um nome para a categoria" : v.trim().length > 40 ? "Máximo de 40 caracteres" : null),
  }), []);
  const v = useFormValidation(f, rules);

  const save = useAction(
    () => {
      const body = { ...f, name: f.name.trim() };
      return isEdit ? api.patch(`/categories/${category!.id}`, body) : api.post("/categories", body);
    },
    isEdit ? "Categoria atualizada" : "Categoria criada",
    onDone,
    v.applyServerError,
  );

  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-950/[0.03] p-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ background: `${f.color}1A` }}>{f.icon}</div>
        <div className="min-w-0">
          <p className="truncate font-bold">{f.name || "Nome da categoria"}</p>
          <p className="text-xs text-ink-faint">{f.kind === "EXPENSE" ? "Saída" : "Entrada"}</p>
        </div>
      </div>

      <Segmented value={f.kind} onChange={(k) => set("kind", k)}
        options={[{ value: "EXPENSE", label: "↓ Saída" }, { value: "INCOME", label: "↑ Entrada" }]} />

      <Field label="Nome" error={v.error("name")}>
        <input className="field" autoFocus maxLength={40} {...v.bind("name")} value={f.name} onChange={(e) => set("name", e.target.value)}
          placeholder="Ex.: Pet, Academia, Farmácia" />
      </Field>

      <div>
        <span className="label">Cor</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={`Cor ${c}`} onClick={() => set("color", c)}
              className={cx("h-8 w-8 rounded-full transition", f.color === c ? "ring-2 ring-offset-2" : "hover:scale-110")}
              style={{ background: c, ["--tw-ring-color" as string]: c }} />
          ))}
        </div>
      </div>

      <div>
        <span className="label">Ícone</span>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Ícone">
          {ICONS.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={f.icon === i} aria-label={`Ícone ${i}`} onClick={() => set("icon", i)}
              className={cx("grid aspect-square place-items-center rounded-xl text-lg transition",
                f.icon === i ? "bg-brand-100 ring-2 ring-brand-500" : "bg-brand-950/[0.03] hover:bg-brand-50")}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar categoria"}
      </button>
    </form>
  );
}
