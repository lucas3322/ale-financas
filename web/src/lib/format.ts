import type { PaymentMethod } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number) => brl.format(cents / 100);
export const moneyShort = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl.format(v);
};

/** "1.234,56" | "1234.56" | "1234" → centavos */
export function parseMoney(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
export const centsToInput = (c: number) =>
  c ? (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function addMonths(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
export function monthLabel(m: string, opts: { short?: boolean; year?: boolean } = {}) {
  const [y, mo] = m.split("-").map(Number);
  const name = (opts.short ? MONTHS_SHORT : MONTHS)[mo - 1];
  const showYear = opts.year ?? true;
  return showYear ? `${name}${opts.short ? "/" : " de "}${opts.short ? String(y).slice(2) : y}` : name;
}
/** Para rótulos isolados (títulos, células): "Novembro de 2026". */
export function monthTitle(m: string, opts: { short?: boolean; year?: boolean } = {}) {
  const l = monthLabel(m, opts);
  return l.charAt(0).toUpperCase() + l.slice(1);
}
export const today = () => new Date().toISOString().slice(0, 10);
export function monthFirstDay(m: string) {
  return m === currentMonth() ? today() : `${m}-01`;
}

export const METHOD_LABEL: Record<PaymentMethod | "OTHER", string> = {
  PIX: "Pix", BOLETO: "Boleto", CARD: "Cartão", DEBIT: "Débito", CASH: "Dinheiro", TRANSFER: "Transferência", OTHER: "Outro",
};

export const firstName = (n: string) => n.split(" ")[0];

export const INVITE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** "abcd efgh" → "ABCD-EFGH" enquanto digita. */
export function formatInvite(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/**
 * Em qual fatura uma compra no cartão cai (mesma regra da API):
 * depois do fechamento vai para a fatura seguinte; a fatura "é" do mês em que vence.
 */
export function invoiceFor(date: string, card: { closingDay: number; dueDay: number }) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const shift = (d > card.closingDay ? 1 : 0) + (card.dueDay <= card.closingDay ? 1 : 0);
  const month = addMonths(`${y}-${String(m).padStart(2, "0")}`, shift);
  const [yy, mm] = month.split("-").map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const due = `${String(Math.min(card.dueDay, lastDay)).padStart(2, "0")}/${String(mm).padStart(2, "0")}`;
  return { month, due };
}
