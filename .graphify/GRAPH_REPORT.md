# Graph Report - .  (2026-10-19)

## Corpus Check
- label mode - file stats not available

## Summary
- 555 nodes · 1512 edges · 23 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output
- Edge kinds: imports: 350 · contains: 320 · MODIFIES: 246 · calls: 202 · imports_from: 140 · method: 69 · ON_BRANCH: 31 · PARENT_OF: 29 · re_exports: 26 · references: 24 · documents: 3 · implements: 3 · permits_new_create_only: 3 · approves_and_publishes_with_confirmation: 2 · assigns_permissions: 1 · assigns_roles: 1 · authenticates_with: 1 · checks_version_and_freezes_payload: 1 · constrains: 1 · contains_historical_no_write_statement: 1 · contains_historical_sq_not_published_statement: 1 · creates: 1 · creates_and_publishes_owned_complete: 1 · deploys_verified_main_with_pinned_cli: 1 · describes_current_guarded_publication: 1 · disables_native_git_auto_deployment: 1 · documents_exact_commit_rebuild: 1 · documents_scope_and_nonclaims: 1 · documents_validation: 1 · drafts_owned: 1 · enforces: 1 · enforces_ownership: 1 · excluded_from_payload: 1 · explicit_selected_source_for: 1 · gates_production_after_verify: 1 · informs_unsupported_field_boundaries: 1 · initializes_via: 1 · keeps_production_credentials_in_vercel_build: 1 · keeps_proposals_local: 1 · locks_during_or_after_send: 1 · manages: 1 · may_read_needed_accurate_environment_variables_locally: 1 · mocks_writes: 1 · must_not_import_wms_stores_or_migrations: 1 · must_preserve: 1 · persists_in_same_transaction: 1 · preserves_server_side_source_and_uniqueness: 1 · provides_current_operational_create_boundaries: 1 · provides_newer_create_authorization: 1 · reads_server_side_configuration: 1 · requires: 1 · requires_atomic_append_only: 1 · requires_before_post_and_on_readback: 1 · requires_before_send: 1 · requires_bundled_api_guides: 1 · requires_database_url_without_sqlite_fallback: 1 · requires_for_uncertain_outcome: 1 · requires_on_all_data_endpoints: 1 · requires_separate_master_identities: 1 · rereads_role_and_company_then_revokes_on_change: 1 · restricts_active_company: 1 · runs_for_pr_push_main_and_manual: 1 · runs_locally_as: 1 · searches_items_partners_and_transactions: 1 · selects_accurate_source: 1 · shares_database_without_mutating_wms_objects: 1 · stores_business_state_in: 1 · stores_identity_state_in: 1 · stores_locally_only: 1 · stores_only_token_hash: 1 · uses_locally_without_database_url: 1 · uses_observation_not_business_required_proof: 1 · uses_only_explicit_isolated_test_schema: 1 · uses_read_only_checks: 1 · uses_temporary_postgresql_17_service: 1 · uses_visual_integration_reference_without_editing: 1 · uses_with_database_url: 1 · verifies_workflows_without_live_writes: 1


## Graph Freshness
- Built from Git commit: `05664c7`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `PgDraftStore` - 21 edges
2. `DraftStore` - 21 edges
3. `Actor` - 19 edges
4. `PgUserStore` - 19 edges
5. `UserStore` - 17 edges
6. `Draft` - 16 edges
7. `AuthError` - 16 edges
8. `WorkflowError` - 16 edges
9. `Gastro Intranet: three-company commercial workspace` - 12 edges
10. `estimateTransaction()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Accurate publication workflow and recovery` --documents--> `Dedicated create-only SQ/PO/SO publication service`  [EXTRACTED]
  docs/accurate-publication.md → AGENTS.md
- `Dedicated create-only SQ/PO/SO publication service` --locks_during_or_after_send--> `PUBLISHING / UNCERTAIN / PUBLISHED publication locks`  [EXTRACTED]
  AGENTS.md → docs/accurate-publication.md
- `Dedicated create-only SQ/PO/SO publication service` --requires_before_post_and_on_readback--> `Publication validates warehouses, tax, supported fields, and readback`  [EXTRACTED]
  AGENTS.md → docs/accurate-publication.md
- `Verified-main-only deployment gate` --references--> `Promax repository with original Git history`  [EXTRACTED]
  .github/workflows/ci.yml → README.md
