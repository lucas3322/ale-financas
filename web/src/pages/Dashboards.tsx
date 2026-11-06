import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, defaultAnimateLayoutChanges, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, GripVertical, LayoutGrid, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "../components/AppIcon";
import { blankWidget, WidgetBuilder } from "../components/dash/WidgetBuilder";
import { DASH_ICONS } from "../lib/icons/catalog";
import { CardsWidget, Skeleton, UpcomingWidget, WidgetChart } from "../components/dash/WidgetView";
import { Empty, Field, MenuItem, Modal, MonthSwitcher, PageLoading, Popover, cx, useMonth, useToast } from "../components/ui";
import {
  SIZE_CLASS, SIZE_LABEL, TEMPLATES, TONE_CLASS, newId, toneFor, vizInfo,
  type DashboardDef, type QueryResult, type Size, type Widget,
} from "../lib/analytics";
import { api } from "../lib/api";
import { required, useFormValidation } from "../lib/validation";

/** Curva e duração padrão das transições de layout (ease-out forte, < 300ms). */
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

const dropAnimation: DropAnimation = { duration: 220, easing: EASE };
/** Anima também quando a lista muda fora do arraste (remover, redimensionar, desfazer). */
const animateLayoutChanges: AnimateLayoutChanges = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const STORAGE_KEY = "nc:dash:active";

export default function Dashboards() {
  const qc = useQueryClient();
  const toast = useToast();
  const { month } = useMonth();
  const reduce = useReducedMotion();
  const dashes = useQuery({ queryKey: ["dashboards"], queryFn: () => api.get<DashboardDef[]>("/dashboards") });
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [editing, setEditing] = useState(false);
  const [builder, setBuilder] = useState<Widget | null>(null);
  const [dashModal, setDashModal] = useState<{ mode: "create" | "edit" } | null>(null);
  const [undo, setUndo] = useState<{ widget: Widget; index: number } | null>(null);

  const list = dashes.data ?? [];
  const active = list.find((d) => d.id === activeId) ?? list[0];
  useEffect(() => {
    if (active) try { localStorage.setItem(STORAGE_KEY, active.id); } catch { /* armazenamento indisponível */ }
  }, [active]);

  /** Salva widgets com atualização otimista (a tela muda na hora; se falhar, volta). */
  const saveWidgets = useMutation({
    mutationFn: (p: { id: string; widgets: Widget[] }) => api.patch(`/dashboards/${p.id}`, { widgets: p.widgets }),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ["dashboards"] });
      const prev = qc.getQueryData<DashboardDef[]>(["dashboards"]);
      qc.setQueryData<DashboardDef[]>(["dashboards"], (old) => old?.map((d) => (d.id === p.id ? { ...d, widgets: p.widgets } : d)));
      return { prev };
    },
    onError: (e: Error, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboards"], ctx.prev);
      toast(e.message, "error");
    },
  });
  const setWidgets = (widgets: Widget[]) => active && saveWidgets.mutate({ id: active.id, widgets });

  const upsertWidget = (w: Widget) => {
    if (!active) return;
    const exists = active.widgets.some((x) => x.id === w.id);
    setWidgets(exists ? active.widgets.map((x) => (x.id === w.id ? w : x)) : [...active.widgets, w]);
    setBuilder(null);
    toast(exists ? "Widget atualizado" : "Widget adicionado");
  };
  const removeWidget = (w: Widget) => {
    if (!active) return;
    const index = active.widgets.findIndex((x) => x.id === w.id);
    setWidgets(active.widgets.filter((x) => x.id !== w.id));
    setUndo({ widget: w, index });
  };
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  if (dashes.isLoading) return <PageLoading />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboards</h1>
          <p className="text-sm text-ink-soft">Monte painéis do seu jeito, cruzando os números que quiser</p>
        </div>
        {active && (
          <div className="flex items-center gap-2">
            <MonthSwitcher />
            <button
              onClick={() => setEditing((e) => !e)}
              className={cx(editing ? "btn-primary" : "btn-outline")}
              aria-pressed={editing}
            >
              {editing ? <><Check size={16} /> Concluir</> : <><LayoutGrid size={16} /> Editar</>}
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <TemplateGallery onCreated={(id) => { setActiveId(id); }} />
      ) : (
        <>
          <DashTabs list={list} activeId={active!.id} onSelect={(id) => setActiveId(id)}
            onNew={() => setDashModal({ mode: "create" })} onEdit={() => setDashModal({ mode: "edit" })} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active!.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.1 : 0.16, ease: "easeOut" }}
            >
              <Board
                dash={active!}
                month={month}
                editing={editing}
                onReorder={setWidgets}
                onEdit={(w) => setBuilder(w)}
                onRemove={removeWidget}
                onDuplicate={(w) => {
                  const i = active!.widgets.findIndex((x) => x.id === w.id);
                  const copy = { ...w, id: newId(), title: `${w.title} (cópia)`.slice(0, 60) };
                  setWidgets([...active!.widgets.slice(0, i + 1), copy, ...active!.widgets.slice(i + 1)]);
                }}
                onResize={(w, size) => setWidgets(active!.widgets.map((x) => (x.id === w.id ? { ...x, size } : x)))}
                onAdd={() => setBuilder({ ...blankWidget(), id: "__new" })}
              />
            </motion.div>
          </AnimatePresence>
        </>
      )}

      <WidgetBuilder initial={builder} onClose={() => setBuilder(null)} onSave={upsertWidget} />
      {dashModal && (
        <DashModal mode={dashModal.mode} dash={dashModal.mode === "edit" ? active : undefined}
          onClose={() => setDashModal(null)} onDone={(id) => { if (id) setActiveId(id); setDashModal(null); }} />
      )}

      {/* Desfazer remoção — sai pelo mesmo caminho que entrou */}
      <AnimatePresence>
        {undo && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(12px)" }}
            transition={reduce ? { duration: 0.12 } : SPRING}
            className="fixed inset-x-0 bottom-24 z-[55] mx-auto flex w-fit items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-xl lg:bottom-8"
            role="status"
          >
            Widget removido
            <button
              className="rounded-lg px-2 py-1 text-brand-200 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              onClick={() => {
                if (!active) return;
                const ws = [...active.widgets];
                ws.splice(Math.min(undo.index, ws.length), 0, undo.widget);
                setWidgets(ws);
                setUndo(null);
              }}
            >
              Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Abas dos dashboards (indicador desliza entre elas) ---------- */
