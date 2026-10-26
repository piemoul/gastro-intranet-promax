# Graph Report - .  (2026-10-26)

## Corpus Check
- label mode - file stats not available

## Summary
- 711 nodes · 2024 edges · 34 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 567 · contains: 439 · imports_from: 264 · calls: 254 · MODIFIES: 198 · method: 86 · ON_BRANCH: 71 · references: 68 · PARENT_OF: 27 · re_exports: 26 · contains_historical_no_write_statement: 1 · contains_historical_sq_not_published_statement: 1 · creates: 1 · deploys_verified_main_with_pinned_cli: 1 · disables_native_git_auto_deployment: 1 · documents: 1 · documents_exact_commit_rebuild: 1 · documents_scope_and_nonclaims: 1 · documents_validation: 1 · gates_production_after_verify: 1 · implements: 1 · initializes_via: 1 · keeps_production_credentials_in_vercel_build: 1 · manages: 1 · requires: 1 · requires_atomic_append_only: 1 · requires_database_url_without_sqlite_fallback: 1 · runs_for_pr_push_main_and_manual: 1 · stores_business_state_in: 1 · stores_identity_state_in: 1 · stores_only_token_hash: 1 · uses_observation_not_business_required_proof: 1 · uses_only_explicit_isolated_test_schema: 1 · uses_temporary_postgresql_17_service: 1


