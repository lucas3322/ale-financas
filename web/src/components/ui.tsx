import { ChevronLeft, ChevronRight, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { addMonths, centsToInput, currentMonth, monthTitle, parseMoney } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Modal (vira bottom-sheet no celular) ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px] animate-[fade_.15s_ease-out]" onClick={onClose} />
      <div className={cx(
        "relative w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col motion-safe:animate-[pop_.24s_cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-[fade_.15s_ease-out]",
        wide === "xl" ? "sm:max-w-5xl" : wide ? "sm:max-w-2xl" : "sm:max-w-lg",
      )}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-ghost !p-2 -mr-2" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Campos ---------- */
export function Field({ label, children, hint, error, className, optional }: {
  label: string; children: ReactNode; hint?: ReactNode; error?: string; className?: string; optional?: boolean;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(opcional)</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-rose-600 animate-[fade_.15s_ease-out]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>
      )}
    </label>
  );
}

export function MoneyInput({ value, onChange, autoFocus, placeholder = "0,00", ...rest }: {
  value: number; onChange: (cents: number) => void; autoFocus?: boolean; placeholder?: string;
  name?: string; onBlur?: () => void; "aria-invalid"?: boolean;
}) {
  // Máscara de moeda brasileira: só dígitos, preenchendo pelos centavos (2 → 0,02 → 24,99 → 2.499,00).
  // O valor exibido é sempre derivado dos centavos — não há texto "solto" para ficar fora do padrão.
  const display = value ? centsToInput(value) : "";
  const setFromDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11); // até R$ 999.999.999,99
    onChange(digits ? Number(digits) : 0);
  };
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-faint">R$</span>
      <input
        className="field pl-10 tabular font-semibold"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={display}
        name={rest.name}
        aria-invalid={rest["aria-invalid"]}
        onChange={(e) => setFromDigits(e.target.value)}
        onPaste={(e) => {
          // Colar "1.234,56", "R$ 1234,5" ou "1234.56" vira o valor certo (respeitando a vírgula/ponto decimal).
          const text = e.clipboardData.getData("text");
          if (/[.,]\d{1,2}\s*$/.test(text) || !/[.,]/.test(text)) {
            e.preventDefault();
            const cents = parseMoney(text);
            onChange(cents > 0 && cents <= 99_999_999_999 ? cents : 0);
          }
        }}
        onKeyDown={(e) => {
          // O cursor fica sempre no fim: editar no meio de "1.234,56" não faz sentido numa máscara de centavos.
          if (e.key === "ArrowLeft" || e.key === "Home") e.preventDefault();
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
        onBlur={() => rest.onBlur?.()}
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-brand-950/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-lg font-semibold transition whitespace-nowrap",
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
            value === o.value ? "bg-white text-brand-700 shadow-sm" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, max, color = "#820AD1" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const danger = pct >= 90;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-950/[0.06]">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: danger ? "#E11D48" : color }} />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">{icon}</div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />;
}

export function PageLoading() {
  return <div className="grid place-items-center py-24"><Spinner /></div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Mês selecionado (compartilhado entre as telas) ---------- */
const MonthCtx = createContext<{ month: string; setMonth: (m: string) => void }>({ month: currentMonth(), setMonth: () => {} });
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthCtx.Provider value={{ month, setMonth }}>{children}</MonthCtx.Provider>;
}
export const useMonth = () => useContext(MonthCtx);

export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  const isCurrent = month === currentMonth();
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-card border border-brand-950/[0.04]">
      <button className="btn-ghost !p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
      <button
        className="min-w-[132px] px-1 text-sm font-bold"
        onClick={() => setMonth(currentMonth())}
        title="Voltar para o mês atual"
      >
        {monthTitle(month)}
        {!isCurrent && <span className="block text-[10px] font-semibold text-brand-600">voltar para hoje</span>}
      </button>
      <button className="btn-ghost !p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></button>
    </div>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 lg:bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={cx(
            "rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg animate-[pop_.18s_ease-out]",
            t.tone === "ok" ? "bg-ink" : "bg-rose-600",
          )}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

/* ---------- Popover / menu ----------
 * Único componente para menus suspensos: fecha ao clicar fora ou com Esc (devolvendo o foco ao botão),
 * abre para cima quando não há espaço embaixo e nasce do ponto do botão que o abriu.
 */
export function Popover({ trigger, children, align = "right", className = "w-56" }: {
  trigger: (p: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right" | "stretch";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  const close = useCallback((focus = false) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      // Abre para cima se faltar espaço embaixo (ex.: último item da lista, barra inferior do celular).
      setUp(window.innerHeight - r.bottom < 280 && r.top > 280);
    }
    setOpen((o) => !o);
  };

  const pos = align === "stretch" ? "inset-x-0" : align === "right" ? "right-0" : "left-0";
  const origin = `${up ? "bottom" : "top"} ${align === "left" ? "left" : align === "right" ? "right" : "center"}`;
  const from = reduce ? { opacity: 0 } : { opacity: 0, transform: `scale(0.96) translateY(${up ? 4 : -4}px)` };

  return (
    <div ref={wrap} className="relative">
      {trigger({ onClick: toggle, "aria-expanded": open, "aria-haspopup": "menu", ref: btn })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={from}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={from}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: origin }}
            className={cx("absolute z-40 rounded-xl border border-brand-950/10 bg-white p-1 shadow-xl", pos, up ? "bottom-full mb-1" : "top-full mt-1", className)}
          >
            {children(() => close(true))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon?: LucideIcon; label: ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button role="menuitem" type="button" onClick={onClick}
      className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
        danger ? "text-rose-600 hover:bg-rose-50" : "hover:bg-brand-50")}>
      {Icon && <Icon size={15} className={danger ? "" : "text-ink-faint"} />}
      {label}
    </button>
  );
}

/* ---------- Rolagem horizontal ----------
 * Funciona com mouse: a roda vertical rola para o lado, setas ‹ › aparecem quando há mais conteúdo
 * e um esmaecido na borda indica que continua. No toque, é a rolagem nativa com "encaixe".
 */
export function HScroll({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Roda do mouse (vertical) rola na horizontal — só quando ainda há para onde ir, senão a página rola normal.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const canScroll = e.deltaY > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0;
      if (!canScroll) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [update]);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        role="region"
        aria-label={label}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {!edges.start && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
          <button type="button" onClick={() => page(-1)} aria-label="Ver anteriores"
            className="absolute left-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-brand-950/10 bg-white text-ink-soft shadow-md transition-colors duration-150 hover:text-brand-700">
            <ChevronLeft size={16} />
          </button>
        </>
      )}
      {!edges.end && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
          <button type="button" onClick={() => page(1)} aria-label="Ver próximas"
            className="absolute right-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-brand-950/10 bg-white text-ink-soft shadow-md transition-colors duration-150 hover:text-brand-700">
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