- `Gastro Intranet: three-company commercial workspace` --keeps_proposals_local--> `Existing Accurate documents and master data remain read-only`  [EXTRACTED]
  README.md → AGENTS.md

## Communities

### Community 0 - "Identity Stores and Sessions"
Cohesion: 0.05
Nodes (28): actorFromRow(), fromRow(), Identity, isUniqueViolation(), PgUserStore, Row, AuthError, regularRoles (+20 more)

### Community 1 - "Workflow Validation Rules"
Cohesion: 0.07
Nodes (53): DraftAction, accurateSourceSchema, amount, customerPayloadSchema, customFields, date, draftActionSchema, draftKindSchema (+45 more)

### Community 2 - "Accurate Data Normalization"
Cohesion: 0.09
Nodes (48): customFields(), name(), normalizeCustomer(), normalizeCustomerDetail(), normalizeDocument(), normalizeDocumentDetail(), normalizeItem(), normalizeItemDetail() (+40 more)

### Community 3 - "Application and Google Login"
Cohesion: 0.08
Nodes (35): inter, metadata, appUrl(), exchangeGoogleCode(), googleAuthorizeUrl(), googleConfig(), googleConfigured(), JWKS (+27 more)

### Community 4 - "Accurate Transport and Payloads"
Cohesion: 0.09
Nodes (37): AccurateCreateError, createOrderTransport(), CREDENTIAL_KEYS, getConnectionStatus(), getOrderCreateTransport(), getReadTransport(), readEnvironment(), TOKEN_KEYS (+29 more)

### Community 5 - "Verified Deployment Utilities"
Cohesion: 0.16
Nodes (19): 53730e6 Deploy verified commits through project-scoped Vercel API CLI, d824a6a Format Accurate dates in Indonesian order and Jakarta timezone, 53730e6 Deploy verified commits through project-scoped Vercel API CLI, d824a6a Format Accurate dates in Indonesian order and Jakarta timezone, formatDocumentDate(), createApi(), deploymentBody(), DeploymentError (+11 more)

### Community 6 - "PostgreSQL Draft Store"
Cohesion: 0.15
Nodes (5): canonical(), DraftRow, PgDraftStore, safePayload(), validated()

### Community 7 - "Workspace Data Views"
Cohesion: 0.13
Nodes (19): auditLabel(), DraftEditor(), NavItem, AccurateDetail(), ApprovalsView(), AuditView(), CustomerSummary, Dashboard() (+11 more)

### Community 8 - "Shared Interface Components"
Cohesion: 0.14
Nodes (19): api(), Empty(), Loading(), Modal(), Notice(), PageHeading(), Pagination(), Picker() (+11 more)

### Community 9 - "SQLite Draft Store"
Cohesion: 0.15
Nodes (5): canonical(), DraftStore, getStore(), safePayload(), validated()

### Community 10 - "Company and Role Domain"
Cohesion: 0.16
Nodes (17): AccurateSource, Actor, AuditEntry, canAccessKind(), canReadAccurateKind(), CustomerPayload, DraftKind, DraftPayload (+9 more)

### Community 11 - "Workflow and API Tests"
Cohesion: 0.16
Nodes (13): 7da771f Require warehouse on every line before order approval and publication, b6b29ee Publish quotations to Accurate before selecting sales orders, Draft, emptyCustomer(), emptyTransaction(), TransactionPayload, admin, approved() (+5 more)

### Community 12 - "Transaction Draft Forms"
Cohesion: 0.17
Nodes (9): 247e167 Apply one Accurate warehouse to all order lines, 7da771f Require warehouse on every line before order approval and publication, b6b29ee Publish quotations to Accurate before selecting sales orders, 247e167 Apply one Accurate warehouse to all order lines, EditorForm(), EditorProps, safeEstimate(), PublicationPanel() (+1 more)

### Community 13 - "Authentication and Storage Guides"
Cohesion: 0.21
Nodes (13): Existing Accurate documents and master data remain read-only, Gastro Intranet: three-company commercial workspace, Intranet draft, sequence, request, and business-audit tables, Unit/API fixtures mock Accurate writes and avoid live trials, Google Sign-In and whitelist guide, Google OIDC authentication, Intranet user, session, OAuth-flow, and user-audit tables, Local Node.js 24 runtime at localhost:3100 (+5 more)