## Graph Freshness
- Built from Git commit: `a196ab3`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Actor` - 32 edges
2. `DraftStore` - 23 edges
3. `WorkflowError` - 22 edges
4. `PgDraftStore` - 21 edges
5. `Draft` - 20 edges
6. `PgUserStore` - 20 edges
7. `UserStore` - 19 edges
8. `AuthError` - 16 edges
9. `estimateTransaction()` - 13 edges
10. `text()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Super Admin new customer publication` --references--> `publishCustomer()`  [EXTRACTED]
  docs/intra-functional-parity-plan.md → src/server/publish-customer.ts
- `Markup and actual margin` --references--> `pricingAnalysis()`  [EXTRACTED]
  docs/intra-functional-parity-plan.md → src/server/commercial-service.ts
- `Versioned company pricebook` --references--> `CommercialStore`  [EXTRACTED]
  docs/intra-functional-parity-plan.md → src/server/commercial-store.ts
- `Versioned company pricebook` --references--> `PgCommercialStore`  [EXTRACTED]
  docs/intra-functional-parity-plan.md → src/server/commercial-store.ts
- `Versioned quotation pricing snapshots` --references--> `applyPricebook()`  [EXTRACTED]
  docs/intra-functional-parity-plan.md → src/server/commercial-service.ts

## Communities

### Community 0 - "Accurate Create Transports"
Cohesion: 0.05
Nodes (57): AccurateCreateError, createOrderTransport(), createCustomerTransport(), fields, NewCustomerBody, CREDENTIAL_KEYS, getConnectionStatus(), getCustomerCreateTransport() (+49 more)

### Community 1 - "Draft Validation Rules"
Cohesion: 0.09
Nodes (51): linePricingSchema, quoteOptionsSchema, AccurateSource, AuditEntry, Draft, DraftAction, DraftKind, DraftPayload (+43 more)

### Community 2 - "Application Release History"
Cohesion: 0.08
Nodes (47): inter, metadata, codex/intra-commercial-parity, codex/sq-milestone-one, main, 05664c7 Align Intranet login and responsive navigation with Gastro workspace, 247e167 Apply one Accurate warehouse to all order lines, 250cd9d Select transaction items by Accurate brand and model (+39 more)

### Community 3 - "Accurate Response Normalization"
Cohesion: 0.11
Nodes (42): customFields(), name(), normalizeCustomer(), normalizeCustomerDetail(), normalizeDocument(), normalizeDocumentDetail(), normalizeItem(), normalizeItemDetail() (+34 more)

### Community 4 - "SQLite Draft Persistence"
Cohesion: 0.09
Nodes (14): emptyCustomer(), emptyItem(), canonical(), DraftStore, safePayload(), validated(), admin, approved() (+6 more)

### Community 5 - "Commercial Workflow Architecture"
Cohesion: 0.09
Nodes (33): Canonical Accurate and WMS SKU selection, Super Admin new customer publication, Customer reservation and reconciliation, Scoped SQ followup and reports, Isolated commercial workflow verification, Legacy Intra commercial implementation, Versioned company pricebook, Authenticated customer quotation print (+25 more)

### Community 6 - "Operations And Deployment Guides"
Cohesion: 0.07
Nodes (31): Independent Accurate environment for three companies, Authenticated three-company Accurate read verification, Master admin manages users, roles, and allowed companies, CI installs lockfile, lints, typechecks, tests, builds, GitHub Actions verification and production deployment, Verified-main-only deployment gate, Intranet draft, sequence, request, and business-audit tables, Responsive dialog focus and scroll handling (+23 more)

### Community 7 - "Authenticated Business API"
Cohesion: 0.13
Nodes (15): resolveWmsItem(), validateSQCatalogue(), Context, documentKind, idSchema, dateISO(), fingerprint(), fromAccurate() (+7 more)

### Community 8 - "Portal Directory Policy"
Cohesion: 0.14
Nodes (14): actorFromRow(), Identity, DirectoryGrant, directoryGrants(), directorySchema, PORTAL_SUPER_ADMINS, regularRoles, Row (+6 more)

### Community 9 - "PostgreSQL Draft Persistence"
Cohesion: 0.15
Nodes (5): canonical(), DraftRow, PgDraftStore, safePayload(), validated()

### Community 10 - "Draft Editing Interface"
Cohesion: 0.16
Nodes (12): CustomerPublicationPanel(), EditorForm(), EditorProps, safeEstimate(), PublicationPanel(), QuoteCommercialPanel(), Modal(), post() (+4 more)

### Community 11 - "PostgreSQL User Management"
Cohesion: 0.18
Nodes (4): fromRow(), isUniqueViolation(), PgUserStore, Row

### Community 12 - "Session And Reference Integration"
Cohesion: 0.19
Nodes (10): refreshPortalDirectory(), getActor(), requireActor(), getUsers(), ff26493 feat: implement Portal and WMS SQ entry with Super Admin approval, excludedCatalogueItems(), referenceGet(), wmsCatalog() (+2 more)

### Community 13 - "SQLite User Management"
Cohesion: 0.22
Nodes (4): AuthError, tokenHash(), userFromRow(), UserStore

### Community 14 - "Catalogue And SKU Selection"
Cohesion: 0.18
Nodes (12): BrandModelPicker(), Result, Catalog, emptySqDetails(), SalesEntryFields(), SqCatalogue(), api(), Loading() (+4 more)

### Community 15 - "Commercial Workspace Views"
Cohesion: 0.13
Nodes (13): CommercialSettingsView(), QuotationReportsView(), ReportRow, SupplierDirectoryView(), DraftEditor(), IntranetApp(), NavItem, ManageItemsView() (+5 more)

### Community 16 - "Commercial Pricing Rules"
Cohesion: 0.19
Nodes (17): boundedMoney(), convertPrice(), currency, day, defaultQuoteOptions(), DeliveryMode, followupSchema, generatedTiers() (+9 more)

### Community 17 - "Verified Deployment Pipeline"
Cohesion: 0.22
Nodes (14): createApi(), deploymentBody(), DeploymentError, deployVerified(), readConfiguration(), requireValue(), STATES, TARGET (+6 more)

### Community 18 - "PostgreSQL Migration Verification"
Cohesion: 0.15
Nodes (12): closeSql(), createSql(), ensureSchema(), getSql(), migrations, admin, entryPayload(), head (+4 more)

### Community 19 - "SQLite Commercial Parameters"
Cohesion: 0.21
Nodes (7): commercialData(), CommercialKind, access(), canReview(), CommercialStore, getCommercialStore(), nextRecord()

### Community 20 - "Google Authentication Flow"
Cohesion: 0.25
Nodes (8): appUrl(), exchangeGoogleCode(), googleAuthorizeUrl(), googleConfig(), googleConfigured(), JWKS, 460a101 Rebuild Intranet with Google whitelist, isolated Neon storage and read-only Accurate workflows, messages

### Community 21 - "Quotation Calculations And Print"
Cohesion: 0.21
Nodes (11): cd53083 Add canonical SKU parameters and guarded commercial workflows, PrintQuoteButton(), EstimatedLine, estimateTransaction(), money(), rounded(), scaled(), TransactionEstimate (+3 more)

### Community 22 - "Shared Workspace Controls"
Cohesion: 0.18
Nodes (11): Empty(), PageHeading(), PickerOption, SearchField(), Status(), regularRoles, UserRecord, UsersView() (+3 more)

### Community 23 - "Business Domain Models"
Cohesion: 0.19
Nodes (11): QuoteOptions, canAccessKind(), canReadAccurateKind(), CustomerPayload, emptyTransaction(), isSalesRole(), ItemPayload, Publication (+3 more)

### Community 24 - "PostgreSQL Commercial Parameters"
Cohesion: 0.31
Nodes (3): CommercialAudit, CommercialRecord, PgCommercialStore

### Community 25 - "Commercial API Verification"
Cohesion: 0.25
Nodes (5): defaultSettings(), emptyManagedItem(), admin, head, sales

### Community 26 - "Sales Milestone Verification"
Cohesion: 0.25
Nodes (5): admin, details, employee, head, sales

### Community 27 - "Pricebook Review And Analysis"
Cohesion: 0.40
Nodes (6): Markup and actual margin, applyPricebook(), assertReviewer(), commercialSettings(), pricingAnalysis(), validateCommercialQuote()

### Community 28 - "Historical Accurate Research"
Cohesion: 0.33
Nodes (6): Company-specific currency, tax/DPP, item, and source semantics, Storage and deployment documentation, Historical read-only wording conflicts with current publication policy, Accurate field matrix: September 24 research snapshot, Accurate read-only research: September 24 snapshot, Historical bounded samples do not establish business requirements

### Community 29 - "Authentication Verification"
Cohesion: 0.40
Nodes (3): administrator(), identity(), userInput

### Community 30 - "Read Only WMS API"
Cohesion: 0.67
Nodes (2): server, sql

### Community 31 - "Audited Local Drafts"
Cohesion: 1.00
Nodes (2): Append-only transactional business audit, Local drafts with audit, optimistic version, and request keys

### Community 32 - "Private Data Exclusion"
Cohesion: 1.00
Nodes (1): Graphify excludes private and generated input

### Community 33 - "Gastro Brand Identity"
Cohesion: 1.00
Nodes (1): Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band

## Ambiguous Edges - Review These
- `Storage and deployment documentation` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/deployment.md · relation: contains_historical_no_write_statement
- `Accurate field matrix: September 24 research snapshot` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/accurate-field-matrix.md · relation: contains_historical_sq_not_published_statement

## Knowledge Gaps
- **124 isolated node(s):** `privateTraceExcludes`, `config`, `STATES`, `TERMINAL_FAILURES`, `sql` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Read Only WMS API`** (2 nodes): `server`, `sql`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audited Local Drafts`** (2 nodes): `Append-only transactional business audit`, `Local drafts with audit, optimistic version, and request keys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Private Data Exclusion`** (1 nodes): `Graphify excludes private and generated input`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gastro Brand Identity`** (1 nodes): `Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Storage and deployment documentation` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_no_write_statement) - confidence is low._
- **What is the exact relationship between `Accurate field matrix: September 24 research snapshot` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_sq_not_published_statement) - confidence is low._
- **Why does `PgDraftStore` connect `PostgreSQL Draft Persistence` to `Draft Validation Rules`, `PostgreSQL Migration Verification`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `DraftStore` connect `SQLite Draft Persistence` to `Draft Validation Rules`, `Quotation Calculations And Print`, `Accurate Create Transports`, `Sales Milestone Verification`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Actor` connect `Draft Editing Interface` to `Portal Directory Policy`, `Commercial Workspace Views`, `Catalogue And SKU Selection`, `Application Release History`, `Authenticated Business API`, `Business Domain Models`, `Accurate Create Transports`, `Commercial Pricing Rules`, `SQLite Commercial Parameters`, `Draft Validation Rules`, `Authentication Verification`, `Commercial API Verification`, `PostgreSQL Migration Verification`, `Sales Milestone Verification`, `SQLite Draft Persistence`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `privateTraceExcludes`, `config`, `STATES` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Accurate Create Transports` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._