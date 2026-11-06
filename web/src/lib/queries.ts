import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/ui";
import { api, type ApiError } from "./api";
import type { Card, Category, Me } from "./types";

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api.get<Me>("/auth/me"), retry: false, staleTime: 60_000 });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
export const useCards = () => useQuery({ queryKey: ["cards"], queryFn: () => api.get<Card[]>("/cards") });

/** Mutação que invalida tudo que depende de lançamentos e mostra feedback. */
export function useAction<V, R = unknown>(
  fn: (v: V) => Promise<R>,
  okMsg?: string,
  onDone?: (r: R) => void,
  /** Retorne true se o erro já foi exibido no formulário (evita toast duplicado). */
  onFieldErrors?: (e: unknown) => boolean,
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      if (okMsg) toast(okMsg);
      onDone?.(r);
    },
    onError: (e: Error) => {
      if (onFieldErrors?.(e)) return toast("Confira os campos destacados", "error");
      if ((e as ApiError).status === 401) return; // sessão expirada: o app já trata
      toast(e.message, "error");
    },
  });
}