### Community 14 - "Publication and Approval Policy"
Cohesion: 0.21
Nodes (13): Append-only transactional business audit, Local drafts with audit, optimistic version, and request keys, Importer owns local PO drafts, Importer head/admin approves and creates PO, SO internal notes remain local and audited, Purchase order after internal approval and confirmation, Dedicated create-only SQ/PO/SO publication service, Persisted publication reservation and audit transaction (+5 more)

### Community 15 - "Company Access and Reconciliation"
Cohesion: 0.20
Nodes (11): Authenticated three-company Accurate read verification, Allowlisted server-side Accurate GET transport, Master admin manages users, roles, and allowed companies, Server-enforced role, company, and ownership authorization, Active company isolates commercial data and master identities, Graph memory of authenticated Accurate verification, PUBLISHING / UNCERTAIN / PUBLISHED publication locks, Read-only uncertain-outcome reconciliation (+3 more)

### Community 16 - "Docker Environment and Mapping"
Cohesion: 0.22
Nodes (10): Read-only WMS environment or direct Accurate keys, Existing intranet.davay.space Cloudflare tunnel, Docker Desktop standalone Next.js service, Persistent isolated Intranet SQLite volume, Docker environment and operation guide, Local Graphify Studio service on port 3101, Paired server-only Google OAuth configuration, Portable graph publication and local runtime artifacts (+2 more)

### Community 17 - "Transaction Estimates"
Cohesion: 0.29
Nodes (7): EstimatedLine, estimateTransaction(), money(), rounded(), scaled(), TransactionEstimate, TransactionLine

### Community 18 - "Responsive Interface Review"
Cohesion: 0.29
Nodes (8): Responsive dialog focus and scroll handling, Surgical presentation changes preserve business rules, Aligned mobile master and transaction cards, Labeled accessible list pagination, Browser viewport and interaction verification, WMS and Portal responsive navigation shell, Simple centered Google login card, Responsive UI review and reference evidence

### Community 19 - "Project Policies and History"
Cohesion: 0.29
Nodes (7): Storage and deployment documentation, Historical read-only wording conflicts with current publication policy, Next.js 16 development API requirements, AGENTS: authoritative working boundaries, Promax repository with original Git history, Accurate publication workflow and recovery, README: application overview and local operation

### Community 20 - "Continuous Integration Gates"
Cohesion: 0.40
Nodes (6): CI installs lockfile, lints, typechecks, tests, builds, GitHub Actions verification and production deployment, Verified-main-only deployment gate, Explicit isolated PostgreSQL tests with temporary schemas, Verified GitHub-to-Vercel deployment guide, Vercel gastro-intranet production hosting

### Community 21 - "Accurate Research and Limitations"
Cohesion: 0.40
Nodes (5): Company-specific currency, tax/DPP, item, and source semantics, Accurate field matrix: September 24 research snapshot, Publication validates warehouses, tax, supported fields, and readback, Accurate read-only research: September 24 snapshot, Historical bounded samples do not establish business requirements

### Community 22 - "Gastro Brand Asset"
Cohesion: 1.00
Nodes (1): Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band

## Ambiguous Edges - Review These
- `Storage and deployment documentation` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/deployment.md · relation: contains_historical_no_write_statement
- `Accurate field matrix: September 24 research snapshot` → `Historical read-only wording conflicts with current publication policy`  [AMBIGUOUS]
  docs/accurate-field-matrix.md · relation: contains_historical_sq_not_published_statement

## Knowledge Gaps
- **91 isolated node(s):** `privateTraceExcludes`, `config`, `STATES`, `TERMINAL_FAILURES`, `Context` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Gastro Brand Asset`** (1 nodes): `Gastro logo image with cyan and orange graphic areas, gray wordmark shapes, and a dark gray lower band`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Storage and deployment documentation` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_no_write_statement) - confidence is low._
- **What is the exact relationship between `Accurate field matrix: September 24 research snapshot` and `Historical read-only wording conflicts with current publication policy`?**
  _Edge tagged AMBIGUOUS (relation: contains_historical_sq_not_published_statement) - confidence is low._
- **Why does `PgDraftStore` connect `PostgreSQL Draft Store` to `Workflow Validation Rules`, `Identity Stores and Sessions`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `DraftStore` connect `SQLite Draft Store` to `Workflow Validation Rules`, `Accurate Transport and Payloads`, `Workflow and API Tests`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `privateTraceExcludes`, `config`, `STATES` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Identity Stores and Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.053923541247484906 - nodes in this community are weakly interconnected._
- **Should `Workflow Validation Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.0710085933966531 - nodes in this community are weakly interconnected._