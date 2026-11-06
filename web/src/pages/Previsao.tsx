import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, PageLoading, Segmented, cx, useMonth } from "../components/ui";
import { api } from "../lib/api";
import { currentMonth, money, monthLabel, monthTitle } from "../lib/format";
import type { ForecastRow } from "../lib/types";
import { ForecastChart } from "./Dashboard";
import { MonthInput } from "../components/DateInput";

type Horizon = "3" | "6" | "12" | "24";

export default function Previsao() {
  const nav = useNavigate();
  const { setMonth } = useMonth();
  const [from, setFrom] = useState(currentMonth());
  const [horizon, setHorizon] = useState<Horizon>("12");
  const [includePlanned, setIncludePlanned] = useState(false);
  const q = useQuery({
    queryKey: ["forecast", from, horizon, includePlanned],
    queryFn: () => api.get<{ initialBalanceCents: number; rows: ForecastRow[] }>(
      `/forecast?from=${from}&months=${horizon}&includePlanned=${includePlanned ? 1 : 0}`,
    ),
    placeholderData: (prev) => prev,
  });

  const rows = q.data?.rows ?? [];
  const last = rows[rows.length - 1];
  const worst = rows.reduce<ForecastRow | null>((w, r) => (!w || r.netCents < w.netCents ? r : w), null);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.netCents, 0) / rows.length) : 0;
  const firstNegative = rows.find((r) => r.accumulatedCents < 0);

  return (
    <div>
      <PageHeader title="Previsão" subtitle="Com base nos salários, contas fixas e parcelas — quanto sobra em cada mês e quanto vai acumulando." />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="label">A partir de</span>
          <MonthInput className="w-48" value={from} onChange={(m) => m && setFrom(m)} />
        </label>
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <span className="label">Período</span>
          <Segmented size="sm" value={horizon} onChange={setHorizon}
            options={[{ value: "3", label: "3 meses" }, { value: "6", label: "6 meses" }, { value: "12", label: "1 ano" }, { value: "24", label: "2 anos" }]} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={includePlanned} onChange={(e) => setIncludePlanned(e.target.checked)} />
          Incluir lista de compras
        </label>
      </div>

      {q.isLoading || !q.data ? (
        <PageLoading />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Insight icon={PiggyBank} tone="brand" label={`Saldo em ${monthLabel(last.month)}`} value={money(last.accumulatedCents)}
              sub={<>Partindo de {money(q.data.initialBalanceCents)} · <Link to="/app/grupo" className="font-semibold text-brand-600">ajustar</Link></>} />
            <Insight icon={avg >= 0 ? TrendingUp : TrendingDown} tone={avg >= 0 ? "green" : "red"} label="Sobra média por mês" value={money(avg)} />
            {worst && <Insight icon={AlertTriangle} tone={worst.netCents < 0 ? "red" : "amber"} label="Mês mais apertado"
              value={money(worst.netCents)} sub={monthTitle(worst.month)} />}
          </div>

          {firstNegative && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>Atenção: o saldo acumulado fica negativo em <b>{monthLabel(firstNegative.month)}</b>. Vale rever gastos ou adiar compras.</p>
            </div>
          )}

          <section className={cx("card mb-4 p-4 transition-opacity", q.isFetching && "opacity-60")}>
            <ForecastChart rows={rows} height={280} />
          </section>

          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-brand-950/[0.06] text-left text-xs font-semibold text-ink-faint">
                    <th className="px-4 py-3">Mês</th>
                    <th className="px-3 py-3 text-right">Entradas</th>
                    <th className="px-3 py-3 text-right">Saídas</th>
                    <th className="px-3 py-3 text-right">No cartão</th>
                    {includePlanned && <th className="px-3 py-3 text-right">Compras</th>}
                    <th className="px-3 py-3 text-right">Sobra</th>
                    <th className="px-4 py-3 text-right">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-950/[0.04] tabular">
                  {rows.map((r) => (
                    <tr key={r.month} className="cursor-pointer hover:bg-brand-50/50"
                      onClick={() => { setMonth(r.month); nav("/app/lancamentos"); }} title="Ver lançamentos do mês">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{monthTitle(r.month)}</td>
                      <td className="px-3 py-3 text-right text-emerald-600">{money(r.incomeCents)}</td>
                      <td className="px-3 py-3 text-right">{money(r.expenseCents)}</td>
                      <td className="px-3 py-3 text-right text-ink-faint">{money(r.cardCents)}</td>
                      {includePlanned && <td className="px-3 py-3 text-right text-amber-700">{r.plannedCents ? money(r.plannedCents) : "—"}</td>}
                      <td className={cx("px-3 py-3 text-right font-bold", r.netCents < 0 ? "text-rose-600" : "text-ink")}>{money(r.netCents)}</td>
                      <td className={cx("px-4 py-3 text-right font-extrabold", r.accumulatedCents < 0 ? "text-rose-600" : "text-brand-700")}>{money(r.accumulatedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-3 text-xs text-ink-faint">
            A previsão considera tudo o que está cadastrado: salários, entradas e gastos mensais, parcelas restantes e percentuais (como o dízimo) recalculados
            pela renda de cada mês. Clique em um mês para ver os lançamentos.
          </p>
        </>
      )}
    </div>
  );
}

function Insight({ icon: Icon, label, value, sub, tone }: {
  icon: typeof PiggyBank; label: string; value: string; sub?: ReactNode; tone: "brand" | "green" | "red" | "amber";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tones[tone])}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-faint">{label}</p>
        <p className="text-lg font-extrabold tabular">{value}</p>
        {sub && <p className="text-xs text-ink-soft">{sub}</p>}
      </div>
    </div>
  );
}
