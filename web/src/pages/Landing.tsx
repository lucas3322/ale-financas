import {
  ArrowRight, CalendarClock, CreditCard, Layers, Percent, ShoppingBag, Tags, TrendingUp, Users, Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../layouts/AppLayout";
import { useMe } from "../lib/queries";

const FEATURES = [
  { icon: Wallet, title: "Salários e entradas", text: "Cada um registra o seu salário — mesmo quem recebe em duas datas no mês — e as rendas extras." },
  { icon: Tags, title: "Saídas por categoria", text: "Moradia, mercado, filhos, empréstimos… categorias prontas e personalizáveis, com cor e ícone." },
  { icon: CalendarClock, title: "Recorrentes com prazo", text: "Condomínio todo mês, ou um empréstimo que acaba em 8 meses. Cadastre uma vez e pronto." },
  { icon: Layers, title: "Parcelados de verdade", text: "Já está na parcela 3 de 6? Informe e o app mostra só o que falta, mês a mês." },
  { icon: Percent, title: "Percentual da renda", text: "Dízimo de 10%: se o salário aumentar, o valor acompanha sozinho. Sem refazer conta." },
  { icon: CreditCard, title: "Cartões e limite", text: "A compra no cartão compromete o limite no mês da compra — e o parcelado ocupa o valor inteiro." },
  { icon: ShoppingBag, title: "Lista de compras", text: "Planeje a pia, os móveis, o cooktop… com Pix, boleto ou cartão. Comprou? Vira gasto num toque." },
  { icon: TrendingUp, title: "Previsão do futuro", text: "Veja quanto sobra em dezembro, janeiro, março… com o saldo acumulando mês após mês." },
  { icon: Users, title: "Finanças a dois", text: "Gere um código de convite e a outra pessoa entra no mesmo grupo. Tudo sincronizado." },
];

const STEPS = [
  { n: "1", title: "Crie sua conta", text: "Leva menos de um minuto. Já vem com categorias prontas para usar." },
  { n: "2", title: "Convide quem divide a casa", text: "Gere um código como K7PX-29QM e mande no WhatsApp. Pronto, estão juntos." },
  { n: "3", title: "Cadastre o mês uma vez", text: "Salários, contas fixas, parcelas e cartões. Os próximos meses se montam sozinhos." },
];

export default function Landing() {
  const { data: me } = useMe();

  return (
    <div className="min-h-dvh bg-white text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-brand-950/[0.06] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            {me ? (
              <Link to="/app" className="btn-primary">Ir para o app <ArrowRight size={16} /></Link>
            ) : (
              <>
                <Link to="/entrar" className="btn-ghost">Entrar</Link>
                <Link to="/cadastro" className="btn-primary !px-3 sm:!px-4">
                  <span className="sm:hidden">Criar conta</span>
                  <span className="hidden sm:inline">Criar conta grátis</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-brand-200/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-[-15%] h-[420px] w-[420px] rounded-full bg-brand-100/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <span className="chip bg-brand-50 text-brand-700 !text-xs !px-3 !py-1">💜 Feito para casais e famílias</span>
            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[58px]">
              A planilha da casa,<br />
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">sem a planilha.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Salários, contas fixas, parcelas, cartões e dízimo num só lugar — e uma previsão clara de quanto vai sobrar
              nos próximos meses. Para vocês dois decidirem juntos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={me ? "/app" : "/cadastro"} className="btn-primary !px-6 !py-3.5 !text-base">
                {me ? "Abrir meu painel" : "Começar agora — é grátis"} <ArrowRight size={18} />
              </Link>
              {!me && <Link to="/entrar" className="btn-outline !px-6 !py-3.5 !text-base">Já tenho conta</Link>}
            </div>
            <p className="mt-4 text-xs text-ink-faint">Sem cartão de crédito. Seus dados ficam só com o seu grupo.</p>
          </div>

          <HeroMock />
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="bg-[#F6F3FA] py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Tudo que a planilha fazia</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">…e o que ela nunca conseguiu fazer direito.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Como funciona</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-soft">Três passos e o mês seguinte já aparece montado.</p>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative text-center md:text-left">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-lg font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(130,10,209,.9)] md:mx-0">
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-14 text-center text-white sm:px-12">
          <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/5" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Quanto vai sobrar em março?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-brand-100">Cadastre o mês de hoje e descubra. A gente soma o resto.</p>
          <Link to={me ? "/app/previsao" : "/cadastro"} className="btn relative mt-8 bg-white !px-6 !py-3.5 !text-base text-brand-700 hover:bg-brand-50">
            {me ? "Ver minha previsão" : "Criar conta grátis"} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-950/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-ink-faint sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Nosso Caixa · Finanças da casa, juntos.</p>
        </div>
      </footer>
    </div>
  );
}

/** Mock do painel feito só com JSX/CSS. */
function HeroMock() {
  const bars = [
    { m: "nov", v: 38 }, { m: "dez", v: 52 }, { m: "jan", v: 61 }, { m: "fev", v: 74 }, { m: "mar", v: 88 }, { m: "abr", v: 100 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="rotate-[-1.5deg] rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white shadow-[0_30px_60px_-20px_rgba(85,9,138,.6)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-100">Sobra de novembro</p>
          <span className="chip bg-white/15 text-white">Lucas & Ale</span>
        </div>
        <p className="mt-1 text-4xl font-extrabold tabular">R$ 4.830,00</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-brand-100">Entradas</p>
            <p className="font-bold tabular">R$ 16.255,20</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-brand-100">Saídas</p>
            <p className="font-bold tabular">R$ 11.425,20</p>
          </div>
        </div>
      </div>

      <div className="card relative -mt-4 ml-6 rotate-[1deg] p-5 sm:ml-12">
        <div className="flex items-center justify-between text-sm">
          <p className="font-bold">💳 Nubank</p>
          <p className="text-ink-soft tabular">R$ 2.180 de R$ 8.000</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-950/[0.06]">
          <div className="h-full w-[27%] rounded-full bg-brand-600" />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">Sofá 1/10 · Mercado · Farmácia</p>
      </div>

      <div className="card relative -mt-2 mr-6 rotate-[-0.5deg] p-5 sm:mr-12">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Previsão · saldo acumulado</p>
          <span className="chip bg-emerald-50 text-emerald-700">↑ crescendo</span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-2">
          {bars.map((b, i) => (
            <div key={b.m} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={i === 0 ? "w-full rounded-lg bg-brand-600" : "w-full rounded-lg bg-brand-200"}
                style={{ height: `${b.v}%` }}
              />
              <span className="text-[10px] font-semibold text-ink-faint">{b.m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
