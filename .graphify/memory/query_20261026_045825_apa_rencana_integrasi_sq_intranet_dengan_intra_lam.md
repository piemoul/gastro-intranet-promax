---
type: "query"
date: "2026-10-26T04:58:25.950Z"
question: "Apa rencana integrasi SQ Intranet dengan Intra lama, API WMS, Accurate tiga PT dan directory sales Baserow Gastro Portal?"
contributor: "graphify"
source_nodes: ["docs:sq", "docs:so", "docs:company_scope", "docs:publication_service", "docs:wms", "docs:whitelist"]
---

# Q: Apa rencana integrasi SQ Intranet dengan Intra lama, API WMS, Accurate tiga PT dan directory sales Baserow Gastro Portal?

## Answer

RESEARCH AND PROPOSAL ONLY, not implemented. Computer Use inspected legacy intra.gastro.co.id dashboard, SQ list/new/items/pricing analysis, item fields with tiers 0-5 and cost multipliers, customer/PIC, SO new, logs and reports. Report page showed an error. Existing Intranet has Google whitelist, scoped Accurate GET reads, draft audit/versioning and guarded SQ/SO create publication. It lacks unified WMS availability, legacy commercial metadata/pricebook/PDF and directory integration. Read-only transaction against the running WMS database found item_catalog with company_id, normalized_sku and unit metadata: 1231 GGS, 173 RSP and 177 SRI rows, with brand/model populated. Shared Neon has only one master_admin in intranet_users and no complete client/supplier/salesperson master tables. Running WMS image is gastro-wms:ui-d88a7ed; its source still restricts SO to an explicit trial-number allowlist, so production SO handoff requires a separately reviewed WMS release. Runtime integration must be through authenticated APIs per user direction, not direct queries by Intranet into WMS operational tables. Baserow preview and Gastro Portal source/runtime identify Employee Primary table 1171967 as directory; the initially opened Employee 1171789 table is different. Portal uses EMAIL OFFICIAL, NAMA, COMPANY, DEPARTMENT, JOB TITLE, ROLE, STATUS and Active; sales membership is SALES & MARKETING. Proposed: minimal Portal directory API for Google whitelist and sales picker, explicit local Intranet role/PT grants, WMS integration API for brand/model/SKU/availability with tenant/warehouse scope, and Accurate-backed client/vendor reference caches in separate intranet_ tables in shared Neon. Preserve separate app authentication and server-only credentials. Reuse existing publication reservation/read-back/uncertain locks. SQ must not reserve physical stock. Client master writes require resolving the current AGENTS no-master-mutation policy before implementation; existing clients suffice for first SQ milestone. No app, WMS, Portal, Baserow or Accurate business writes were performed.

## Source Nodes

- docs:sq
- docs:so
- docs:company_scope
- docs:publication_service
- docs:wms
- docs:whitelist