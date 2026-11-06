-- Novas categorias padrão para os grupos que já existem.
-- Não duplica: só insere se o grupo ainda não tem uma categoria com o mesmo nome (sem diferenciar maiúsculas).
INSERT INTO "Category" ("id", "groupId", "name", "kind", "color", "icon", "createdAt")
SELECT gen_random_uuid()::text, g."id", v.name, v.kind::"TxType", v.color, v.icon, now()
FROM "Group" g
CROSS JOIN (VALUES
  ('Internet e telefone', 'EXPENSE', '#0EA5E9', '🌐'),
  ('Energia', 'EXPENSE', '#EAB308', '⚡'),
  ('Água', 'EXPENSE', '#38BDF8', '💧'),
  ('Gás', 'EXPENSE', '#F97316', '🔥'),
  ('Aluguel', 'EXPENSE', '#9333EA', '🔑'),
  ('Condomínio', 'EXPENSE', '#7C3AED', '🏢'),
  ('Financiamento', 'EXPENSE', '#B91C1C', '🏗️'),
  ('Casa e móveis', 'EXPENSE', '#8B5CF6', '🛋️'),
  ('Manutenção da casa', 'EXPENSE', '#78716C', '🔧'),
  ('Assinaturas e streaming', 'EXPENSE', '#E11D48', '📺'),
  ('Restaurante e delivery', 'EXPENSE', '#F59E0B', '🍔'),
  ('Farmácia', 'EXPENSE', '#EF4444', '🩹'),
  ('Plano de saúde', 'EXPENSE', '#DC2626', '🩺'),
  ('Academia', 'EXPENSE', '#10B981', '🏋️'),
  ('Combustível', 'EXPENSE', '#EA580C', '⛽'),
  ('Uber e apps', 'EXPENSE', '#334155', '🚕'),
  ('Seguros', 'EXPENSE', '#475569', '🛡️'),
  ('Pets', 'EXPENSE', '#A16207', '🐶'),
  ('Roupas', 'EXPENSE', '#DB2777', '👕'),
  ('Beleza e cuidados', 'EXPENSE', '#F472B6', '💅'),
  ('Presentes', 'EXPENSE', '#C026D3', '🎁'),
  ('Viagem', 'EXPENSE', '#0284C7', '✈️'),
  ('Investimentos', 'EXPENSE', '#16A34A', '📈'),
  ('Tarifas bancárias', 'EXPENSE', '#64748B', '🏧'),
  ('Freelance', 'INCOME', '#0891B2', '💻'),
  ('13º salário', 'INCOME', '#15803D', '🎄'),
  ('Férias', 'INCOME', '#22C55E', '🏖️'),
  ('Reembolso', 'INCOME', '#14B8A6', '↩️'),
  ('Rendimentos', 'INCOME', '#059669', '🪙'),
  ('Vendas', 'INCOME', '#D97706', '🏷️'),
  ('Aluguel recebido', 'INCOME', '#7E22CE', '🏠')
) AS v(name, kind, color, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c WHERE c."groupId" = g."id" AND lower(c."name") = lower(v.name)
);
