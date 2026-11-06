import { Component, type ReactNode } from "react";
import { isChunkError, reloadForNewVersion } from "../lib/reload";
import { AppIcon } from "./AppIcon";

/** Qualquer erro inesperado na tela vira uma mensagem com "Recarregar" — nunca uma tela branca. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isChunkError(error)) reloadForNewVersion();
    console.error("[tela]", error);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Trocar de tela limpa o erro (ex.: o problema era só naquela página).
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const newVersion = isChunkError(this.state.error);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <AppIcon icon={newVersion ? "ph:arrows-clockwise-duotone" : "ph:warning-duotone"} size={28} />
        </div>
        <p className="font-bold">{newVersion ? "Saiu uma versão nova do app" : "Algo deu errado nesta tela"}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {newVersion ? "Recarregue para usar a versão mais recente." : "Seus dados estão salvos. Recarregue a página para continuar."}
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={() => window.location.reload()}>Recarregar</button>
          <a className="btn-outline" href="/app">Ir para o início</a>
        </div>
      </div>
    );
  }
}
