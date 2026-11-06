// Meses são tratados como índices inteiros (ano * 12 + mês0) para facilitar somas e comparações.

export function monthIdx(year: number, month1: number): number {
  return year * 12 + (month1 - 1);
}

export function parseMonth(s: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Mês inválido: ${s}`);
  return monthIdx(Number(m[1]), Number(m[2]));
}

export function formatMonth(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function dateMonthIdx(d: Date): number {
  return monthIdx(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function currentMonthIdx(): number {
  const now = new Date();
  return monthIdx(now.getFullYear(), now.getMonth() + 1);
}

/** Soma meses a uma data mantendo o dia (limitado ao último dia do mês). */
export function addMonthsToDate(d: Date, n: number): Date {
  const idx = dateMonthIdx(d) + n;
  const y = Math.floor(idx / 12);
  const m0 = idx % 12;
  const lastDay = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m0, Math.min(d.getUTCDate(), lastDay)));
}

/** Data de hoje no fuso do Brasil ("YYYY-MM-DD") — o servidor roda em UTC. */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Mês atual no fuso do Brasil (o servidor roda em UTC: dia 31 às 22h ainda é o mês corrente aqui). */
export function currentMonthIdxBR(): number {
  return parseMonth(todayBR().slice(0, 7));
}

/** "YYYY-MM-DD" de um dia dentro de um mês (limitado ao último dia: dia 31 em fevereiro vira 28/29). */
export function dateInMonth(idx: number, day: number): string {
  const y = Math.floor(idx / 12);
  const m0 = idx % 12;
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function toDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Data inválida: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
