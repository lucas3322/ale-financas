import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { TONE_CLASS, toneFor, type QueryResult, type Widget } from "../../lib/analytics";
import { METHOD_ICON, METHOD_LABEL, money, moneyShort } from "../../lib/format";
import { useAction } from "../../lib/queries";
import type { CardSummary, Occ } from "../../lib/types";
import { Progress, cx } from "../ui";

const FALLBACK = ["#820AD1", "#F59E0B", "#14B8A6", "#EC4899", "#3B82F6", "#22C55E", "#F97316", "#6366F1", "#EF4444"];
const colorOf = (c: string | undefined, i: number) => c ?? FALLBACK[i % FALLBACK.length];

/** Duração/curva de entrada dos gráficos: ease-out forte, curta — o dado aparece sem enrolar. */
const CHART_MS = 520;

export function formatValue(w: Widget, v: number, short = false) {
  if (w.query.measure === "count") return Math.round(v).toLocaleString("pt-BR");
  return short ? moneyShort(v) : money(v);
}

/** Número que "corre" do valor anterior até o novo (ease-out quint). Sem animação se o usuário pediu menos movimento. */
export function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    const dur = 650;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 5);
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v; // se interromper no meio, continua do valor que está na tela
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{format(shown)}</>;
}

function toRows(r: QueryResult) {
  return r.labels.map((l, i) => {
    const row: Record<string, string | number> = { label: l.label };
    r.series.forEach((s) => (row[s.key] = s.values[i]));
    return row;
  });
}

function ChartTooltip({ w }: { w: Widget }) {
  return (
    <Tooltip
      cursor={{ fill: "rgba(130,10,209,.05)", stroke: "rgba(130,10,209,.2)" }}
      contentStyle={{ borderRadius: 12, border: "1px solid #EEE9F5", fontSize: 12, boxShadow: "0 8px 24px -8px rgba(37,3,63,.2)" }}
      formatter={(v: number, name: string) => [formatValue(w, v), name]}
    />
  );
}

const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "#9A94AD" } } as const;

