# Graph Report - .  (2026-10-26)

## Corpus Check
- label mode - file stats not available

## Summary
- 578 nodes · 1537 edges · 27 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 402 · contains: 355 · calls: 212 · imports_from: 174 · MODIFIES: 160 · method: 71 · ON_BRANCH: 42 · references: 41 · re_exports: 26 · PARENT_OF: 22 · implements: 9 · contains_historical_no_write_statement: 1 · contains_historical_sq_not_published_statement: 1 · creates: 1 · deploys_verified_main_with_pinned_cli: 1 · disables_native_git_auto_deployment: 1 · documents: 1 · documents_exact_commit_rebuild: 1 · documents_scope_and_nonclaims: 1 · documents_validation: 1 · gates_production_after_verify: 1 · initializes_via: 1 · keeps_production_credentials_in_vercel_build: 1 · manages: 1 · requires: 1 · requires_atomic_append_only: 1 · requires_database_url_without_sqlite_fallback: 1 · runs_for_pr_push_main_and_manual: 1 · stores_business_state_in: 1 · stores_identity_state_in: 1 · stores_only_token_hash: 1 · uses_observation_not_business_required_proof: 1 · uses_only_explicit_isolated_test_schema: 1 · uses_temporary_postgresql_17_service: 1


## Graph Freshness
- Built from Git commit: `ba40072`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Actor` - 22 edges
2. `DraftStore` - 22 edges
3. `PgDraftStore` - 21 edges
4. `PgUserStore` - 20 edges
5. `UserStore` - 19 edges
6. `WorkflowError` - 18 edges
7. `Draft` - 16 edges
8. `AuthError` - 16 edges
9. `SQ milestone policy` - 11 edges
10. `estimateTransaction()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `wmsCatalog()` --implements--> `Independent read-only WMS API`  [EXTRACTED]
  src/server/integrations/reference-api.ts → docs/sq-milestone-one.md
- `publishOrder()` --implements--> `Durable Accurate SQ publication`  [EXTRACTED]
  src/server/publish-order.ts → docs/sq-milestone-one.md
- `assertPublish()` --implements--> `Explicit SQ Super Admin approval`  [EXTRACTED]
  src/server/workflow.ts → docs/sq-milestone-one.md
- `refreshPortalDirectory()` --implements--> `Gastro Portal sales directory`  [EXTRACTED]
  src/server/auth/portal.ts → docs/sq-milestone-one.md
- `resolveWmsItem()` --implements--> `Custom item mapping before approval`  [EXTRACTED]
  src/server/integrations/sq-catalogue.ts → docs/sq-milestone-one.md

## Communities

### Community 0 - "Google Login and Sessions"
Cohesion: 0.05
Nodes (40): appUrl(), exchangeGoogleCode(), googleAuthorizeUrl(), googleConfig(), googleConfigured(), JWKS, Identity, DirectoryGrant (+32 more)

### Community 1 - "Accurate Master Lookups"
Cohesion: 0.09
Nodes (47): customFields(), name(), normalizeCustomer(), normalizeCustomerDetail(), normalizeDocument(), normalizeDocumentDetail(), normalizeItem(), normalizeItemDetail() (+39 more)

### Community 2 - "Accurate Transport and Publication"
Cohesion: 0.08
Nodes (35): AccurateCreateError, createOrderTransport(), CREDENTIAL_KEYS, getConnectionStatus(), getOrderCreateTransport(), getReadTransport(), readEnvironment(), TOKEN_KEYS (+27 more)

### Community 3 - "API Reference Integrity"
Cohesion: 0.10
Nodes (26): inter, metadata, getActor(), requireActor(), codex/sq-milestone-one, main, 247e167 Apply one Accurate warehouse to all order lines, 262b20a Initial commit: GASTRO Intranet foundation (+18 more)

### Community 4 - "Draft Payload Validation"
Cohesion: 0.11
Nodes (30): DraftAction, accurateSourceSchema, amount, customerPayloadSchema, customFields, date, draftActionSchema, itemPayloadSchema (+22 more)

### Community 5 - "Deployment and Verification"
Cohesion: 0.07
Nodes (31): Independent Accurate environment for three companies, Authenticated three-company Accurate read verification, Master admin manages users, roles, and allowed companies, CI installs lockfile, lints, typechecks, tests, builds, GitHub Actions verification and production deployment, Verified-main-only deployment gate, Intranet draft, sequence, request, and business-audit tables, Responsive dialog focus and scroll handling (+23 more)

### Community 6 - "Portal Directory and Roles"
Cohesion: 0.14
Nodes (18): directoryGrants(), directorySchema, PORTAL_SUPER_ADMINS, ff26493 feat: implement Portal and WMS SQ entry with Super Admin approval, excludedCatalogueItems(), referenceGet(), wmsCatalog(), wmsCatalogSchema (+10 more)

### Community 7 - "Workspace Views and Navigation"
Cohesion: 0.12
Nodes (21): auditLabel(), DraftEditor(), NavItem, AccurateDetail(), ApprovalsView(), AuditView(), CustomerSummary, Dashboard() (+13 more)

### Community 8 - "PostgreSQL Draft Persistence"
Cohesion: 0.15
Nodes (5): canonical(), DraftRow, PgDraftStore, safePayload(), validated()

