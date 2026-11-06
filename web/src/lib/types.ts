export type TxType = "INCOME" | "EXPENSE";
export type PaymentMethod = "PIX" | "BOLETO" | "CARD" | "DEBIT" | "CASH" | "TRANSFER";
export type Recurrence = "ONCE" | "MONTHLY" | "INSTALLMENTS";
export type AmountMode = "FIXED" | "PERCENT";
export type PercentBase = "PERSON_INCOME" | "GROUP_INCOME";

export interface Me {
  user: { id: string; name: string; email: string };
  activeGroup: { id: string; name: string; role: "OWNER" | "MEMBER"; initialBalanceCents: number } | null;
  groups: { id: string; name: string; role: string }[];
  members: { id: string; name: string; email: string; role: "OWNER" | "MEMBER" }[];
}

export interface Category { id: string; name: string; kind: TxType; color: string; icon: string }

export interface Card {
  id: string; name: string; limitCents: number; closingDay: number; dueDay: number;
  color: string; ownerId: string | null; archived: boolean; owner?: { id: string; name: string } | null;
}

export interface Transaction {
  id: string; type: TxType; description: string; categoryId: string | null; personId: string | null;
  amountMode: AmountMode; amountCents: number; percentBp: number | null; percentBase: PercentBase | null;
  paymentMethod: PaymentMethod | null; cardId: string | null; date: string; recurrence: Recurrence;
  totalMonths: number | null; installmentStart: number; isSalary: boolean; notes: string | null;
  category?: Category | null; card?: { id: string; name: string; color: string } | null;
  person?: { id: string; name: string } | null;
}

export interface Occ {
  transactionId: string; month: string; day: number; dueDate: string; installmentLabel: string | null;
  amountCents: number; overridden: boolean; paid: boolean; skipped: boolean;
  type: TxType; description: string; isSalary: boolean; recurrence: Recurrence; totalMonths: number | null;
  amountMode: AmountMode; percentBp: number | null; percentBase: PercentBase | null;
  paymentMethod: PaymentMethod | null; date: string;
  category: { id: string; name: string; color: string; icon: string } | null;
  person: { id: string; name: string } | null;
  card: { id: string; name: string; color: string } | null;
}

export interface Totals {
  incomeCents: number; expenseCents: number; netCents: number;
  receivedCents: number; paidCents: number; pendingCents: number;
  /** "Hoje" no fuso do Brasil, usado no cálculo do realizado */
  today: string;
  /** Até hoje: só o que já aconteceu (data chegou ou foi marcado como pago/recebido) */
  realizedIncomeCents: number; realizedExpenseCents: number; realizedNetCents: number;
  /** Com data futura e ainda não pago/recebido */
  scheduledExpenseCents: number; scheduledIncomeCents: number;
  /** Saídas com data vencida e não marcadas como pagas */
  overdueCents: number;
}

export interface CardSummary {
  id: string; name: string; color: string; closingDay: number; dueDay: number; ownerId: string | null;
  limitCents: number; committedCents: number; availableCents: number; invoiceCents: number; items?: Occ[];
  nextInvoices: { month: string; cents: number; count: number }[];
}

export interface ForecastRow {
  month: string; incomeCents: number; expenseCents: number; plannedCents: number; netCents: number;
  accumulatedCents: number; cardCents: number; recurringCents: number;
}

export interface Dashboard {
  month: string; totals: Totals;
  byCategory: { id: string | null; name: string; color: string; icon: string; totalCents: number }[];
  byMethod: { method: string; totalCents: number }[];
  byPerson: { id: string; name: string; incomeCents: number; expenseCents: number; netCents: number }[];
  cards: CardSummary[]; upcoming: Occ[]; incomes: Occ[]; forecast: ForecastRow[];
}

export interface ShoppingItem {
  id: string; name: string; estimatedCents: number; paymentMethod: PaymentMethod; cardId: string | null;
  installments: number; plannedMonth: string | null; priority: number; status: "PLANNED" | "BOUGHT";
  notes: string | null; link: string | null; card?: { id: string; name: string; color: string } | null;
}
