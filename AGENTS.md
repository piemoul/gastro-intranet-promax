# Intranet

Accurate reads use the allowlisted GET transport. The user authorizes one final creation of a new SO or PO from an internally approved draft, explicitly confirmed by the appropriate head or master admin. Only the dedicated publication service may invoke sales-order/save.do or purchase-order/save.do, without IDs or retries. Persist the reservation before sending; uncertain outcomes remain locked until read-only reconciliation. Never mutate existing Accurate documents or master data. Tests must mock writes; never create trial documents in live Accurate.

Use the sibling gastro-wms project for visual/integration reference without editing it. Never expose credential values. The user authorizes sharing its Neon database, but Intranet writes must use only separate intranet_ tables and must never modify WMS tables. Do not copy its shared-role authentication into this app.

Next.js 16 APIs: read relevant bundled node_modules/next/dist/docs before coding. Require authenticated users and server-side company/role/ownership enforcement on all data endpoints. All local draft mutations must be audited and version checked.

Downloads requested by the user go in ~/Downloads unless another path is specified. GitHub pulls go under /Users/user/Documents/coding disini unless another location is specified.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
