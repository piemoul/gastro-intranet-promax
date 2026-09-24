import type { Actor, Draft, DraftAction, DraftKind } from "../lib/domain";

export class WorkflowError extends Error {
  constructor(public readonly code:string, message:string, public readonly status:number = 400) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function assertActor(actor:Actor) {
  if (!actor || !actor.userId?.trim() || !actor.name?.trim() || !actor.teamId?.trim() || ![1,2,3].includes(actor.companyId) || !actor.companyIds?.includes(actor.companyId) || !["sales","head_sales","importer","head_importer","master_admin"].includes(actor.role)) {
    throw new WorkflowError("UNAUTHENTICATED", "Sesi atau akses perusahaan tidak valid.", 401);
  }
}

export function isHeadForKind(actor:Actor, kind:DraftKind):boolean {
  return actor.role === "master_admin" || (kind === "PO" || kind.startsWith("ITEM") ? actor.role === "head_importer" : actor.role === "head_sales");
}

export function canSeeDraft(actor:Actor, draft:Draft):boolean {
  if (draft.companyId !== actor.companyId || !actor.companyIds.includes(draft.companyId)) return false;
  if (actor.role === "master_admin") return true;
  if (draft.teamId !== actor.teamId) return false;
  if (isHeadForKind(actor,draft.kind)) return true;
  return draft.ownerId === actor.userId && (actor.role === "sales" ? draft.kind === "SQ" || draft.kind === "SO" : actor.role === "importer" ? draft.kind === "PO" : false);
}

export function assertDraftAccess(actor:Actor,draft:Draft) {
  assertActor(actor);
  if (!canSeeDraft(actor,draft)) throw new WorkflowError("FORBIDDEN", "Anda tidak memiliki akses ke draft ini.",403);
}

export function assertCreateKind(actor:Actor,kind:DraftKind,hasSource:boolean) {
  assertActor(actor);
  const allowed = isHeadForKind(actor,kind) || (actor.role === "sales" && kind === "SQ") || (actor.role === "importer" && kind === "PO");
  if (!allowed) throw new WorkflowError("FORBIDDEN", "Peran Anda tidak dapat membuat jenis draft ini.",403);
  if (hasSource && !isHeadForKind(actor,kind)) throw new WorkflowError("FORBIDDEN", "Hanya kepala bagian yang dapat menyiapkan perubahan dokumen Accurate.",403);
  if (kind === "SO" && !hasSource) throw new WorkflowError("SO_REQUIRES_QUOTATION", "SO lokal harus berasal dari SQ yang disetujui atau referensi SO Accurate.",400);
}

export function assertEdit(actor:Actor,draft:Draft) {
  assertDraftAccess(actor,draft);
  if (isHeadForKind(actor,draft.kind)) return;
  if (draft.kind === "SO" || draft.ownerId !== actor.userId || !["DRAFT","REVISION"].includes(draft.status)) throw new WorkflowError("FORBIDDEN", "Draft ini hanya dapat diubah oleh kepala bagian.",403);
}

export function assertTransition(actor:Actor,draft:Draft,action:DraftAction,reason:string) {
  assertDraftAccess(actor,draft);
  if (action === "submit") {
    assertEdit(actor,draft);
    if (!["DRAFT","REVISION"].includes(draft.status)) throw new WorkflowError("INVALID_TRANSITION", "Hanya draft atau dokumen revisi yang dapat diajukan.",409);
    return;
  }
  if (!isHeadForKind(actor,draft.kind)) throw new WorkflowError("FORBIDDEN", "Tindakan ini memerlukan kepala bagian.",403);
  if (["revise","reopen","demote"].includes(action) && !reason) throw new WorkflowError("REASON_REQUIRED", "Berikan alasan perubahan status.",400);
  const valid = action === "approve" ? draft.status === "SUBMITTED" : action === "revise" || action === "reopen" ? ["SUBMITTED","APPROVED"].includes(draft.status) : action === "promote" ? draft.kind === "SQ" && draft.status === "APPROVED" : action === "demote" ? draft.kind === "SO" : false;
  if (!valid) throw new WorkflowError("INVALID_TRANSITION", "Tindakan tidak sesuai dengan jenis atau status draft.",409);
  if (action === "demote" && draft.source) throw new WorkflowError("ACCURATE_READ_ONLY", "SO yang berasal dari Accurate tidak dapat dimundurkan pada tahap read-only. Accurate tidak diubah.",409);
}
