import { useCallback, useMemo, useRef, useState } from "react";
import { ApiError } from "./api";

export type Rules<T> = { [K in keyof T]?: (value: T[K], all: T) => string | null | undefined | false };

/**
 * Validação de formulário com a UX certa:
 * - erro só aparece depois que a pessoa sai do campo (blur) ou tenta enviar;
 * - erro some assim que o valor fica válido;
 * - erros do servidor (por campo) aparecem no input correspondente e somem ao editar;
 * - ao enviar com erro, o foco vai para o primeiro campo inválido.
 */
export function useFormValidation<T extends object>(values: T, rules: Rules<T>) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<{ fields: Record<string, string>; snapshot: Partial<T> }>({ fields: {}, snapshot: {} });
  const formRef = useRef<HTMLFormElement>(null);

  const clientErrors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    for (const k of Object.keys(rules) as (keyof T)[]) {
      const msg = rules[k]?.(values[k], values);
      if (msg) out[k] = msg;
    }
    return out;
  }, [values, rules]);

  const error = useCallback(
    (k: keyof T & string): string | undefined => {
      const visible = touched[k] || submitted;
      if (visible && clientErrors[k]) return clientErrors[k];
      // Erro do servidor só vale enquanto o valor não mudou.
      if (server.fields[k] && Object.is(server.snapshot[k], values[k])) return server.fields[k];
      return undefined;
    },
    [touched, submitted, clientErrors, server, values],
  );

  const bind = (k: keyof T & string) => ({
    name: k,
    onBlur: () => setTouched((t) => (t[k] ? t : { ...t, [k]: true })),
    "aria-invalid": !!error(k) || undefined,
  });

  /** Chame no submit. Retorna true se pode enviar. */
  const validate = () => {
    setSubmitted(true);
    const firstInvalid = Object.keys(clientErrors)[0];
    if (firstInvalid) {
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return false;
    }
    return true;
  };

  /** Mostra os erros por campo que o servidor devolveu. Retorna true se havia algum. */
  const applyServerError = (e: unknown) => {
    if (e instanceof ApiError && Object.keys(e.fields).length) {
      setServer({ fields: e.fields, snapshot: { ...values } });
      return true;
    }
    return false;
  };

  return { error, bind, validate, applyServerError, formRef, isValid: Object.keys(clientErrors).length === 0 };
}

/* ---------- Regras reutilizáveis ---------- */
export const required = (msg = "Campo obrigatório") => (v: unknown) =>
  v == null || (typeof v === "string" && !v.trim()) ? msg : null;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const MAX_CENTS = 99_999_999_99; // R$ 99 milhões

export function moneyRule(label = "o valor", opts: { allowZero?: boolean } = {}) {
  return (v: number) => {
    if (!opts.allowZero && (!v || v <= 0)) return `Informe ${label}`;
    if (v < 0) return "O valor não pode ser negativo";
    if (v > MAX_CENTS) return "Valor alto demais";
    return null;
  };
}

export function intRange(min: number, max: number, label: string) {
  return (v: string) => {
    if (!v) return `Informe ${label}`;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) return `Use um número entre ${min} e ${max}`;
    return null;
  };
}

export function validDate(v: string) {
  if (!v) return "Informe a data";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Data inválida";
  const y = d.getFullYear();
  if (y < 2000 || y > 2100) return "Data fora do intervalo permitido";
  return null;
}

export function passwordStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) score++;
  if (p.length >= 12 || /[^A-Za-z0-9]/.test(p)) score++;
  return { score: score as 0 | 1 | 2 | 3, label: ["Muito fraca", "Fraca", "Boa", "Forte"][score] };
}