function DashTabs({ list, activeId, onSelect, onNew, onEdit }: {
  list: DashboardDef[]; activeId: string; onSelect: (id: string) => void; onNew: () => void; onEdit: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Seus dashboards">
      <div className="flex min-w-0 flex-wrap gap-1 rounded-2xl bg-brand-950/[0.05] p-1">
        {list.map((d) => {
          const on = d.id === activeId;
          return (
            <button key={d.id} role="tab" aria-selected={on} onClick={() => (on ? onEdit() : onSelect(d.id))}
              title={on ? "Renomear ou excluir" : undefined}
              className={cx("relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors duration-150",
                on ? "text-brand-700" : "text-ink-soft hover:text-ink")}>
              {on && (
                <motion.span layoutId="dash-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={reduce ? { duration: 0 } : SPRING} />
              )}
              <AppIcon icon={d.icon} size={16} className="relative" />
              <span className="relative">{d.name}</span>
              {on && <MoreHorizontal size={14} className="relative text-ink-faint" />}
            </button>
          );
        })}
      </div>
      <button className="btn-ghost shrink-0 !px-3" onClick={onNew}><Plus size={16} /> Novo</button>
    </div>
  );
}

/* ---------- Grid com arrastar e soltar ---------- */
function Board({ dash, month, editing, onReorder, onEdit, onRemove, onDuplicate, onResize, onAdd }: {
  dash: DashboardDef; month: string; editing: boolean;
  onReorder: (w: Widget[]) => void; onEdit: (w: Widget) => void; onRemove: (w: Widget) => void;
  onDuplicate: (w: Widget) => void; onResize: (w: Widget, s: Size) => void; onAdd: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    // Pequena tolerância antes de virar arraste: clique continua sendo clique.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar ~200ms para arrastar — assim a rolagem da página continua livre.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Todas as consultas do dashboard numa requisição só.
  const queries = useMemo(() => {
    const q: Record<string, Widget["query"]> = {};
    for (const w of dash.widgets) if (!vizInfo(w.viz).special) q[w.id] = w.query;
    return q;
  }, [dash.widgets]);
  const data = useQuery({
    queryKey: ["analytics", dash.id, month, JSON.stringify(queries)],
    queryFn: () => api.post<Record<string, QueryResult>>("/analytics/query", { month, queries }),
    enabled: Object.keys(queries).length > 0,
    placeholderData: keepPreviousData, // ao trocar o mês, os números "correm" do valor antigo pro novo
  });

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const from = dash.widgets.findIndex((w) => w.id === e.active.id);
    const to = dash.widgets.findIndex((w) => w.id === e.over!.id);
    onReorder(arrayMove(dash.widgets, from, to));
  };
  const dragging = dash.widgets.find((w) => w.id === dragId);

  if (dash.widgets.length === 0) {
    return (
      <div className="card">
        <Empty icon="ph:puzzle-piece-duotone" title="Dashboard vazio" text="Adicione widgets: números, pizzas, barras, evolução, metas… e cruze os dados do jeito que quiser."
          action={<button className="btn-primary" onClick={onAdd}><Plus size={16} /> Adicionar widget</button>} />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <SortableContext items={dash.widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-flow-dense grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {dash.widgets.map((w, i) => (
            <SortableWidget key={w.id} w={w} index={i} month={month} editing={editing}
              result={data.data?.[w.id]} loading={data.isLoading} fetching={data.isFetching}
              onEdit={onEdit} onRemove={onRemove} onDuplicate={onDuplicate} onResize={onResize} />
          ))}
          {editing && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
              onClick={onAdd}
              className="col-span-1 flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 text-sm font-semibold text-brand-700 transition-[background-color,border-color] duration-150 hover:border-brand-500 hover:bg-brand-50"
            >
              <Plus size={22} /> Adicionar widget
            </motion.button>
          )}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={dropAnimation}>
        {dragging && (
          <div className="pointer-events-none origin-center scale-[1.02] rounded-2xl shadow-[0_24px_48px_-16px_rgba(37,3,63,.35)]">
            <WidgetShell w={dragging} editing lifted>
              <WidgetBody w={dragging} month={month} result={data.data?.[dragging.id]} loading={false} />
            </WidgetShell>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SortableWidget({ w, index, month, editing, result, loading, fetching, onEdit, onRemove, onDuplicate, onResize }: {
  w: Widget; index: number; month: string; editing: boolean; result?: QueryResult; loading: boolean; fetching: boolean;
  onEdit: (w: Widget) => void; onRemove: (w: Widget) => void; onDuplicate: (w: Widget) => void; onResize: (w: Widget, s: Size) => void;
}) {
  const reduce = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: w.id, disabled: !editing, animateLayoutChanges, transition: { duration: 240, easing: EASE },
  });
  const tone = result && (w.viz === "kpi" || w.viz === "progress") ? toneFor(w, result.total) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Card com menu aberto sobe de camada (cada card animado tem seu próprio contexto de empilhamento).
      className={cx(SIZE_CLASS[w.size], "min-w-0 has-[[aria-expanded=true]]:z-30", isDragging && "z-10")}
    >
      {/* Entrada escalonada só na primeira montagem; o layout depois é do dnd-kit */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px) scale(0.98)" }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px) scale(1)" }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 10) * 0.04 }}
        className={cx("h-full transition-opacity duration-150", isDragging && "opacity-30")}
      >
        <WidgetShell
          w={w} editing={editing} tone={tone}
          handle={editing ? (
            <button ref={setActivatorNodeRef} {...attributes} {...listeners}
              className="-ml-1 cursor-grab touch-none rounded-lg p-1 text-ink-faint transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700 active:cursor-grabbing"
              aria-label={`Mover ${w.title}`}>
              <GripVertical size={16} />
            </button>
          ) : null}
          menu={editing ? <WidgetMenu w={w} onEdit={onEdit} onRemove={onRemove} onDuplicate={onDuplicate} onResize={onResize} /> : null}
          onOpen={editing ? () => onEdit(w) : undefined}
          dim={fetching && !loading}
        >
          <WidgetBody w={w} month={month} result={result} loading={loading} />
        </WidgetShell>
      </motion.div>
    </div>
  );
}

