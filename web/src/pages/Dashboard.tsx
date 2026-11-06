import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, CreditCard, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp } from "../components/dash/WidgetView";
import { Empty, MonthSwitcher, PageLoading, Progress, cx, useMonth } from "../components/ui";
import { useLayout } from "../layouts/AppLayout";
import { api } from "../lib/api";
import { AppIcon, CategoryIcon, MethodIcon, PaymentTag } from "../components/AppIcon";
import { METHOD_LABEL, firstName, money, monthLabel, moneyShort, percentLabel } from "../lib/format";
import { useAction, useMe } from "../lib/queries";
import type { Dashboard as DashboardData, Occ } from "../lib/types";

export default function Dashboard() {
  const { month } = useMonth();
  const { data: me } = useMe();
  const { openTx } = useLayout();
  const q = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.get<DashboardData>(`/dashboard?month=${month}`) });
  const togglePaid = useAction((o: Occ) => api.put("/occurrences", { transactionId: o.transactionId, month: o.month, paid: !o.paid }));

  const d = q.data;
  const isEmpty = d && d.totals.incomeCents === 0 && d.totals.expenseCents === 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="hidden lg:inline">Olá, {firstName(me?.user.name ?? "")} 👋</span>
            <span className="lg:hidden">Resumo do mês</span>
          </h1>
          <p className="hidden text-sm text-ink-soft lg:block">Aqui está o resumo de {me?.activeGroup?.name}</p>
        </div>
        <MonthSwitcher />
      </div>

      {q.isLoading || !d ? (
        <PageLoading />
      ) : isEmpty ? (
        <div className="card">
          <Empty
            icon="ph:plant-duotone"
            title="Vamos começar?"
            text="Cadastre os salários e as contas fixas da casa. Com isso já dá para ver quanto sobra este mês e nos próximos."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => openTx({ type: "INCOME", isSalary: true, description: "Salário", recurrence: "MONTHLY" })}>
                  <Plus size={16} /> Cadastrar salário
                </button>
                <button className="btn-outline" onClick={() => openTx()}>Adicionar gasto</button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Saldo do mês */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-[0_20px_40px_-20px_rgba(130,10,209,.7)] sm:p-6 lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            {(() => {
              const t = d.totals;
              const phase = d.month < t.today.slice(0, 7) ? "past" : d.month > t.today.slice(0, 7) ? "future" : "current";
              const main = phase === "future" ? t.netCents : t.realizedNetCents;
              const todayLabel = new Date(`${t.today}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              return (
                <>
                  <p className="text-sm font-medium text-white/70">
                    {phase === "current" ? `Saldo do mês até hoje (${todayLabel})` : phase === "past" ? `Sobra de ${monthLabel(d.month, { year: false })}` : `Sobra prevista em ${monthLabel(d.month, { year: false })}`}
                  </p>
                  <p className={cx("mt-1 text-4xl font-extrabold tracking-tight tabular sm:text-5xl", main < 0 && "text-rose-200")}>
                    <CountUp value={main} format={money} />
                  </p>
                  {phase === "current" && (
                    <p className="mt-1 text-sm text-white/75">
                      Previsto no fim do mês: <b className="tabular text-white">{money(t.netCents)}</b>
                      {t.scheduledExpenseCents > 0 && <> · {money(t.scheduledExpenseCents)} em pagamentos agendados</>}
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                      <p className="flex items-center gap-1 text-xs text-white/70"><ArrowUpRight size={14} /> Entradas</p>
                      <p className="mt-0.5 text-lg font-bold tabular">{money(phase === "current" ? t.realizedIncomeCents : t.incomeCents)}</p>
                      <p className="text-[11px] text-white/60">
                        {phase === "current" ? (t.scheduledIncomeCents ? `+ ${money(t.scheduledIncomeCents)} a receber` : "tudo recebido") : `${money(t.receivedCents)} marcado como recebido`}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                      <p className="flex items-center gap-1 text-xs text-white/70"><ArrowDownRight size={14} /> Saídas</p>
                      <p className="mt-0.5 text-lg font-bold tabular">{money(phase === "current" ? t.realizedExpenseCents : t.expenseCents)}</p>
                      <p className="text-[11px] text-white/60">
                        {phase === "current" ? (t.scheduledExpenseCents ? `+ ${money(t.scheduledExpenseCents)} agendado` : "nada agendado") : `${money(t.pendingCents)} a pagar`}
                      </p>
                    </div>
                  </div>
                  {phase !== "future" && t.overdueCents > 0 && (
                    <p className="mt-3 rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100">
                      <AppIcon icon="ph:warning-duotone" size={14} className="mr-1 inline align-[-2px]" />{money(t.overdueCents)} em contas com data vencida ainda não marcadas como pagas
                    </p>
                  )}
                </>
              );
            })()}
            {d.totals.expenseCents > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-white/70">
                  <span>Contas pagas</span>
                  <span>{Math.round((d.totals.paidCents / d.totals.expenseCents) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${(d.totals.paidCents / d.totals.expenseCents) * 100}%` }} />
                </div>
              </div>
            )}
          </section>

          {/* Pessoas */}
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Por pessoa</h2>
            <div className="space-y-3">
              {d.byPerson.filter((p) => p.incomeCents || p.expenseCents).map((p) => (
                <div key={p.id}>
                  <div className="flex items-baseline justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">{p.id === "shared" && <AppIcon icon="ph:house-line-duotone" size={15} className="text-ink-faint" />}{p.id === "shared" ? "Casa" : p.name}</p>
                    <p className={cx("text-sm font-bold tabular", p.netCents < 0 ? "text-rose-600" : "text-emerald-600")}>{money(p.netCents)}</p>
                  </div>
                  <p className="text-xs text-ink-faint tabular">
                    {money(p.incomeCents)} entra · {money(p.expenseCents)} sai
                  </p>
                </div>
              ))}
              {d.byPerson.every((p) => !p.incomeCents && !p.expenseCents) && <p className="text-sm text-ink-faint">Nada neste mês.</p>}
            </div>
          </section>

          {/* Cartões */}
          <section className="card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Limite dos cartões</h2>
              <Link to="/app/cartoes" className="flex items-center text-xs font-semibold text-brand-600">Ver faturas <ChevronRight size={14} /></Link>
            </div>
            {d.cards.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
                <CreditCard size={20} />
                <span className="flex-1">Cadastre seus cartões para acompanhar o limite comprometido.</span>
                <Link to="/app/cartoes" className="font-bold">Cadastrar</Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {d.cards.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-brand-950/[0.06] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                      <p className="flex-1 truncate text-sm font-bold">{c.name}</p>
                      <p className="text-xs text-ink-faint">vence dia {c.dueDay}</p>
                    </div>
                    <Progress value={c.committedCents} max={c.limitCents} color={c.color} />
                    <div className="mt-2 flex justify-between text-xs tabular">
                      <span className="text-ink-soft">Usado <b className="text-ink">{money(c.committedCents)}</b></span>
                      <span className={cx(c.availableCents < 0 ? "text-rose-600" : "text-ink-soft")}>Livre <b>{money(c.availableCents)}</b></span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      Fatura deste mês: {money(c.invoiceCents)}
                      {c.nextInvoices[0] && <> · próxima ({monthLabel(c.nextInvoices[0].month, { short: true })}): <b className="text-ink-soft">{money(c.nextInvoices[0].cents)}</b></>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Categorias */}
          <section className="card p-5 lg:row-span-2">
            <h2 className="mb-2 font-bold">Gastos por categoria</h2>
            {d.byCategory.length === 0 ? (
              <p className="text-sm text-ink-faint">Sem gastos neste mês.</p>
            ) : (
              <>
                <div className="relative mx-auto h-44 w-44">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={d.byCategory} dataKey="totalCents" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none">
                        {d.byCategory.map((c) => <Cell key={c.name} fill={c.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-ink-faint">Total</p>
                      <p className="text-sm font-extrabold tabular">{moneyShort(d.totals.expenseCents)}</p>
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-3">
                  {d.byCategory.map((c) => {
                    const pct = Math.round((c.totalCents / d.totals.expenseCents) * 100);
                    return (
                      <li key={c.name} className="text-sm">
                        <div className="flex items-center gap-2">
                          <CategoryIcon category={c} size="sm" />
                          <span className="min-w-0 flex-1 truncate font-medium" title={c.name}>{c.name}</span>
                          <span className="font-semibold tabular">{money(c.totalCents)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 pl-7">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-950/[0.05]">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                          </div>
                          <span className="w-8 text-right text-[11px] text-ink-faint tabular">{pct}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {d.byMethod.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-brand-950/[0.06] pt-3">
                    {d.byMethod.map((m) => (
                      <span key={m.method} className="chip bg-brand-50 text-brand-800">
                        <MethodIcon method={m.method as keyof typeof METHOD_LABEL} size={12} /> {METHOD_LABEL[m.method as keyof typeof METHOD_LABEL]} {moneyShort(m.totalCents)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* A pagar */}
          <section className="card p-5 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Contas a pagar</h2>
              <Link to="/app/lancamentos" className="flex items-center text-xs font-semibold text-brand-600">Ver tudo <ChevronRight size={14} /></Link>
            </div>
            {d.upcoming.length === 0 ? (
              <p className="flex items-center justify-center gap-1.5 py-4 text-sm text-ink-soft"><AppIcon icon="ph:confetti-duotone" size={18} className="text-brand-600" /> Tudo pago neste mês!</p>
            ) : (
              <ul className="divide-y divide-brand-950/[0.05]">
                {d.upcoming.map((o) => (
                  <li key={o.transactionId} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => togglePaid.mutate(o)}
                      aria-label={`Marcar ${o.description} como pago`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-brand-200 text-transparent transition hover:border-brand-500 hover:text-brand-500"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {o.description} {o.installmentLabel && <span className="text-ink-faint">{o.installmentLabel}</span>}
                      </p>
                      <p className="text-xs text-ink-faint">
                        dia {o.day} · <PaymentTag card={o.card} method={o.paymentMethod} />
                        {o.amountMode === "PERCENT" && ` · ${percentLabel(o)}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular">{money(o.amountCents)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Previsão */}
          <section className="card p-5 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Próximos 6 meses</h2>
                <p className="text-xs text-ink-faint">Barras: sobra de cada mês · Linha: saldo acumulado</p>
              </div>
              <Link to="/app/previsao" className="flex items-center text-xs font-semibold text-brand-600">Abrir previsão <ChevronRight size={14} /></Link>
            </div>
            <ForecastChart rows={d.forecast} height={220} />
          </section>
        </div>
      )}
    </div>
  );
}

export function ForecastChart({ rows, height = 260 }: { rows: DashboardData["forecast"]; height?: number }) {
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month, { short: true }) }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EEE9F5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9A94AD" }} />
          <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "#9A94AD" }} tickFormatter={(v: number) => moneyShort(v).replace("R$ ", "")} />
          <Tooltip
            cursor={{ fill: "rgba(130,10,209,.05)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #EEE9F5", fontSize: 12 }}
            formatter={(v: number, name: string) => [money(v), name === "netCents" ? "Sobra do mês" : "Acumulado"]}
          />
          <Bar dataKey="netCents" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {data.map((r) => <Cell key={r.month} fill={r.netCents < 0 ? "#F43F5E" : "#C68BF6"} />)}
          </Bar>
          <Line dataKey="accumulatedCents" stroke="#820AD1" strokeWidth={2.5} dot={{ r: 3, fill: "#820AD1" }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
