import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useCategories } from "../lib/queries";
import type { Category, TxType } from "../lib/types";
import { AppIcon, CategoryIcon } from "./AppIcon";
import { Popover, cx } from "./ui";

/** Árvore: categorias mães com as subcategorias embaixo, em ordem alfabética. */
export function useCategoryTree(kind?: TxType) {
  const { data: categories = [] } = useCategories();
  return useMemo(() => {
    const list = kind ? categories.filter((c) => c.kind === kind) : categories;
    const byId = new Map(list.map((c) => [c.id, c]));
    const parents = list.filter((c) => !c.parentId || !byId.has(c.parentId));
    const children = (id: string) => list.filter((c) => c.parentId === id);
    return { parents, children, byId, all: list };
  }, [categories, kind]);
}

export function categoryPath(c: Category | undefined, byId: Map<string, Category>) {
  if (!c) return "";
  const parent = c.parentId ? byId.get(c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/**
 * Seletor de categoria com ícone, busca e subcategorias (ex.: Assinaturas e streaming › Netflix).
 * Substitui o <select>, que não consegue mostrar ícones.
 */
export function CategoryPicker({ kind, value, onChange, onCreateNew, name }: {
  kind: TxType; value: string | null; onChange: (id: string | null) => void; onCreateNew?: () => void; name?: string;
}) {
  const { parents, children, byId } = useCategoryTree(kind);
  const [q, setQ] = useState("");
  const selected = value ? byId.get(value) : undefined;
  const term = q.trim().toLowerCase();
  const match = (c: Category) => !term || c.name.toLowerCase().includes(term);

  return (
    <Popover align="stretch" className="max-h-80 overflow-y-auto" trigger={(p) => (
      <button {...p} type="button" name={name} className="field flex items-center gap-2 text-left">
        {selected ? <CategoryIcon category={selected} size="sm" /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-950/[0.05] text-ink-faint"><AppIcon icon="ph:tag-duotone" size={15} /></span>}
        <span className={cx("min-w-0 flex-1 truncate", !selected && "text-ink-faint")}>{selected ? categoryPath(selected, byId) : "Sem categoria"}</span>
        <ChevronDown size={16} className="shrink-0 text-ink-faint" />
      </button>
    )}>
      {(close) => (
        <div>
          <div className="sticky top-0 z-10 -m-1 mb-1 bg-white p-1.5">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input autoFocus className="field !py-2 pl-8 text-sm" placeholder="Buscar categoria" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
            </div>
          </div>
          {!term && (
            <Option label="Sem categoria" icon={null} active={!value} onClick={() => { onChange(null); close(); }} />
          )}
          {parents.map((p) => {
            const subs = children(p.id).filter((c) => match(c) || match(p));
            if (!match(p) && subs.length === 0) return null;
            return (
              <div key={p.id}>
                <Option label={p.name} category={p} active={value === p.id} onClick={() => { onChange(p.id); close(); }} />
                {subs.map((c) => (
                  <Option key={c.id} label={c.name} category={c} indent active={value === c.id} onClick={() => { onChange(c.id); close(); }} />
                ))}
              </div>
            );
          })}
          {onCreateNew && (
            <button type="button" onClick={() => { close(); onCreateNew(); }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-brand-950/[0.06] px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50">
              <AppIcon icon="ph:plus-circle-duotone" size={18} /> Nova categoria…
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

function Option({ label, category, icon, active, indent, onClick }: {
  label: string; category?: Category; icon?: null; active: boolean; indent?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick}
      className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150",
        indent && "pl-7", active ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-brand-950/[0.03]")}>
      {indent && <span className="-ml-3 mr-0.5 h-4 w-3 shrink-0 rounded-bl-md border-b border-l border-brand-950/15" aria-hidden />}
      {category ? <CategoryIcon category={category} size="sm" /> : icon === null && <span className="h-7 w-7 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
