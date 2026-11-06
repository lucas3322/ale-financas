import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useCategories } from "../lib/queries";
import type { Category, TxType } from "../lib/types";
import { cx, useToast } from "./ui";

const ICONS = ["🏷️", "🌐", "⚡", "💧", "🍔", "🚕", "🐶", "🎁", "✈️", "🏋️", "📺", "💻", "🧾", "🛠️", "👶", "📚"];
const COLORS = ["#820AD1", "#0EA5E9", "#F59E0B", "#10B981", "#EF4444", "#EC4899", "#6366F1", "#64748B"];

/**
 * Criar categoria sem sair do lançamento. Não é um <form> (está dentro do formulário do lançamento):
 * Enter cria a categoria sem enviar o lançamento.
 */
export function QuickCategory({ kind, onCreated, onCancel }: { kind: TxType; onCreated: (id: string) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const error = !trimmed
    ? "Dê um nome à categoria"
    : trimmed.length > 40
      ? "Máximo de 40 caracteres"
      : categories.some((c) => c.kind === kind && c.name.toLowerCase() === trimmed.toLowerCase())
        ? "Já existe uma categoria com esse nome"
        : null;

  const create = async () => {
    setTouched(true);
    if (error || saving) return;
    setSaving(true);
    try {
      const color = COLORS[categories.length % COLORS.length];
      const c = await api.post<Category>("/categories", { name: trimmed, kind, icon, color });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Categoria criada");
      onCreated(c.id);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-2xl border border-brand-200 bg-brand-50/60 p-3 motion-safe:animate-[fade_.18s_ease-out]">
      <p className="mb-2 text-xs font-semibold text-brand-900">Nova categoria de {kind === "INCOME" ? "entrada" : "saída"}</p>
      <div className="flex gap-2">
        <input
          className="field"
          autoFocus
          maxLength={40}
          placeholder="Ex.: Internet, Escola da Ceci"
          value={name}
          aria-invalid={touched && !!error}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
        />
        <button type="button" className="btn-primary shrink-0" disabled={saving} onClick={create}>
          {saving ? "Criando…" : "Criar"}
        </button>
      </div>
      {touched && error && <p role="alert" className="mt-1 text-[12px] font-semibold text-rose-600">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {ICONS.map((i) => (
          <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i} aria-label={`Ícone ${i}`}
            className={cx("grid h-8 w-8 place-items-center rounded-lg text-base transition-colors duration-150",
              icon === i ? "bg-white ring-2 ring-brand-500" : "hover:bg-white")}>
            {i}
          </button>
        ))}
      </div>
      <button type="button" className="mt-2 text-xs font-semibold text-ink-soft hover:text-ink" onClick={onCancel}>Cancelar</button>
    </div>
  );
}
