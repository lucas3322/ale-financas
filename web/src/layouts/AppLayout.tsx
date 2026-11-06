import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight, ChevronsUpDown, CreditCard, LayoutDashboard, LogOut, Plus, ShoppingBag, Tags, TrendingUp, Users,
} from "lucide-react";
import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { TransactionModal, type TxDraft } from "../components/TransactionForm";
import { Avatar, PageLoading, cx, useMonth } from "../components/ui";
import { api } from "../lib/api";
import { currentMonth, firstName } from "../lib/format";
import { useMe } from "../lib/queries";

const NAV = [
  { to: "/app", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/app/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/app/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/app/previsao", label: "Previsão", icon: TrendingUp },
  { to: "/app/compras", label: "Lista de compras", icon: ShoppingBag },
  { to: "/app/categorias", label: "Categorias", icon: Tags },
  { to: "/app/grupo", label: "Grupo", icon: Users },
];
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3]];

type Ctx = { openTx: (draft?: TxDraft) => void };
export const useLayout = () => useOutletContext<Ctx>();

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-600 text-white font-extrabold shadow-[0_6px_14px_-6px_rgba(130,10,209,.8)]">N</div>
      <span className={cx("text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>Nosso Caixa</span>
    </div>
  );
}

export default function AppLayout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [tx, setTx] = useState<{ open: boolean; draft?: TxDraft }>({ open: false });
  const [groupMenu, setGroupMenu] = useState(false);
  const { setMonth } = useMonth();

  const logout = async () => {
    await api.post("/auth/logout");
    qc.clear();
    setMonth(currentMonth());
    nav("/");
  };
  const switchGroup = async (groupId: string) => {
    await api.post("/groups/switch", { groupId });
    setGroupMenu(false);
    await qc.resetQueries();
  };

  if (!me) return null;
  const ctx: Ctx = { openTx: (draft) => setTx({ open: true, draft }) };

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-950/[0.06] bg-white lg:flex">
        <div className="px-5 pt-6 pb-4"><Logo /></div>

        <div className="relative px-3">
          <button
            onClick={() => setGroupMenu((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-brand-950/[0.08] px-3 py-2 text-left hover:border-brand-300"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Grupo</p>
              <p className="truncate text-sm font-bold">{me.activeGroup?.name}</p>
            </div>
            <ChevronsUpDown size={14} className="text-ink-faint" />
          </button>
          {groupMenu && (
            <div className="absolute inset-x-3 top-full z-10 mt-1 rounded-xl border border-brand-950/10 bg-white p-1 shadow-xl">
              {me.groups.map((g) => (
                <button key={g.id} onClick={() => switchGroup(g.id)}
                  className={cx("block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50",
                    g.id === me.activeGroup?.id && "font-bold text-brand-700")}>
                  {g.name}
                </button>
              ))}
              <NavLink to="/app/grupo" onClick={() => setGroupMenu(false)} className="block rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50">
                + Entrar com convite
              </NavLink>
            </div>
          )}
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                isActive ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-brand-950/[0.03] hover:text-ink",
              )}>
              <Icon size={18} strokeWidth={2.2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <button onClick={() => ctx.openTx()} className="btn-primary mb-3 w-full"><Plus size={18} /> Novo lançamento</button>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={me.user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{me.user.name}</p>
              <p className="truncate text-xs text-ink-faint">{me.user.email}</p>
            </div>
            <button onClick={logout} className="btn-ghost !p-2" title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-brand-950/[0.05] bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <NavLink to="/app/categorias" className="btn-ghost !p-2" aria-label="Categorias"><Tags size={18} /></NavLink>
          <NavLink to="/app/compras" className="btn-ghost !p-2" aria-label="Lista de compras"><ShoppingBag size={18} /></NavLink>
          <NavLink to="/app/grupo" className="btn-ghost !p-1.5" aria-label="Grupo e conta"><Avatar name={me.user.name} size={28} /></NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        <p className="mb-1 text-sm text-ink-soft lg:hidden">Olá, {firstName(me.user.name)} 👋</p>
        <Suspense fallback={<PageLoading />}><Outlet context={ctx} /></Suspense>
        {pathname === "/app/grupo" && (
          <button onClick={logout} className="btn-outline mt-6 w-full text-rose-600 lg:hidden">
            <LogOut size={16} /> Sair da conta
          </button>
        )}
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-950/[0.06] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5 items-end">
          {MOBILE_NAV.slice(0, 2).map((n) => <MobileLink key={n.to} {...n} />)}
          <div className="flex justify-center">
            <button onClick={() => ctx.openTx()} aria-label="Novo lançamento"
              className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-8px_rgba(130,10,209,.8)] active:scale-95 transition">
              <Plus size={26} />
            </button>
          </div>
          {MOBILE_NAV.slice(2).map((n) => <MobileLink key={n.to} {...n} />)}
        </div>
      </nav>

      <TransactionModal open={tx.open} draft={tx.draft} onClose={() => setTx({ open: false })} />
    </div>
  );
}

function MobileLink({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cx("flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold",
        isActive ? "text-brand-700" : "text-ink-faint")}>
      <Icon size={20} strokeWidth={2.2} />
      {label.split(" ")[0]}
    </NavLink>
  );
}
