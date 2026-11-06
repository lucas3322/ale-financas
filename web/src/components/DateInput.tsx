import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

/*
 * Calendário próprio no tema do app (o nativo do navegador não dá para estilizar).
 * - DateInput: "YYYY-MM-DD", campo com máscara dd/mm/aaaa (dá para digitar) + calendário.
 * - MonthInput: "YYYY-MM", escolhe só mês/ano.
 * O calendário abre num portal com posição fixa, então não é cortado por modais com rolagem.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const EASE = [0.23, 1, 0.32, 1] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const todayIso = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
};
function parseIso(v: string | null | undefined) {
  const m = v && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { y: +m[1], m0: +m[2] - 1, d: +m[3] } : null;
}
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
const toBr = (v: string) => {
  const p = parseIso(v);
  return p ? `${pad(p.d)}/${pad(p.m0 + 1)}/${p.y}` : "";
};
/** "06112026" ou "06/11/2026" → ISO válido, senão null */
function fromBr(text: string) {
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const d = +digits.slice(0, 2), m = +digits.slice(2, 4), y = +digits.slice(4);
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m - 1) || y < 1900) return null;
  return iso(y, m - 1, d);
}
const maskBr = (text: string) => {
  const d = text.replace(/\D/g, "").slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Posição fixa do calendário: abaixo do campo, ou acima se não couber. */
function useAnchor(open: boolean, anchor: React.RefObject<HTMLElement | null>, height: number) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const place = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 300;
    const up = window.innerHeight - r.bottom < height + 12 && r.top > height + 12;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: up ? r.top - height - 6 : r.bottom + 6, left, up });
  }, [anchor, height]);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // rolagem do modal também
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);
  return pos;
}

function useDismiss(open: boolean, refs: React.RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (refs.every((r) => !r.current?.contains(e.target as Node))) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, refs, close]);
}

function Shell({ open, pos, panelRef, children, onKeyDown }: {
  open: boolean; pos: ReturnType<typeof useAnchor>; panelRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode; onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const reduce = useReducedMotion();
  const from = reduce ? { opacity: 0 } : { opacity: 0, transform: `scale(0.97) translateY(${pos?.up ? 4 : -4}px)` };
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Calendário"
          onKeyDown={onKeyDown}
          initial={from}
          animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
          exit={from}
          transition={{ duration: 0.16, ease: EASE }}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 300, transformOrigin: pos.up ? "bottom left" : "top left" }}
          className="z-[70] rounded-2xl border border-brand-950/10 bg-white p-3 shadow-[0_20px_50px_-12px_rgba(37,3,63,.35)]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NavHeader({ label, onLabel, onPrev, onNext, labelHint }: { label: string; onLabel?: () => void; onPrev: () => void; onNext: () => void; labelHint?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button type="button" onClick={onPrev} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700" aria-label="Anterior">
        <ChevronLeft size={18} />
      </button>
      <button type="button" onClick={onLabel} disabled={!onLabel} title={labelHint}
        className="rounded-lg px-2.5 py-1 text-sm font-bold capitalize text-ink transition-colors duration-150 enabled:hover:bg-brand-50 enabled:hover:text-brand-700">
        {label}
      </button>
      <button type="button" onClick={onNext} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700" aria-label="Próximo">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/** Grade de meses de um ano (usada no DateInput para pular rápido e no MonthInput). */
