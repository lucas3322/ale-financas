/**
 * Catálogo de ícones do Iconify usados no app. O script scripts/build-icons.mjs embute no build
 * todo nome "ph:..." / "simple-icons:..." encontrado no código — então basta listar aqui.
 */

export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: "Casa",
    icons: [
      "ph:house-line-duotone", "ph:house-simple-duotone", "ph:buildings-duotone", "ph:key-duotone", "ph:couch-duotone",
      "ph:lightbulb-duotone", "ph:lightning-duotone", "ph:drop-duotone", "ph:fire-duotone", "ph:wifi-high-duotone",
      "ph:wrench-duotone", "ph:toolbox-duotone", "ph:paint-roller-duotone", "ph:hammer-duotone", "ph:plant-duotone",
    ],
  },
  {
    label: "Comida e compras",
    icons: [
      "ph:shopping-cart-duotone", "ph:basket-duotone", "ph:shopping-bag-duotone", "ph:storefront-duotone", "ph:hamburger-duotone",
      "ph:pizza-duotone", "ph:fork-knife-duotone", "ph:coffee-duotone", "ph:wine-duotone", "ph:cake-duotone",
      "ph:t-shirt-duotone", "ph:sneaker-duotone", "ph:watch-duotone", "ph:gift-duotone", "ph:tag-duotone",
    ],
  },
  {
    label: "Transporte e viagem",
    icons: [
      "ph:car-profile-duotone", "ph:taxi-duotone", "ph:gas-pump-duotone", "ph:bus-duotone", "ph:train-duotone",
      "ph:motorcycle-duotone", "ph:bicycle-duotone", "ph:airplane-tilt-duotone", "ph:suitcase-duotone", "ph:island-duotone",
    ],
  },
  {
    label: "Saúde e cuidados",
    icons: [
      "ph:heartbeat-duotone", "ph:pill-duotone", "ph:first-aid-kit-duotone", "ph:hospital-duotone", "ph:syringe-duotone",
      "ph:tooth-duotone", "ph:eyeglasses-duotone", "ph:barbell-duotone", "ph:flower-lotus-duotone", "ph:scissors-duotone",
    ],
  },
  {
    label: "Família e pessoas",
    icons: [
      "ph:user-duotone", "ph:user-circle-duotone", "ph:users-duotone", "ph:users-three-duotone", "ph:handshake-duotone",
      "ph:baby-duotone", "ph:baby-carriage-duotone", "ph:graduation-cap-duotone", "ph:student-duotone", "ph:book-open-duotone",
      "ph:dog-duotone", "ph:cat-duotone", "ph:paw-print-duotone", "ph:hand-heart-duotone", "ph:church-duotone", "ph:heart-duotone",
    ],
  },
  {
    label: "Lazer",
    icons: [
      "ph:confetti-duotone", "ph:monitor-play-duotone", "ph:television-simple-duotone", "ph:film-slate-duotone", "ph:popcorn-duotone",
      "ph:game-controller-duotone", "ph:music-notes-duotone", "ph:headphones-duotone", "ph:ticket-duotone", "ph:soccer-ball-duotone",
      "ph:swimming-pool-duotone",
    ],
  },
  {
    label: "Dinheiro e trabalho",
    icons: [
      "ph:briefcase-duotone", "ph:laptop-duotone", "ph:money-duotone", "ph:wallet-duotone", "ph:coins-duotone",
      "ph:hand-coins-duotone", "ph:bank-duotone", "ph:credit-card-duotone", "ph:piggy-bank-duotone", "ph:chart-line-up-duotone",
      "ph:trend-up-duotone", "ph:receipt-duotone", "ph:calendar-star-duotone", "ph:arrow-u-up-left-duotone", "ph:sparkle-duotone",
      "ph:shield-check-duotone", "ph:device-mobile-duotone", "ph:globe-duotone", "ph:cloud-duotone", "ph:package-duotone",
    ],
  },
];

