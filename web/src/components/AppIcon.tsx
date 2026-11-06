import { addCollection, Icon } from "@iconify/react";
import type { IconifyJSON } from "@iconify/types";
import bundle from "../lib/icons/bundle.json";
import { isIconify, METHOD_ICONS } from "../lib/icons/catalog";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Ícones embutidos no build: aparecem na hora e não dependem da API do Iconify.
for (const set of bundle as unknown as IconifyJSON[]) addCollection(set);

/** Renderiza um ícone do Iconify ("ph:house-line-duotone") ou, para dados antigos, um emoji. */
export function AppIcon({ icon, size = 18, className, color }: { icon: string | null | undefined; size?: number; className?: string; color?: string }) {
  if (isIconify(icon)) return <Icon icon={icon} width={size} height={size} className={cx("shrink-0", className)} style={color ? { color } : undefined} aria-hidden />;
  return <span className={cx("inline-block shrink-0 text-center leading-none", className)} style={{ fontSize: size * 0.9, width: size }} aria-hidden>{icon || "•"}</span>;
}

/** Ícone de categoria num quadradinho com a cor da categoria (fundo suave + ícone na cor). */
export function CategoryIcon({ category, size = "md", fallback = "ph:package-duotone" }: {
  category: { icon: string; color: string } | null | undefined; size?: "sm" | "md" | "lg"; fallback?: string;
}) {
  const color = category?.color ?? "#94A3B8";
  const box = { sm: "h-7 w-7 rounded-lg", md: "h-9 w-9 rounded-xl", lg: "h-12 w-12 rounded-2xl" }[size];
  const px = { sm: 15, md: 19, lg: 26 }[size];
  return (
    <span className={cx("grid shrink-0 place-items-center", box)} style={{ background: `${color}1F`, color }}>
      <AppIcon icon={category?.icon ?? fallback} size={px} />
    </span>
  );
}

export function MethodIcon({ method, size = 14, className }: { method: keyof typeof METHOD_ICONS | null | undefined; size?: number; className?: string }) {
  if (!method) return null;
  return <AppIcon icon={METHOD_ICONS[method]} size={size} className={cx(method === "PIX" && "text-[#32BCAD]", className)} />;
}

const METHOD_NAMES = { PIX: "Pix", BOLETO: "Boleto", CARD: "Cartão", DEBIT: "Débito", CASH: "Dinheiro", TRANSFER: "Transferência", OTHER: "Outro" } as const;

/** "Pix", "Boleto" ou o cartão usado — com ícone, para as linhas de lançamento. */
export function PaymentTag({ card, method }: { card?: { name: string; color: string } | null; method?: keyof typeof METHOD_ICONS | null }) {
  if (card) {
    return (
      <span className="inline-flex items-center gap-1 align-middle">
        <AppIcon icon="ph:credit-card-duotone" size={13} color={card.color} /> {card.name}
      </span>
    );
  }
  if (!method) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <MethodIcon method={method} size={13} /> {METHOD_NAMES[method]}
    </span>
  );
}
