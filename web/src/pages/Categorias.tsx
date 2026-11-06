import { ChevronRight, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppIcon, CategoryIcon } from "../components/AppIcon";
import { useCategoryTree } from "../components/CategoryPicker";
import { Empty, Field, MenuItem, Modal, PageHeader, PageLoading, Popover, Segmented, cx } from "../components/ui";
import { api } from "../lib/api";
import { BRAND_ICONS, ICON_GROUPS, isBrand } from "../lib/icons/catalog";
import { useAction, useCategories } from "../lib/queries";
import type { Category, TxType } from "../lib/types";
import { useFormValidation, type Rules } from "../lib/validation";

const COLORS = [
  "#820AD1", "#A855F7", "#6366F1", "#3B82F6", "#0EA5E9", "#14B8A6",
  "#16A34A", "#84CC16", "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#64748B",
];

type Editing = { open: boolean; category?: Partial<Category> };

export default function Categorias() {
  const { data, isLoading } = useCategories();
  const [tab, setTab] = useState<TxType>("EXPENSE");
  const [editing, setEditing] = useState<Editing>({ open: false });

  if (isLoading || !data) return <PageLoading />;
  const count = (k: TxType) => data.filter((c) => c.kind === k && !c.parentId).length;

  return (
    <>
      <PageHeader title="Categorias" subtitle="Organize entradas e saídas do jeito de vocês. Use subcategorias para detalhar (ex.: Streaming › Netflix)."
        actions={<button className="btn-primary" onClick={() => setEditing({ open: true, category: { kind: tab } })}><Plus size={18} /> Nova categoria</button>} />

      <div className="mb-4 lg:hidden">
        <Segmented value={tab} onChange={setTab} options={[
          { value: "EXPENSE", label: `Saídas (${count("EXPENSE")})` },
          { value: "INCOME", label: `Entradas (${count("INCOME")})` },
        ]} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {(["EXPENSE", "INCOME"] as TxType[]).map((kind) => (
          <section key={kind} className={cx(tab !== kind && "hidden lg:block")}>
            <h2 className="mb-2 hidden text-sm font-bold text-ink-soft lg:block">{kind === "EXPENSE" ? "↓ Saídas" : "↑ Entradas"} ({count(kind)})</h2>
            <CategoryTree kind={kind} onEdit={(c) => setEditing({ open: true, category: c })} />
          </section>
        ))}
      </div>

      <Modal open={editing.open} onClose={() => setEditing({ open: false })}
        title={editing.category?.id ? "Editar categoria" : editing.category?.parentId ? "Nova subcategoria" : "Nova categoria"}>
        {editing.open && <CategoryForm category={editing.category} onDone={() => setEditing({ open: false })} />}
      </Modal>
    </>
  );
}