/** Logos reais (simple-icons) — monocromáticos, pintados na cor da marca. */
export const BRAND_ICONS: { icon: string; name: string; color: string }[] = [
  { icon: "simple-icons:netflix", name: "Netflix", color: "#E50914" },
  { icon: "simple-icons:primevideo", name: "Prime Video", color: "#00A8E1" },
  { icon: "simple-icons:hbomax", name: "HBO Max", color: "#5822B4" },
  { icon: "simple-icons:paramountplus", name: "Paramount+", color: "#0064FF" },
  { icon: "simple-icons:appletv", name: "Apple TV+", color: "#111111" },
  { icon: "simple-icons:crunchyroll", name: "Crunchyroll", color: "#F47521" },
  { icon: "simple-icons:funimation", name: "Funimation", color: "#5B0BB5" },
  { icon: "simple-icons:bilibili", name: "Bilibili", color: "#00A1D6" },
  { icon: "simple-icons:niconico", name: "Niconico", color: "#252525" },
  { icon: "simple-icons:myanimelist", name: "MyAnimeList", color: "#2E51A2" },
  { icon: "simple-icons:anilist", name: "AniList", color: "#02A9FF" },
  { icon: "simple-icons:webtoon", name: "Webtoon", color: "#00D564" },
  { icon: "simple-icons:mubi", name: "MUBI", color: "#111111" },
  { icon: "simple-icons:spotify", name: "Spotify", color: "#1DB954" },
  { icon: "simple-icons:youtube", name: "YouTube", color: "#FF0000" },
  { icon: "simple-icons:youtubemusic", name: "YouTube Music", color: "#FF0000" },
  { icon: "simple-icons:deezer", name: "Deezer", color: "#A238FF" },
  { icon: "simple-icons:applemusic", name: "Apple Music", color: "#FA243C" },
  { icon: "simple-icons:tidal", name: "Tidal", color: "#111111" },
  { icon: "simple-icons:playstation", name: "PlayStation", color: "#0070D1" },
  { icon: "simple-icons:xbox", name: "Xbox", color: "#107C10" },
  { icon: "simple-icons:nintendoswitch", name: "Nintendo Switch", color: "#E60012" },
  { icon: "simple-icons:steam", name: "Steam", color: "#171A21" },
  { icon: "simple-icons:twitch", name: "Twitch", color: "#9146FF" },
  { icon: "simple-icons:discord", name: "Discord", color: "#5865F2" },
  { icon: "simple-icons:icloud", name: "iCloud", color: "#3693F3" },
  { icon: "simple-icons:apple", name: "Apple", color: "#111111" },
  { icon: "simple-icons:microsoft", name: "Microsoft", color: "#5E5E5E" },
  { icon: "simple-icons:adobe", name: "Adobe", color: "#FF0000" },
  { icon: "simple-icons:canva", name: "Canva", color: "#00C4CC" },
  { icon: "simple-icons:openai", name: "ChatGPT", color: "#111111" },
  { icon: "simple-icons:duolingo", name: "Duolingo", color: "#58CC02" },
  { icon: "simple-icons:amazon", name: "Amazon", color: "#FF9900" },
  { icon: "simple-icons:ifood", name: "iFood", color: "#EA1D2C" },
  { icon: "simple-icons:uber", name: "Uber", color: "#111111" },
  { icon: "simple-icons:nubank", name: "Nubank", color: "#820AD1" },
];

/** Formas de pagamento. Pix usa o logo oficial. */
export const METHOD_ICONS = {
  PIX: "simple-icons:pix",
  BOLETO: "ph:barcode-duotone",
  CARD: "ph:credit-card-duotone",
  DEBIT: "ph:cardholder-duotone",
  CASH: "ph:money-duotone",
  TRANSFER: "ph:arrows-left-right-duotone",
  OTHER: "ph:dots-three-circle-duotone",
} as const;

/** Ícones dos dashboards (abas e modelos). */
export const DASH_ICONS = [
  "ph:chart-pie-slice-duotone", "ph:sparkle-duotone", "ph:credit-card-duotone", "ph:heart-duotone", "ph:house-line-duotone",
  "ph:shopping-cart-duotone", "ph:chart-line-up-duotone", "ph:target-duotone", "ph:piggy-bank-duotone", "ph:receipt-duotone",
  "ph:car-profile-duotone", "ph:graduation-cap-duotone", "ph:puzzle-piece-duotone",
];

export const isIconify = (v: string | null | undefined): v is string => !!v && /^[a-z0-9-]+:[a-z0-9-]+$/.test(v);
export const isBrand = (v: string | null | undefined) => !!v && v.startsWith("simple-icons:");
