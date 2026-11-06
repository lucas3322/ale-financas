# Nosso Caixa

Finanças do casal/família sem planilha: salários, entradas e saídas, gastos recorrentes e parcelados,
percentual da renda (ex.: dízimo de 10%), cartões com limite comprometido, lista de compras e previsão
dos próximos meses com saldo acumulado. Várias pessoas compartilham o mesmo grupo por código de convite.

## Stack

| Camada   | Tecnologia |
|----------|------------|
| API      | Node 22 · Fastify 5 · Prisma 6 · PostgreSQL · Zod |
| Front    | React 18 · Vite · Tailwind · TanStack Query · Recharts |
| Auth     | Access token JWT (15 min) + refresh token opaco (30 dias) em cookies httpOnly, com rotação e detecção de reuso |
| Deploy   | Um único container (a API serve o front) · Railway + Postgres |

## Rodando localmente

```bash
docker run -d --name nosso-caixa-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nossocaixa -p 5499:5432 postgres:16-alpine
```

```bash
cd server && cp .env.example .env && npm install && npx prisma migrate deploy && npm run dev
```

```bash
cd web && npm install && npm run dev
```

Abra http://localhost:5173 (o Vite faz proxy de `/api` para a porta 3077).

Ou, tudo em container, igual à produção:

```bash
docker compose up --build
```

→ http://localhost:3000

Testes do motor de cálculo (recorrência, parcelas, fatura, percentual):

```bash
cd server && npm test
```

## Deploy no Railway

1. Suba este repositório no GitHub.
2. No Railway: **New Project → Deploy from GitHub repo** (o `railway.json` já aponta para o `Dockerfile`).
3. **+ New → Database → PostgreSQL** no mesmo projeto.
4. No serviço do app, em **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao banco)
   - `JWT_SECRET` = um segredo longo (`openssl rand -base64 48`)
5. **Settings → Networking → Generate Domain**.

A cada deploy o container roda `prisma migrate deploy` antes de subir. Healthcheck em `/api/health`.

## Como as regras de negócio funcionam

- **Lançamento** (`Transaction`) é uma definição: única, mensal (com ou sem limite de meses) ou parcelada
  (pode começar numa parcela já em andamento, ex.: 3/6). As ocorrências de cada mês são calculadas na hora
  (`server/src/lib/engine.ts`); só o estado de cada mês (pago, valor ajustado, pulado) fica em `TxOccurrence`.
- **Percentual**: o valor é `x%` das entradas do mês da pessoa (ou do grupo). Se o salário mudar, acompanha.
- **Cartão**: a compra cai na fatura do mês de vencimento (respeitando o dia de fechamento). O limite fica
  comprometido desde o mês da compra; no parcelado, o valor total das parcelas restantes ocupa o limite.
- **Editar “a partir deste mês”** (ex.: aumento de salário): a série antiga termina no mês anterior e uma nova começa.
- **Previsão**: soma entradas − saídas de cada mês e acumula a partir do saldo inicial do grupo; pode incluir a
  lista de compras planejada.