function MonthGrid({ year, selected, current, onPick }: { year: number; selected?: string; current: string; onPick: (m0: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 py-1">
      {MONTHS_SHORT.map((label, m0) => {
        const key = `${year}-${pad(m0 + 1)}`;
        const on = selected === key;
        return (
          <button key={label} type="button" onClick={() => onPick(m0)}
            className={cx("rounded-xl py-2.5 text-sm font-semibold capitalize transition-colors duration-150",
              on ? "bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(130,10,209,.7)]" : current === key ? "text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50" : "text-ink hover:bg-brand-50")}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function DateInput({ value, onChange, name, onBlur, min = "2000-01-01", max = "2100-12-31", clearable = false, "aria-invalid": invalid }: {
  value: string; onChange: (v: string) => void; name?: string; onBlur?: () => void;
  min?: string; max?: string; clearable?: boolean; "aria-invalid"?: boolean;
}) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const [text, setText] = useState(toBr(value));
  const sel = parseIso(value);
  const today = todayIso();
  const t = parseIso(today)!;
  const [view, setView] = useState({ y: sel?.y ?? t.y, m0: sel?.m0 ?? t.m0 });
  const [focusDay, setFocusDay] = useState(value || today);
  const [dir, setDir] = useState(0);

  useEffect(() => setText(toBr(value)), [value]);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [wrap, panel], close);
  const pos = useAnchor(open, wrap, mode === "days" ? 372 : 250);

  const openCal = () => {
    const s = parseIso(value) ?? t;
    setView({ y: s.y, m0: s.m0 });
    setFocusDay(value || today);
    setMode("days");
    setOpen(true);
  };
  const shift = (n: number) => {
    setDir(n);
    setView((v) => {
      const idx = v.y * 12 + v.m0 + n;
      return { y: Math.floor(idx / 12), m0: ((idx % 12) + 12) % 12 };
    });
  };
  const pick = (v: string) => {
    if (v < min || v > max) return;
    onChange(v);
    setOpen(false);
    input.current?.focus();
  };

  // Foco segue o dia "focado" (navegação por teclado).
  useEffect(() => {
    if (!open || mode !== "days") return;
    const id = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, mode, focusDay, view]);

  const moveFocus = (deltaDays: number) => {
    const p = parseIso(focusDay)!;
    const d = new Date(p.y, p.m0, p.d + deltaDays);
    const next = iso(d.getFullYear(), d.getMonth(), d.getDate());
    if (d.getMonth() !== view.m0 || d.getFullYear() !== view.y) shift((d.getFullYear() * 12 + d.getMonth()) - (view.y * 12 + view.m0));
    setFocusDay(next);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); input.current?.focus(); return; }
    if (mode !== "days") return;
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (keys[e.key] !== undefined) { e.preventDefault(); moveFocus(keys[e.key]); }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const p = parseIso(focusDay)!;
      const n = e.key === "PageUp" ? -1 : 1;
      const d = new Date(p.y, p.m0 + n, Math.min(p.d, daysIn(p.y, p.m0 + n)));
      shift(n);
      setFocusDay(iso(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  };

  // Grade de 6 semanas começando no domingo.
  const first = new Date(view.y, view.m0, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.y, view.m0, 1 - first + i);
    return { iso: iso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.m0 };
  });

  return (
    <div ref={wrap} className="relative">
      <input
        ref={input}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        aria-invalid={invalid}
        className="field pr-11 tabular"
        value={text}
        onFocus={() => !open && openCal()}
        onClick={() => !open && openCal()}
        onChange={(e) => {
          const masked = maskBr(e.target.value);
          setText(masked);
          const v = fromBr(masked);
          if (v && v >= min && v <= max) {
            onChange(v);
            const p = parseIso(v)!;
            setView({ y: p.y, m0: p.m0 });
            setFocusDay(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) { e.preventDefault(); openCal(); }
          if (e.key === "ArrowDown" && open) { e.preventDefault(); panel.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus(); }
          if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          if (e.key === "Tab") setOpen(false);
        }}
        onBlur={() => {
          // Texto incompleto volta para a data atual (nada de data "pela metade").
          if (!fromBr(text)) setText(toBr(value));
          onBlur?.();
        }}
      />
      <button type="button" tabIndex={-1} aria-label="Abrir calendário" onClick={() => (open ? setOpen(false) : openCal())}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700">
        <CalendarDays size={17} />
      </button>

      <Shell open={open} pos={pos} panelRef={panel} onKeyDown={onKey}>
        {mode === "days" ? (
          <>
            <NavHeader label={`${MONTHS[view.m0]} ${view.y}`} labelHint="Escolher mês e ano" onLabel={() => setMode("months")} onPrev={() => shift(-1)} onNext={() => shift(1)} />
            <div className="grid grid-cols-7 pb-1">
              {WEEKDAYS.map((w, i) => <span key={i} className="py-1 text-center text-[11px] font-bold text-ink-faint">{w}</span>)}
            </div>
            <div className="relative overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={`${view.y}-${view.m0}`}
                  role="grid"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dir >= 0 ? 16 : -16}px)` }}
                  animate={{ opacity: 1, transform: "translateX(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dir >= 0 ? -16 : 16}px)` }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="grid grid-cols-7 gap-y-1"
                >
                  {cells.map((c) => {
                    const selected = c.iso === value;
                    const isToday = c.iso === today;
                    const disabled = c.iso < min || c.iso > max;
                    return (
                      <button
                        key={c.iso}
                        type="button"
                        data-day={c.iso}
                        tabIndex={c.iso === focusDay ? 0 : -1}
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={new Date(`${c.iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        onClick={() => pick(c.iso)}
                        className={cx(
                          "mx-auto grid h-9 w-9 place-items-center rounded-xl text-sm tabular outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-brand-400",
                          selected
                            ? "bg-brand-600 font-bold text-white shadow-[0_6px_14px_-6px_rgba(130,10,209,.8)]"
                            : isToday
                              ? "font-bold text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50"
                              : c.inMonth
                                ? "text-ink hover:bg-brand-50"
                                : "text-ink-faint/60 hover:bg-brand-950/[0.03]",
                          disabled && "pointer-events-none opacity-30",
                        )}
                      >
                        {c.day}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <>
            <NavHeader label={String(view.y)} onPrev={() => setView((v) => ({ ...v, y: v.y - 1 }))} onNext={() => setView((v) => ({ ...v, y: v.y + 1 }))} />
            <MonthGrid year={view.y} selected={sel ? `${sel.y}-${pad(sel.m0 + 1)}` : undefined} current={today.slice(0, 7)}
              onPick={(m0) => { setView((v) => ({ ...v, m0 })); setFocusDay(iso(view.y, m0, Math.min(sel?.d ?? 1, daysIn(view.y, m0)))); setMode("days"); }} />
          </>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-brand-950/[0.06] pt-2">
          {clearable ? (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-950/[0.04]">Limpar</button>
          ) : <span />}
          <button type="button" onClick={() => pick(today)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">Hoje</button>
        </div>
      </Shell>
    </div>
  );
}

export function MonthInput({ value, onChange, name, onBlur, clearable = false, placeholder = "Escolher mês", className, "aria-invalid": invalid }: {
  value: string; onChange: (v: string) => void; name?: string; onBlur?: () => void; clearable?: boolean; placeholder?: string;
  className?: string; "aria-invalid"?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const now = todayIso().slice(0, 7);
  const [year, setYear] = useState(Number((value || now).slice(0, 4)));
  const close = useCallback(() => { setOpen(false); onBlur?.(); }, [onBlur]);
  useDismiss(open, [wrap, panel], close);
  const pos = useAnchor(open, wrap, 250);
  const [y, m] = (value || "").split("-").map(Number);

  return (
    <div ref={wrap} className={cx("relative", className)}>
      <button ref={btn} type="button" name={name} aria-invalid={invalid} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setYear(Number((value || now).slice(0, 4))); setOpen((o) => !o); }}
        className="field flex items-center gap-2 text-left">
        <span className={cx("min-w-0 flex-1 truncate", !value && "text-ink-faint")}>
          {value ? `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}` : placeholder}
        </span>
        <CalendarDays size={17} className="shrink-0 text-ink-faint" />
      </button>
      <Shell open={open} pos={pos} panelRef={panel} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
        <NavHeader label={String(year)} onPrev={() => setYear((v) => v - 1)} onNext={() => setYear((v) => v + 1)} />
        <MonthGrid year={year} selected={value || undefined} current={now} onPick={(m0) => { onChange(`${year}-${pad(m0 + 1)}`); setOpen(false); btn.current?.focus(); }} />
        <div className="mt-2 flex items-center justify-between border-t border-brand-950/[0.06] pt-2">
          {clearable ? (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-950/[0.04]">Limpar</button>
          ) : <span />}
          <button type="button" onClick={() => { onChange(now); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">Este mês</button>
        </div>
      </Shell>
    </div>
  );
}