### Community 9 - "PostgreSQL User Persistence"
Cohesion: 0.17
Nodes (5): actorFromRow(), fromRow(), isUniqueViolation(), PgUserStore, Row

### Community 10 - "SQLite Draft Persistence"
Cohesion: 0.15
Nodes (5): canonical(), DraftStore, getStore(), safePayload(), validated()

### Community 11 - "Draft Commercial Editor"
Cohesion: 0.13
Nodes (12): EditorForm(), EditorProps, safeEstimate(), Catalog, emptySqDetails(), SalesEntryFields(), SqCatalogue(), Notice() (+4 more)

### Community 12 - "SQ Portal WMS Milestone"
Cohesion: 0.16
Nodes (18): refreshPortalDirectory(), assertSQEntryFields(), Intranet agent safety rules, WMS available stock, Gastro catalogue product references, Admin commercial SQ review, Docker API services, Explicit SQ Super Admin approval (+10 more)

### Community 13 - "Reusable UI and Users"
Cohesion: 0.16
Nodes (15): api(), Empty(), Loading(), Modal(), PageHeading(), Pagination(), PickerOption, post() (+7 more)

### Community 14 - "Authenticated Business API"
Cohesion: 0.13
Nodes (11): resolveWmsItem(), validateSQCatalogue(), Actor, draftKindSchema, reasonSchema, Context, documentKind, idSchema (+3 more)

### Community 15 - "Verified Deployment Automation"
Cohesion: 0.22
Nodes (14): createApi(), deploymentBody(), DeploymentError, deployVerified(), readConfiguration(), requireValue(), STATES, TARGET (+6 more)

### Community 16 - "Transaction Totals and Amounts"
Cohesion: 0.21
Nodes (10): EstimatedLine, estimateTransaction(), money(), rounded(), scaled(), TransactionEstimate, emptyTransaction(), TransactionLine (+2 more)

### Community 17 - "Workflow Regression Tests"
Cohesion: 0.19
Nodes (10): emptyCustomer(), emptyItem(), admin, approved(), entryPayload(), headImporter, headSales, importer (+2 more)

### Community 18 - "Workflow Authorization and Approval"
Cohesion: 0.45
Nodes (11): assertActor(), assertCreateKind(), assertDraftAccess(), assertEdit(), assertPublish(), assertTransition(), assertUnpublished(), canSeeDraft() (+3 more)

### Community 19 - "Publication Interface"
Cohesion: 0.27
Nodes (6): 05664c7 Align Intranet login and responsive navigation with Gastro workspace, 7da771f Require warehouse on every line before order approval and publication, b6b29ee Publish quotations to Accurate before selecting sales orders, PublicationPanel(), Draft, formatMoney()

### Community 20 - "Accurate Document Provenance"
Cohesion: 0.36
Nodes (7): AccurateSource, DraftKind, dateISO(), fingerprint(), fromAccurate(), validateAccurateReferences(), validateSourceUnchanged()

### Community 21 - "SQ Milestone Security Tests"
Cohesion: 0.25
Nodes (5): admin, details, employee, head, sales

### Community 22 - "Historical Accurate Research"
Cohesion: 0.33
Nodes (6): Company-specific currency, tax/DPP, item, and source semantics, Storage and deployment documentation, Historical read-only wording conflicts with current publication policy, Accurate field matrix: September 24 research snapshot, Accurate read-only research: September 24 snapshot, Historical bounded samples do not establish business requirements

### Community 23 - "WMS Read API"
Cohesion: 0.67
Nodes (2): server, sql

### Community 24 - "Draft Audit Durability"
Cohesion: 1.00
Nodes (2): Append-only transactional business audit, Local drafts with audit, optimistic version, and request keys

### Community 25 - "Private Graph Input Exclusions"
Cohesion: 1.00
Nodes (1): Graphify excludes private and generated input

### Community 26 - "Gastro Brand Logo"
Cohesion: 1.00
Nodes (1): Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band

## Ambiguous Edges - Review These
- `Storage and deployment documentation` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/deployment.md · relation: contains_historical_no_write_statement
- `Accurate field matrix: September 24 research snapshot` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/accurate-field-matrix.md · relation: contains_historical_sq_not_published_statement

## Knowledge Gaps
- **106 isolated node(s):** `privateTraceExcludes`, `config`, `STATES`, `TERMINAL_FAILURES`, `sql` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `WMS Read API`** (2 nodes): `server`, `sql`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Draft Audit Durability`** (2 nodes): `Append-only transactional business audit`, `Local drafts with audit, optimistic version, and request keys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Private Graph Input Exclusions`** (1 nodes): `Graphify excludes private and generated input`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gastro Brand Logo`** (1 nodes): `Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Storage and deployment documentation` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_no_write_statement) - confidence is low._
- **What is the exact relationship between `Accurate field matrix: September 24 research snapshot` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_sq_not_published_statement) - confidence is low._
- **Why does `PgDraftStore` connect `PostgreSQL Draft Persistence` to `Draft Payload Validation`, `Google Login and Sessions`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `DraftStore` connect `SQLite Draft Persistence` to `Draft Payload Validation`, `Accurate Transport and Publication`, `SQ Milestone Security Tests`, `Workflow Regression Tests`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `PgUserStore` connect `PostgreSQL User Persistence` to `Google Login and Sessions`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `privateTraceExcludes`, `config`, `STATES` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Google Login and Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._