import { useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { PageLoading, useMonth } from "./components/ui";
import { currentMonth } from "./lib/format";
import { SESSION_EXPIRED_EVENT } from "./lib/api";
import { useMe } from "./lib/queries";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Auth";

// Telas internas carregadas sob demanda: a landing não baixa gráficos nem formulários do app.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const Cartoes = lazy(() => import("./pages/Cartoes"));
const Compras = lazy(() => import("./pages/Compras"));
const Previsao = lazy(() => import("./pages/Previsao"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Grupo = lazy(() => import("./pages/Grupo"));

function Private({ children }: { children: JSX.Element }) {
  const me = useMe();
  if (me.isLoading) return <PageLoading />;
  if (me.isError || !me.data) return <Navigate to="/entrar" replace />;
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const me = useMe();
  if (me.isLoading) return <PageLoading />;
  if (me.data) return <Navigate to="/app" replace />;
  return children;
}

/** Quando o refresh token não renova mais (inativo/revogado), desloga e manda para o login (que mostra o aviso). */
function useSessionGuard() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { setMonth } = useMonth();
  useEffect(() => {
    const onExpired = () => {
      if (!qc.getQueryData(["me"])) return; // visitante anônimo: nada a fazer
      qc.clear();
      setMonth(currentMonth());
      nav("/entrar?expirou=1", { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [qc, nav, setMonth]);
}

export default function App() {
  useSessionGuard();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/entrar" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/cadastro" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/app" element={<Private><AppLayout /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="cartoes" element={<Cartoes />} />
        <Route path="compras" element={<Compras />} />
        <Route path="previsao" element={<Previsao />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="grupo" element={<Grupo />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
