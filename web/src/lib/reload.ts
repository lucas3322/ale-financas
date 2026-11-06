/**
 * Depois de um deploy, uma aba aberta ainda roda a versão antiga e tenta baixar arquivos
 * que não existem mais. Nesse caso recarregamos a página (uma vez só, para não entrar em loop).
 */
const KEY = "nc:auto-reload-at";

export function reloadForNewVersion(): boolean {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* armazenamento indisponível */ }
  if (Date.now() - last < 15_000) return false; // já tentamos agora há pouco: deixa a tela de erro aparecer
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* idem */ }
  window.location.reload();
  return true;
}

export const isChunkError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i.test(
    String((e as Error)?.message ?? e),
  );

/** React.lazy que recarrega a página se o pedaço do app sumiu num deploy novo. */
export function lazyImport<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((e) => {
      if (isChunkError(e) && reloadForNewVersion()) return new Promise<T>(() => {}); // a página vai recarregar
      throw e;
    });
}
