# GASTRO Intranet — clone of intra.gastro.co.id

Quotation & sales intranet for **PT Gastro Gizi Sarana** (commercial kitchen equipment).
This is a from-scratch rebuild of a legacy **Ruby on Rails** monolith (`intra.gastro.co.id`)
onto a modern stack, matching the house conventions of the sibling `gastro-wms` project.

## Stack
- **Next.js 16** (App Router, Turbopack) · React 19 · **TypeScript**
- **Tailwind v4** + shadcn-style primitives (`src/components/ui`)
- **Drizzle ORM** + **Neon Postgres** (`@neondatabase/serverless`, WebSocket pool)
- Auth: **jose** JWT session cookie + scrypt password hashing (no external auth lib)
- Money: **decimal.js** (never float) · PDF: **@react-pdf/renderer**
- Deploy target: **Vercel**

## Commands
```bash
npm run dev            # dev server
npm test               # node:test unit tests (permissions, pricing)
npm run db:check       # verify .env + Neon connectivity
npm run db:generate    # generate a migration from schema.ts
npm run db:migrate     # apply migrations (uses DIRECT/unpooled connection)
npm run db:seed        # seed reference data (branches, FX settings, dev admin, rules)
npm run scrape:master  # import Items/Customers/Users via legacy CSV export (GET-only)
npm run scrape:quotations  # scrape quotations by id range (GET-only)
```

## Environment (`.env.local`)
- `DATABASE_URL` — Neon **pooled** (runtime).
- `DATABASE_URL_UNPOOLED` — Neon **direct** (migrations, seed, scraper).
- `SESSION_SECRET` — ≥32 chars.
- `LEGACY_BASE_URL`, `LEGACY_COOKIE` — for the read-only scraper (see below).

## Layout
- `src/app/(app)/…` — authenticated pages behind `AppShell` (redirects to `/login`).
- `src/app/login` — sign-in.
- `src/server/db/` — `schema.ts` (single source of truth), `client.ts` (server-only pool).
- `src/server/auth/` — `session.ts`, `guard.ts` (permission binding), `actions.ts`, `password.ts`.
- `src/lib/` — pure, unit-testable logic: `constants.ts`, `permissions.ts`, `pricing.ts`, `password.ts`.
- `scripts/` — tsx scripts (`_env.ts`, `_db.ts` do NOT import `server-only`).
- `tests/` — `node:test` specs.

## Two engines (the core IP — keep pure & tested)
- **Permissions** (`src/lib/permissions.ts` + `src/server/auth/guard.ts`): ports the
  `/roles` matrix. A rule = (department, level range `min..max`, `Model::action`,
  scope `SELF|BRANCH|ALL`, field pair). `scopeWhere()` returns a Drizzle `where` for
  row-level filtering. Level order: STAFF < MANAGER < SENIOR MANAGER < CHIEF.
- **Pricing** (`src/lib/pricing.ts`): `COGS = buyPrice × multiplier`, `GM% = (sell − COGS)/COGS`
  (markup-on-cost), multi-currency via a per-quotation FX snapshot. Verified against the
  legacy Analysis page (COGS 9,942,600 → GM 41.81%).

## Legacy system — STRICTLY READ-ONLY
The scraper may only issue **GET** requests to `intra.gastro.co.id`. Never POST/PATCH/DELETE.
Preferred auth is reusing a logged-in **session cookie** (`LEGACY_COOKIE`) so nothing is
written to the legacy DB — not even a login. `.json` endpoints are useless (id+timestamps
only); master data comes from `/{resource}/download_csv.csv`, quotations from HTML.

## Data model notes
- Every table carries `legacy_id` (unique) for idempotent, traceable migration.
- `numeric` for all money/qty/fx; `q_status`/`q_type`/currencies are `text` (flexible
  for scraped values); department/level/scope/perm are pg enums (we own them).
- Sales Orders module is intentionally **excluded** (dead in legacy: 1 DRAFT from 2021).