function WidgetShell({ w, editing, lifted, tone, handle, menu, onOpen, dim, children }: {
  w: Widget; editing: boolean; lifted?: boolean; tone?: ReturnType<typeof toneFor>; handle?: React.ReactNode; menu?: React.ReactNode;
  onOpen?: () => void; dim?: boolean; children: React.ReactNode;
}) {
  return (
    <section
      className={cx(
        "cq card flex h-full flex-col p-4 sm:p-5 transition-[box-shadow,outline-color] duration-200",
        editing && !lifted && "outline outline-1 outline-dashed outline-brand-300/70",
        tone && `ring-2 ${TONE_CLASS[tone].ring}`,
      )}
      aria-label={w.title}
    >
      <header className="mb-3 flex items-center gap-1.5">
        {handle}
        <h2 className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-snug" title={w.title} onDoubleClick={onOpen}>{w.title}</h2>
        {menu}
      </header>
      <div className={cx("min-h-0 flex-1 transition-opacity duration-200", dim && "opacity-70")}>{children}</div>
    </section>
  );
}

function WidgetBody({ w, month, result, loading }: { w: Widget; month: string; result?: QueryResult; loading: boolean }) {
  const height = w.tall ? 380 : 220;
  if (w.viz === "cards") return <CardsWidget month={month} />;
  if (w.viz === "upcoming") return <UpcomingWidget month={month} />;
  if (loading || !result) return <Skeleton lines={w.viz === "kpi" || w.viz === "progress" ? 2 : 5} height={w.viz === "kpi" || w.viz === "progress" ? undefined : height} />;
  return <WidgetChart w={w} data={result} height={height} />;
}

