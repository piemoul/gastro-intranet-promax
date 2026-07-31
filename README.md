# GASTRO Intranet

Modern rebuild of `intra.gastro.co.id` (quotation & sales intranet for PT Gastro Gizi
Sarana) on **Next.js + Drizzle + Neon**, deploying to Vercel. Replaces a legacy Ruby on
Rails monolith with the same information architecture and flows, a modern Tailwind UI, and
a faithful port of the pricing/margin and row-level permission logic.

## Quick start
```bash
npm install
cp .env.local.example .env.local   # then fill Neon + session values
npm run db:check                   # verify connectivity
npm run db:migrate                 # create tables
npm run db:seed                    # branches, FX rates, dev admin, permission rules
npm run dev                        # http://localhost:3000
```
Dev login: `yogi.k@gastro.co.id` / your `LEGACY_PASSWORD` (or `SEED_ADMIN_PASSWORD`).

## Status
- [x] Fase 0 — Scaffold, Neon, migrations (14 tables)
- [x] Fase 1 — Schema, auth (jose + scrypt), permission engine (+tests)
- [x] Pricing/margin engine (+tests, matches legacy Analysis)
- [ ] Fase 2 — Master-data modules + CSV scraper
- [ ] Fase 3 — Quotation core UI (line items, revise/duplicate, analysis)
- [ ] Fase 4 — Quotation scraper + reconciliation
- [ ] Fase 5 — PDF, audit logs, reports
- [ ] Fase 6 — Vercel deploy

See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Legacy is READ-ONLY
Scrapers issue GET only, and prefer reusing a logged-in session cookie so nothing is ever
written to `intra.gastro.co.id`.