function CategoryTree({ kind, onEdit }: { kind: TxType; onEdit: (c: Partial<Category>) => void }) {
  const { parents, children } = useCategoryTree(kind);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const remove = useAction((id: string) => api.del(`/categories/${id}`), "Categoria excluída");
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const askRemove = (c: Category) => {
    const subs = children(c.id).length;
    const msg = `Excluir "${c.name}"?${subs ? `\n\nAs ${subs} subcategorias dela também serão excluídas.` : ""}\n\nOs lançamentos continuam existindo, mas ficam "sem categoria".`;
    if (confirm(msg)) remove.mutate(c.id);
  };

  if (parents.length === 0) {
    return (
      <div className="card">
        <Empty icon={kind === "EXPENSE" ? "ph:tag-duotone" : "ph:money-duotone"} title="Nenhuma categoria"
          action={<button className="btn-outline" onClick={() => onEdit({ kind })}><Plus size={16} /> Adicionar</button>} />
      </div>
    );
  }

  return (
    <div className="card p-2">
      <ul>
        {parents.map((p) => {
          const subs = children(p.id);
          const expanded = open.has(p.id);
          return (
            <li key={p.id}>
              <div className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-brand-950/[0.02]">
                <button type="button" onClick={() => subs.length && toggle(p.id)} aria-expanded={subs.length ? expanded : undefined}
                  aria-label={subs.length ? `${expanded ? "Recolher" : "Mostrar"} subcategorias de ${p.name}` : undefined}
                  className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-faint transition-transform duration-200", !subs.length && "invisible", expanded && "rotate-90")}>
                  <ChevronRight size={15} />
                </button>
                <CategoryIcon category={p} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (subs.length ? toggle(p.id) : onEdit(p))}>
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  {subs.length > 0 && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                      {subs.slice(0, 6).map((s) => <AppIcon key={s.id} icon={s.icon} size={12} color={s.color} />)}
                      <span className="ml-0.5">{subs.length} subcategoria{subs.length > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </button>
                <RowMenu name={p.name} onSub={() => onEdit({ kind, parentId: p.id, color: p.color })} onEdit={() => onEdit(p)} onRemove={() => askRemove(p)} />
              </div>
              {expanded && subs.length > 0 && (
                <ul className="mb-1 ml-[22px] border-l border-brand-950/10 pl-3 motion-safe:animate-[fade_.18s_ease-out]">
                  {subs.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-brand-950/[0.02]">
                      <CategoryIcon category={c} size="sm" />
                      <p className="min-w-0 flex-1 truncate text-sm">{c.name}</p>
                      <RowMenu name={c.name} onEdit={() => onEdit(c)} onRemove={() => askRemove(c)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ações da linha num menu só — sobra espaço para o nome da categoria. */
function RowMenu({ name, onSub, onEdit, onRemove }: { name: string; onSub?: () => void; onEdit: () => void; onRemove: () => void }) {
  return (
    <Popover className="w-52" trigger={(p) => (
      <button {...p} type="button" className="btn-ghost !p-1.5" aria-label={`Ações de ${name}`}><MoreVertical size={16} /></button>
    )}>
      {(close) => (
        <>
          {onSub && <MenuItem icon={Plus} label="Nova subcategoria" onClick={() => { close(); onSub(); }} />}
          <MenuItem icon={Pencil} label="Editar" onClick={() => { close(); onEdit(); }} />
          <MenuItem icon={Trash2} label="Excluir" danger onClick={() => { close(); onRemove(); }} />
        </>
      )}
    </Popover>
  );
}

type CatForm = { name: string; kind: TxType; color: string; icon: string; parentId: string };

function CategoryForm({ category, onDone }: { category?: Partial<Category>; onDone: () => void }) {
  const isEdit = !!category?.id;
  const { data: all = [] } = useCategories();
  const [f, setF] = useState<CatForm>({
    name: category?.name ?? "",
    kind: category?.kind ?? "EXPENSE",
    color: category?.color ?? COLORS[0],
    icon: category?.icon ?? "ph:tag-duotone",
    parentId: category?.parentId ?? "",
  });
  const set = <K extends keyof CatForm>(k: K, v: CatForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const [iconTab, setIconTab] = useState<"icons" | "brands">(isBrand(f.icon) ? "brands" : "icons");
  const [q, setQ] = useState("");

  // Pode ser mãe: categorias principais do mesmo tipo (e não a própria). Quem já tem subcategorias não pode virar sub.
  const hasChildren = isEdit && all.some((c) => c.parentId === category!.id);
  const parents = all.filter((c) => c.kind === f.kind && !c.parentId && c.id !== category?.id);

  const rules = useMemo<Rules<CatForm>>(() => ({
    name: (v, a) => {
      const t = v.trim();
      if (!t) return "Dê um nome para a categoria";
      if (t.length > 40) return "Máximo de 40 caracteres";
      const dup = all.some((c) => c.id !== category?.id && c.kind === a.kind && (c.parentId ?? "") === a.parentId && c.name.toLowerCase() === t.toLowerCase());
      return dup ? "Já existe uma categoria com esse nome aqui" : null;
    },
  }), [all, category?.id]);
  const v = useFormValidation(f, rules);

  const save = useAction(
    () => {
      const body = { name: f.name.trim(), kind: f.kind, color: f.color, icon: f.icon, parentId: f.parentId || null };
      return isEdit ? api.patch(`/categories/${category!.id}`, body) : api.post("/categories", body);
    },
    isEdit ? "Categoria atualizada" : "Categoria criada",
    onDone,
    v.applyServerError,
  );

  const term = q.trim().toLowerCase();
  const brands = BRAND_ICONS.filter((b) => !term || b.name.toLowerCase().includes(term));
  const parentName = parents.find((p) => p.id === f.parentId)?.name;

  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-950/[0.03] p-3">
        <CategoryIcon category={{ icon: f.icon, color: f.color }} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{f.name || "Nome da categoria"}</p>
          <p className="truncate text-xs text-ink-faint">{f.kind === "EXPENSE" ? "Saída" : "Entrada"}{parentName && ` · dentro de ${parentName}`}</p>
        </div>
      </div>

      {!f.parentId && (
        <Segmented value={f.kind} onChange={(k) => setF((s) => ({ ...s, kind: k, parentId: "" }))}
          options={[{ value: "EXPENSE", label: "↓ Saída" }, { value: "INCOME", label: "↑ Entrada" }]} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" error={v.error("name")}>
          <input className="field" autoFocus maxLength={40} {...v.bind("name")} value={f.name} onChange={(e) => set("name", e.target.value)}
            placeholder={f.parentId ? "Ex.: Netflix, Spotify" : "Ex.: Pet, Academia, Farmácia"} />
        </Field>
        <Field label="Dentro de" hint={hasChildren ? "Tem subcategorias, então fica como principal" : "Deixe vazio para ser uma categoria principal"}>
          <select className="field" value={f.parentId} disabled={hasChildren} onChange={(e) => set("parentId", e.target.value)}>
            <option value="">— nenhuma (principal)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="label !mb-0">Ícone</span>
          <div className="w-48"><Segmented size="sm" value={iconTab} onChange={setIconTab} options={[{ value: "icons", label: "Ícones" }, { value: "brands", label: "Marcas" }]} /></div>
        </div>
        {iconTab === "icons" ? (
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-brand-950/[0.06] p-3">
            {ICON_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-[11px] font-semibold text-ink-faint">{g.label}</p>
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10" role="radiogroup" aria-label={g.label}>
                  {g.icons.map((i) => (
                    <button key={i} type="button" role="radio" aria-checked={f.icon === i} aria-label={i.split(":")[1].replace("-duotone", "")}
                      onClick={() => set("icon", i)}
                      className={cx("grid aspect-square place-items-center rounded-xl transition-colors duration-150",
                        f.icon === i ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500" : "bg-brand-950/[0.03] text-ink-soft hover:bg-brand-50 hover:text-brand-700")}>
                      <AppIcon icon={i} size={20} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-950/[0.06] p-3">
            <div className="relative mb-2">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="field !py-2 pl-8 text-sm" placeholder="Buscar marca (Netflix, Spotify, PlayStation…)" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
            </div>
            <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
              {brands.map((b) => (
                <button key={b.icon} type="button" aria-pressed={f.icon === b.icon}
                  // Escolher a marca já usa a cor dela e, se o nome estiver vazio, o nome também.
                  onClick={() => setF((s) => ({ ...s, icon: b.icon, color: b.color, name: s.name.trim() ? s.name : b.name }))}
                  className={cx("flex items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-colors duration-150",
                    f.icon === b.icon ? "bg-brand-100 ring-2 ring-brand-500" : "bg-brand-950/[0.03] hover:bg-brand-50")}>
                  <AppIcon icon={b.icon} size={18} color={b.color} />
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
              {brands.length === 0 && <p className="col-span-full py-4 text-center text-sm text-ink-faint">Nenhuma marca encontrada.</p>}
            </div>
          </div>
        )}
      </div>

      <div>
        <span className="label">Cor</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
          {[...new Set([f.color, ...COLORS])].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={`Cor ${c}`} onClick={() => set("color", c)}
              className={cx("h-8 w-8 rounded-full transition", f.color === c ? "ring-2 ring-offset-2" : "hover:scale-110")}
              style={{ background: c, ["--tw-ring-color" as string]: c }} />
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : isEdit ? "Salvar" : f.parentId ? "Criar subcategoria" : "Criar categoria"}
      </button>
    </form>
  );
}
