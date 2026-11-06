-- 1) Entradas na categoria "Salário" são salário (algumas foram criadas sem a marcação).
UPDATE "Transaction" t SET "isSalary" = true
FROM "Category" c
WHERE t."categoryId" = c."id" AND t."type" = 'INCOME' AND t."isSalary" = false AND lower(c."name") IN ('salário', 'salario');

-- 2) Percentuais (ex.: dízimo) passam a incidir só sobre salários: empréstimo recebido e renda extra
--    não entram mais na conta. Quem quiser "todas as entradas" escolhe isso no lançamento.
UPDATE "Transaction" SET "percentBase" = 'PERSON_SALARY' WHERE "amountMode" = 'PERCENT' AND "percentBase" = 'PERSON_INCOME';
UPDATE "Transaction" SET "percentBase" = 'GROUP_SALARY'  WHERE "amountMode" = 'PERCENT' AND "percentBase" = 'GROUP_INCOME';

-- 3) Percentual avulso com a mesma data de exatamente UM salário da mesma pessoa
--    (ex.: Dízimo 05/11 ↔ Salário 05/11) vira "10% daquele salário", como na planilha.
UPDATE "Transaction" p SET "percentBase" = 'TRANSACTION', "percentBaseTxId" = s."id"
FROM "Transaction" s
WHERE p."amountMode" = 'PERCENT' AND p."recurrence" = 'ONCE' AND p."percentBaseTxId" IS NULL
  AND s."groupId" = p."groupId" AND s."type" = 'INCOME' AND s."isSalary" = true
  AND s."personId" IS NOT DISTINCT FROM p."personId" AND s."date" = p."date"
  AND (SELECT count(*) FROM "Transaction" s2
       WHERE s2."groupId" = p."groupId" AND s2."type" = 'INCOME' AND s2."isSalary" = true
         AND s2."personId" IS NOT DISTINCT FROM p."personId" AND s2."date" = p."date") = 1;
