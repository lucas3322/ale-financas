-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "icon" SET DEFAULT 'ph:tag-duotone';

-- CreateIndex
CREATE INDEX "Category_groupId_idx" ON "Category"("groupId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ícones: emoji → Iconify (categorias e dashboards). Emoji desconhecido fica como está (o app ainda exibe).
UPDATE "Category" c SET "icon" = m.icon
FROM (VALUES
  ('💼', 'ph:briefcase-duotone'),
  ('✨', 'ph:sparkle-duotone'),
  ('🏠', 'ph:house-line-duotone'),
  ('🛒', 'ph:shopping-cart-duotone'),
  ('🚗', 'ph:car-profile-duotone'),
  ('💊', 'ph:heartbeat-duotone'),
  ('🎓', 'ph:graduation-cap-duotone'),
  ('💡', 'ph:lightbulb-duotone'),
  ('🙏', 'ph:hand-heart-duotone'),
  ('🏦', 'ph:bank-duotone'),
  ('💳', 'ph:credit-card-duotone'),
  ('🧸', 'ph:baby-duotone'),
  ('🎉', 'ph:confetti-duotone'),
  ('🧾', 'ph:receipt-duotone'),
  ('🐷', 'ph:piggy-bank-duotone'),
  ('📦', 'ph:package-duotone'),
  ('🌐', 'ph:wifi-high-duotone'),
  ('⚡', 'ph:lightning-duotone'),
  ('💧', 'ph:drop-duotone'),
  ('🔥', 'ph:fire-duotone'),
  ('🔑', 'ph:key-duotone'),
  ('🏢', 'ph:buildings-duotone'),
  ('🏗️', 'ph:hand-coins-duotone'),
  ('🛋️', 'ph:couch-duotone'),
  ('🔧', 'ph:wrench-duotone'),
  ('📺', 'ph:monitor-play-duotone'),
  ('🍔', 'ph:hamburger-duotone'),
  ('🩹', 'ph:pill-duotone'),
  ('🩺', 'ph:first-aid-kit-duotone'),
  ('🏋️', 'ph:barbell-duotone'),
  ('⛽', 'ph:gas-pump-duotone'),
  ('🚕', 'ph:taxi-duotone'),
  ('🛡️', 'ph:shield-check-duotone'),
  ('🐶', 'ph:dog-duotone'),
  ('👕', 'ph:t-shirt-duotone'),
  ('💅', 'ph:flower-lotus-duotone'),
  ('🎁', 'ph:gift-duotone'),
  ('✈️', 'ph:airplane-tilt-duotone'),
  ('📈', 'ph:chart-line-up-duotone'),
  ('🏧', 'ph:coins-duotone'),
  ('💻', 'ph:laptop-duotone'),
  ('🎄', 'ph:calendar-star-duotone'),
  ('🏖️', 'ph:island-duotone'),
  ('↩️', 'ph:arrow-u-up-left-duotone'),
  ('🪙', 'ph:trend-up-duotone'),
  ('🏷️', 'ph:tag-duotone'),
  ('🛍️', 'ph:shopping-bag-duotone'),
  ('📱', 'ph:device-mobile-duotone'),
  ('🛠️', 'ph:toolbox-duotone'),
  ('👶', 'ph:baby-duotone'),
  ('📚', 'ph:book-open-duotone'),
  ('💰', 'ph:money-duotone'),
  ('📊', 'ph:chart-pie-slice-duotone'),
  ('💜', 'ph:heart-duotone'),
  ('🎯', 'ph:target-duotone'),
  ('🧩', 'ph:puzzle-piece-duotone')
) AS m(emoji, icon)
WHERE c."icon" = m.emoji;

UPDATE "Dashboard" d SET "icon" = m.icon
FROM (VALUES
  ('💼', 'ph:briefcase-duotone'),
  ('✨', 'ph:sparkle-duotone'),
  ('🏠', 'ph:house-line-duotone'),
  ('🛒', 'ph:shopping-cart-duotone'),
  ('🚗', 'ph:car-profile-duotone'),
  ('💊', 'ph:heartbeat-duotone'),
  ('🎓', 'ph:graduation-cap-duotone'),
  ('💡', 'ph:lightbulb-duotone'),
  ('🙏', 'ph:hand-heart-duotone'),
  ('🏦', 'ph:bank-duotone'),
  ('💳', 'ph:credit-card-duotone'),
  ('🧸', 'ph:baby-duotone'),
  ('🎉', 'ph:confetti-duotone'),
  ('🧾', 'ph:receipt-duotone'),
  ('🐷', 'ph:piggy-bank-duotone'),
  ('📦', 'ph:package-duotone'),
  ('🌐', 'ph:wifi-high-duotone'),
  ('⚡', 'ph:lightning-duotone'),
  ('💧', 'ph:drop-duotone'),
  ('🔥', 'ph:fire-duotone'),
  ('🔑', 'ph:key-duotone'),
  ('🏢', 'ph:buildings-duotone'),
  ('🏗️', 'ph:hand-coins-duotone'),
  ('🛋️', 'ph:couch-duotone'),
  ('🔧', 'ph:wrench-duotone'),
  ('📺', 'ph:monitor-play-duotone'),
  ('🍔', 'ph:hamburger-duotone'),
  ('🩹', 'ph:pill-duotone'),
  ('🩺', 'ph:first-aid-kit-duotone'),
  ('🏋️', 'ph:barbell-duotone'),
  ('⛽', 'ph:gas-pump-duotone'),
  ('🚕', 'ph:taxi-duotone'),
  ('🛡️', 'ph:shield-check-duotone'),
  ('🐶', 'ph:dog-duotone'),
  ('👕', 'ph:t-shirt-duotone'),
  ('💅', 'ph:flower-lotus-duotone'),
  ('🎁', 'ph:gift-duotone'),
  ('✈️', 'ph:airplane-tilt-duotone'),
  ('📈', 'ph:chart-line-up-duotone'),
  ('🏧', 'ph:coins-duotone'),
  ('💻', 'ph:laptop-duotone'),
  ('🎄', 'ph:calendar-star-duotone'),
  ('🏖️', 'ph:island-duotone'),
  ('↩️', 'ph:arrow-u-up-left-duotone'),
  ('🪙', 'ph:trend-up-duotone'),
  ('🏷️', 'ph:tag-duotone'),
  ('🛍️', 'ph:shopping-bag-duotone'),
  ('📱', 'ph:device-mobile-duotone'),
  ('🛠️', 'ph:toolbox-duotone'),
  ('👶', 'ph:baby-duotone'),
  ('📚', 'ph:book-open-duotone'),
  ('💰', 'ph:money-duotone'),
  ('📊', 'ph:chart-pie-slice-duotone'),
  ('💜', 'ph:heart-duotone'),
  ('🎯', 'ph:target-duotone'),
  ('🧩', 'ph:puzzle-piece-duotone')
) AS m(emoji, icon)
WHERE d."icon" = m.emoji;

-- Subcategorias de streaming em todo grupo que tem a categoria "Assinaturas e streaming" (sem duplicar).
INSERT INTO "Category" ("id", "groupId", "parentId", "name", "kind", "color", "icon", "createdAt")
SELECT gen_random_uuid()::text, p."groupId", p."id", v.name, 'EXPENSE'::"TxType", v.color, v.icon, now()
FROM "Category" p
CROSS JOIN (VALUES
  ('Netflix', '#E50914', 'simple-icons:netflix'),
  ('Prime Video', '#00A8E1', 'simple-icons:primevideo'),
  ('HBO Max', '#5822B4', 'simple-icons:hbomax'),
  ('Disney+', '#113CCF', 'ph:film-slate-duotone'),
  ('Globoplay', '#FB0234', 'ph:television-simple-duotone'),
  ('Paramount+', '#0064FF', 'simple-icons:paramountplus'),
  ('Apple TV+', '#111111', 'simple-icons:appletv'),
  ('Crunchyroll', '#F47521', 'simple-icons:crunchyroll'),
  ('Funimation', '#5B0BB5', 'simple-icons:funimation'),
  ('Bilibili', '#00A1D6', 'simple-icons:bilibili'),
  ('Spotify', '#1DB954', 'simple-icons:spotify'),
  ('YouTube Premium', '#FF0000', 'simple-icons:youtube'),
  ('Deezer', '#A238FF', 'simple-icons:deezer'),
  ('PlayStation Plus', '#0070D1', 'simple-icons:playstation'),
  ('Xbox Game Pass', '#107C10', 'simple-icons:xbox'),
  ('Nintendo Switch Online', '#E60012', 'simple-icons:nintendoswitch'),
  ('Outros', '#64748B', 'ph:monitor-play-duotone')
) AS v(name, color, icon)
WHERE p."name" = 'Assinaturas e streaming' AND p."parentId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."parentId" = p."id" AND lower(c."name") = lower(v.name));

-- Empréstimos › Pessoas: dívidas com amigos/família (ícone de pessoa).
INSERT INTO "Category" ("id", "groupId", "parentId", "name", "kind", "color", "icon", "createdAt")
SELECT gen_random_uuid()::text, p."groupId", p."id", 'Pessoas', 'EXPENSE'::"TxType", '#DC2626', 'ph:user-duotone', now()
FROM "Category" p
WHERE p."name" = 'Empréstimos' AND p."parentId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."parentId" = p."id" AND lower(c."name") = 'pessoas');