export function WidgetChart({ w, data, height }: { w: Widget; data: QueryResult; height: number }) {
  const reduce = useReducedMotion();
  const anim = { isAnimationActive: !reduce, animationDuration: CHART_MS, animationEasing: "ease-out" as const };
  const rows = toRows(data);
  const multi = data.series.length > 1;
  const empty = data.count === 0 && w.query.measure !== "balance";

  if (empty) {
    return <div className="grid h-full place-items-center text-center text-sm text-ink-faint" style={{ height }}>Sem dados para esse filtro e período.</div>;
  }

  switch (w.viz) {
    case "kpi":
      return <Kpi w={w} data={data} />;
    case "progress":
      return <Goal w={w} data={data} />;
    case "donut":
    case "pie": {
      const s = data.series[0];
      const items = data.labels.map((l, i) => ({ name: l.label, value: Math.max(0, s.values[i]), color: colorOf(l.color, i) })).filter((x) => x.value > 0);
      const sum = items.reduce((a, b) => a + b.value, 0);
      return (
        <div className="flex h-full flex-wrap items-center justify-center gap-x-5 gap-y-3" style={{ minHeight: height }}>
          <div className="relative h-[170px] w-[170px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="name" innerRadius={w.viz === "donut" ? "66%" : 0} outerRadius="100%"
                  paddingAngle={w.viz === "donut" ? 2 : 1} stroke={w.viz === "pie" ? "#fff" : "none"} {...anim}>
                  {items.map((x) => <Cell key={x.name} fill={x.color} />)}
                </Pie>
                <ChartTooltip w={w} />
              </PieChart>
            </ResponsiveContainer>
            {w.viz === "donut" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Total</p>
                  <p className="text-sm font-extrabold tabular"><CountUp value={sum} format={(v) => formatValue(w, v, true)} /></p>
                </div>
              </div>
            )}
          </div>
          <ul className="min-w-[160px] flex-1 space-y-1.5">
            {items.slice(0, 7).map((x) => (
              <li key={x.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="font-semibold tabular">{sum ? Math.round((x.value / sum) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "barH": {
      const s = data.series[0];
      const max = Math.max(1, ...s.values.map(Math.abs));
      return (
        <ul className="space-y-2.5" style={{ minHeight: height }}>
          {data.labels.map((l, i) => (
            <li key={l.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium">{l.label}</span>
                <span className="font-semibold tabular">{formatValue(w, s.values[i])}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-950/[0.05]">
                <div
                  className="h-full origin-left rounded-full motion-safe:animate-[grow_.55s_cubic-bezier(0.23,1,0.32,1)_both]"
                  style={{ width: `${(Math.abs(s.values[i]) / max) * 100}%`, background: colorOf(l.color, i), animationDelay: `${i * 40}ms` }}
                />
              </div>
            </li>
          ))}
        </ul>
      );
    }
    case "bar":
    case "stacked":
      return (
        <div style={{ height }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#EEE9F5" />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={52} tickFormatter={(v: number) => formatValue(w, v, true).replace("R$ ", "")} />
              <ChartTooltip w={w} />
              {multi && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
              {data.series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId={w.viz === "stacked" ? "a" : undefined}
                  fill={colorOf(multi ? s.color : undefined, i)} maxBarSize={40}
                  radius={w.viz === "stacked" ? (i === data.series.length - 1 ? [6, 6, 0, 0] : 0) : [6, 6, 0, 0]} {...anim}>
                  {!multi && data.labels.map((l, li) => (
                    <Cell key={l.key} fill={w.query.groupBy === "month" ? (s.values[li] < 0 ? "#F43F5E" : "#AA55EC") : colorOf(l.color, li)} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "line":
    case "area": {
      const Chart = w.viz === "line" ? LineChart : AreaChart;
      return (
        <div style={{ height }}>
          <ResponsiveContainer>
            <Chart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                {data.series.map((s, i) => (
                  <linearGradient key={s.key} id={`g-${w.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorOf(multi ? s.color : "#820AD1", i)} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={colorOf(multi ? s.color : "#820AD1", i)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="#EEE9F5" />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={52} tickFormatter={(v: number) => formatValue(w, v, true).replace("R$ ", "")} />
              <ChartTooltip w={w} />
              {multi && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
              {data.series.map((s, i) =>
                w.viz === "line" ? (
                  <Line key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={colorOf(multi ? s.color : "#820AD1", i)}
                    strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} {...anim} />
                ) : (
                  <Area key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={colorOf(multi ? s.color : "#820AD1", i)}
                    strokeWidth={2.5} fill={`url(#g-${w.id}-${i})`} {...anim} />
                ),
              )}
            </Chart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "table":
      return <DataTable w={w} data={data} />;
    default:
      return null;
  }
}

function Delta({ w, now, prev }: { w: Widget; now: number; prev: number | null }) {
  if (prev == null || prev === 0) return null; // sem histórico, comparação não diz nada
  const diff = now - prev;
  const pct = prev !== 0 ? Math.round((diff / Math.abs(prev)) * 100) : null;
  // Para gastos, subir é ruim; para entradas/sobra, subir é bom.
  const upIsGood = w.query.measure !== "expense";
  const good = diff === 0 ? null : (diff > 0) === upIsGood;
  const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx("chip whitespace-nowrap", good == null ? "bg-brand-950/5 text-ink-soft" : good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
      <Icon size={12} strokeWidth={2.5} />
      {pct != null ? `${pct > 0 ? "+" : ""}${pct}%` : formatValue(w, diff, true)}
      <span className="font-medium opacity-70">vs. anterior</span>
    </span>
  );
}

function Kpi({ w, data }: { w: Widget; data: QueryResult }) {
  const tone = toneFor(w, data.total);
  return (
    <div>
      <p className={cx("kpi-value overflow-hidden text-ellipsis font-extrabold tabular transition-colors duration-200", tone ? TONE_CLASS[tone].text : data.total < 0 && w.query.measure !== "count" ? "text-rose-600" : "text-ink")}>
        <CountUp value={data.total} format={(v) => formatValue(w, v)} />
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Delta w={w} now={data.total} prev={data.previousTotal} />
        {w.query.aggregate === "monthlyAvg" && <span className="chip bg-brand-50 text-brand-700">média/mês</span>}
      </div>
    </div>
  );
}

function Goal({ w, data }: { w: Widget; data: QueryResult }) {
  const goal = w.goalCents ?? 0;
  const pct = goal ? (data.total / goal) * 100 : 0;
  const tone = toneFor(w, data.total) ?? (pct >= 100 ? "red" : pct >= 80 ? "amber" : null);
  const color = tone === "red" ? "#E11D48" : tone === "amber" ? "#F59E0B" : "#820AD1";
  return (
    <div>
      <p className={cx("kpi-value overflow-hidden text-ellipsis font-extrabold tabular", tone && TONE_CLASS[tone].text)}>
        <CountUp value={data.total} format={(v) => formatValue(w, v)} />
      </p>
      <p className="text-xs text-ink-faint">de {formatValue(w, goal)}</p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-brand-950/[0.06]">
        <div className="h-full rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        {pct >= 100 ? `Passou ${formatValue(w, data.total - goal)} da meta` : `${Math.round(pct)}% usado · sobram ${formatValue(w, goal - data.total)}`}
      </p>
    </div>
  );
}

function DataTable({ w, data }: { w: Widget; data: QueryResult }) {
  const multi = data.series.length > 1;
  const rowTotal = (i: number) => data.series.reduce((s, x) => s + x.values[i], 0);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-max text-xs tabular">
        <thead>
          <tr className="border-b border-brand-950/[0.06] text-left text-ink-faint">
            <th className="px-1 py-2 font-semibold" />
            {multi && data.series.map((s) => <th key={s.key} className="px-2 py-2 text-right font-semibold">{s.label}</th>)}
            <th className="px-1 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-950/[0.04]">
          {data.labels.map((l, i) => (
            <tr key={l.key} className="hover:bg-brand-50/40">
              <td className="whitespace-nowrap px-1 py-2 font-medium">{l.label}</td>
              {multi && data.series.map((s) => <td key={s.key} className="px-2 py-2 text-right text-ink-soft">{s.values[i] ? formatValue(w, s.values[i]) : "—"}</td>)}
              <td className="px-1 py-2 text-right font-bold">{formatValue(w, rowTotal(i))}</td>
            </tr>
          ))}
        </tbody>
        {data.labels.length > 1 && w.query.measure !== "balance" && (
          <tfoot>
            <tr className="border-t border-brand-950/10 font-bold">
              <td className="px-1 py-2">Total</td>
              {multi && data.series.map((s) => <td key={s.key} className="px-2 py-2 text-right">{formatValue(w, s.values.reduce((a, b) => a + b, 0))}</td>)}
              <td className="px-1 py-2 text-right">{formatValue(w, data.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ---------- Widgets especiais (usam endpoints próprios) ---------- */

export function CardsWidget({ month }: { month: string }) {
  const q = useQuery({ queryKey: ["cards-summary", month], queryFn: () => api.get<CardSummary[]>(`/cards/summary?month=${month}`) });
  if (!q.data) return <Skeleton lines={3} />;
  if (!q.data.length) return <p className="py-6 text-center text-sm text-ink-faint">Nenhum cartão cadastrado.</p>;
  return (
    <div className="space-y-4">
      {q.data.map((c) => (
        <div key={c.id}>
          <div className="mb-1.5 flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            <span className="flex-1 truncate font-semibold">{c.name}</span>
            <span className="text-xs text-ink-faint tabular">
              fatura {money(c.invoiceCents)}
              {c.nextInvoices[0] && ` · próx. ${money(c.nextInvoices[0].cents)}`}
            </span>
          </div>
          <Progress value={c.committedCents} max={c.limitCents} color={c.color} />
          <div className="mt-1 flex justify-between text-[11px] tabular text-ink-soft">
            <span>Usado {money(c.committedCents)}</span>
            <span className={cx(c.availableCents < 0 && "font-bold text-rose-600")}>Livre {money(c.availableCents)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UpcomingWidget({ month }: { month: string }) {
  const q = useQuery({ queryKey: ["month", month], queryFn: () => api.get<{ items: Occ[] }>(`/months/${month}`) });
  const pay = useAction((o: Occ) => api.put("/occurrences", { transactionId: o.transactionId, month: o.month, paid: true }), "Marcado como pago");
  if (!q.data) return <Skeleton lines={4} />;
  const items = q.data.items.filter((o) => o.type === "EXPENSE" && !o.paid && !o.skipped);
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-soft">🎉 Tudo pago neste mês!</p>;
  return (
    <ul className="divide-y divide-brand-950/[0.05]">
      {items.slice(0, 8).map((o) => (
        <li key={o.transactionId} className="flex items-center gap-2.5 py-2">
          <button onClick={() => pay.mutate(o)} aria-label={`Marcar ${o.description} como pago`}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-brand-200 text-transparent transition-colors duration-150 hover:border-brand-500 hover:text-brand-500">
            <Check size={12} strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{o.description} {o.installmentLabel && <span className="text-ink-faint">{o.installmentLabel}</span>}</p>
            <p className="truncate text-[11px] text-ink-faint">
              dia {o.day} · {o.card ? `💳 ${o.card.name}` : o.paymentMethod ? `${METHOD_ICON[o.paymentMethod]} ${METHOD_LABEL[o.paymentMethod]}` : ""}
            </p>
          </div>
          <span className="text-sm font-bold tabular">{money(o.amountCents)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className="space-y-2.5" style={{ minHeight: height }} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 rounded-full bg-brand-950/[0.06] motion-safe:animate-pulse" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