function WidgetMenu({ w, onEdit, onRemove, onDuplicate, onResize }: {
  w: Widget; onEdit: (w: Widget) => void; onRemove: (w: Widget) => void; onDuplicate: (w: Widget) => void; onResize: (w: Widget, s: Size) => void;
}) {
  return (
    <Popover className="w-52" trigger={(p) => (
      <button {...p} className="btn-ghost !p-1.5" aria-label={`Opções de ${w.title}`}><MoreHorizontal size={16} /></button>
    )}>
      {(close) => (
        <>
          <MenuItem icon={Pencil} label="Editar widget" onClick={() => { close(); onEdit(w); }} />
          <MenuItem icon={Copy} label="Duplicar" onClick={() => { close(); onDuplicate(w); }} />
          <div className="px-3 pb-1 pt-2">
            <p className="mb-1.5 text-[11px] font-semibold text-ink-faint">Largura</p>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(SIZE_LABEL) as Size[]).map((s) => (
                <button key={s} type="button" onClick={() => onResize(w, s)} aria-pressed={w.size === s} aria-label={`Largura ${SIZE_LABEL[s]}`}
                  className={cx("rounded-lg py-1 text-xs font-bold transition-colors duration-150",
                    w.size === s ? "bg-brand-600 text-white" : "bg-brand-950/[0.05] text-ink-soft hover:bg-brand-100")}>
                  {SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 h-px bg-brand-950/[0.06]" />
          <MenuItem icon={Trash2} label="Remover" danger onClick={() => { close(); onRemove(w); }} />
        </>
      )}
    </Popover>
  );
}

/* ---------- Primeiro acesso: escolher um modelo ---------- */
function TemplateGallery({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const reduce = useReducedMotion();
  const create = useMutation({
    mutationFn: (t: { name: string; icon: string; widgets: Widget[] }) => api.post<DashboardDef>("/dashboards", t),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      onCreated(d.id);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });
  const options = [
    ...TEMPLATES.map((t) => ({ key: t.key, name: t.name, icon: t.icon, description: t.description, build: t.build })),
    { key: "blank", name: "Em branco", icon: "ph:puzzle-piece-duotone", description: "Comece do zero e monte do seu jeito", build: () => [] as Widget[] },
  ];
  return (
    <div>
      <div className="mb-4 rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white">
        <p className="text-xl font-extrabold tracking-tight">Crie seu primeiro dashboard</p>
        <p className="mt-1 max-w-xl text-sm text-white/75">Comece por um modelo pronto e depois mude o que quiser: arraste, redimensione, troque gráficos e cruze os dados.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((t, i) => (
          <motion.button
            key={t.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: i * 0.05 }}
            disabled={create.isPending}
            onClick={() => create.mutate({ name: t.name, icon: t.icon, widgets: t.build() })}
            className="card group p-5 text-left transition-[box-shadow,border-color] duration-200 hover:border-brand-300 hover:shadow-[0_12px_32px_-16px_rgba(130,10,209,.45)] active:scale-[.99] disabled:opacity-60"
          >
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><AppIcon icon={t.icon} size={24} /></span>
            <p className="font-bold">{t.name}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{t.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Criar / renomear / excluir dashboard ---------- */
const ICONS = DASH_ICONS;

function DashModal({ mode, dash, onClose, onDone }: { mode: "create" | "edit"; dash?: DashboardDef; onClose: () => void; onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: dash?.name ?? "", icon: dash?.icon ?? DASH_ICONS[0], template: "blank" });
  const v = useFormValidation(f, {
    name: (x) => required("Dê um nome ao dashboard")(x) || (x.length > 40 ? "Máximo de 40 caracteres" : null),
  });
  const save = useMutation({
    mutationFn: () => {
      if (mode === "edit") return api.patch(`/dashboards/${dash!.id}`, { name: f.name.trim(), icon: f.icon }).then(() => dash!);
      const t = TEMPLATES.find((x) => x.key === f.template);
      return api.post<DashboardDef>("/dashboards", { name: f.name.trim(), icon: f.icon, widgets: t ? t.build() : [] });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      toast(mode === "edit" ? "Dashboard atualizado" : "Dashboard criado");
      onDone(d.id);
    },
    onError: (e) => { if (!v.applyServerError(e)) toast((e as Error).message, "error"); },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/dashboards/${dash!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      toast("Dashboard excluído");
      onDone();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "Editar dashboard" : "Novo dashboard"}>
      <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(); }}>
        <Field label="Nome" error={v.error("name")}>
          <input className="field" autoFocus maxLength={40} placeholder="Ex.: Reforma do apê, Gastos da Ceci" {...v.bind("name")} value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <div>
          <span className="label">Ícone</span>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setF({ ...f, icon: i })} aria-pressed={f.icon === i}
                className={cx("grid h-10 w-10 place-items-center rounded-xl text-lg transition-colors duration-150",
                  f.icon === i ? "bg-brand-100 ring-2 ring-brand-500" : "bg-brand-950/[0.04] hover:bg-brand-50")}>
                <AppIcon icon={i} size={20} className="text-brand-700" />
              </button>
            ))}
          </div>
        </div>
        {mode === "create" && (
          <div>
            <span className="label">Começar com</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ key: "blank", name: "Em branco", icon: "ph:puzzle-piece-duotone" }, ...TEMPLATES].map((t) => (
                <button key={t.key} type="button" onClick={() => setF({ ...f, template: t.key })} aria-pressed={f.template === t.key}
                  className={cx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150",
                    f.template === t.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-brand-950/10 hover:border-brand-300")}>
                  <AppIcon icon={t.icon} size={17} /> {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
          {mode === "edit" && (
            <button type="button" className="btn-danger sm:mr-auto" disabled={remove.isPending}
              onClick={() => confirm(`Excluir o dashboard "${dash!.name}"? Os lançamentos não são afetados.`) && remove.mutate()}>
              <Trash2 size={15} /> Excluir
            </button>
          )}
          <button type="submit" className="btn-primary sm:min-w-[140px]" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : mode === "edit" ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
