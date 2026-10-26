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
  if (kind === "SO" && !hasSource) throw new WorkflowError("SO_REQUIRES_QUOTATION", "SO lokal harus berasal dari SQ Accurate yang dipilih atau referensi SO Accurate.",400);
}

export function assertEdit(actor:Actor,draft:Draft) {
  assertDraftAccess(actor,draft);
  assertUnpublished(draft);
  if(draft.kind==="SQ"&&draft.source)throw new WorkflowError("ACCURATE_READ_ONLY","SQ Accurate adalah referensi untuk SO dan tidak dapat diedit di Intranet.",409);
  if (isHeadForKind(actor,draft.kind)) return;
  if (draft.kind === "SO" || draft.ownerId !== actor.userId || !["DRAFT","REVISION"].includes(draft.status)) throw new WorkflowError("FORBIDDEN", "Draft ini hanya dapat diubah oleh kepala bagian.",403);
}

export function assertTransition(actor:Actor,draft:Draft,action:DraftAction,reason:string) {
  assertDraftAccess(actor,draft);
  if (action === "promote") {
    if (!isHeadForKind(actor,"SO")) throw new WorkflowError("FORBIDDEN","Hanya kepala sales atau master admin yang dapat memilih SQ untuk SO.",403);
    if (!quotationReference(draft)) throw new WorkflowError("SQ_NOT_PUBLISHED","SQ harus tersimpan di Accurate sebelum dipilih untuk SO.",409);
    return;
  }
  assertUnpublished(draft);
  if(action==="approve"&&draft.kind==="SQ"&&actor.role!=="master_admin")throw new WorkflowError("FORBIDDEN","SQ harus disetujui Super Admin.",403);
  if(action==="approve"&&draft.kind==="SQ"&&draft.payload.type==="transaction"&&!draft.payload.sqDetails?.pricingReviewed)throw new WorkflowError("SQ_REVIEW_REQUIRED","Admin harus meninjau harga dan melengkapi pemetaan barang sebelum persetujuan SQ.",409);
  if (action === "submit") {
    assertEdit(actor,draft);
    if (!["DRAFT","REVISION"].includes(draft.status)) throw new WorkflowError("INVALID_TRANSITION", "Hanya draft atau dokumen revisi yang dapat diajukan.",409);
    return;
  }
  if (!isHeadForKind(actor,draft.kind)) throw new WorkflowError("FORBIDDEN", "Tindakan ini memerlukan kepala bagian.",403);
  if (["revise","reopen","demote"].includes(action) && !reason) throw new WorkflowError("REASON_REQUIRED", "Berikan alasan perubahan status.",400);
  const valid = action === "approve" ? draft.status === "SUBMITTED" : action === "revise" || action === "reopen" ? ["SUBMITTED","APPROVED"].includes(draft.status) : action === "demote" ? draft.kind === "SO" : false;
  if (!valid) throw new WorkflowError("INVALID_TRANSITION", "Tindakan tidak sesuai dengan jenis atau status draft.",409);
  if (action === "demote" && draft.source) throw new WorkflowError("ACCURATE_READ_ONLY", "SO yang berasal dari Accurate tidak dapat dimundurkan pada tahap read-only. Accurate tidak diubah.",409);
}

export function assertUnpublished(draft:Draft) {
  if (["PUBLISHING","PUBLISHED","UNCERTAIN"].includes(draft.status)) throw new WorkflowError("PUBLICATION_LOCKED", "Dokumen sedang dikirim atau sudah dibuat di Accurate. Perubahan dan pengiriman ulang dikunci.",409);
}
export function assertPublish(actor:Actor,draft:Draft) {
  assertDraftAccess(actor,draft);
  if (draft.kind==="SQ" && !draft.source && !draft.quotation) {
    if (actor.role!=="master_admin") throw new WorkflowError("FORBIDDEN","Hanya Super Admin yang dapat menerbitkan SQ yang telah disetujui.",403);
    assertUnpublished(draft);
    if(draft.status!=="APPROVED"||!draft.approvedBy||draft.approvalPolicy!=="SQ_SUPER_ADMIN_V1")throw new WorkflowError("PUBLICATION_STATUS","SQ harus disetujui Super Admin sebelum dibuat di Accurate.",409);
    return;
  }
  if (!isHeadForKind(actor,draft.kind)) throw new WorkflowError("FORBIDDEN","Hanya kepala bagian terkait atau master admin yang dapat membuat dokumen Accurate.",403);
  if (!["PO","SO"].includes(draft.kind) || draft.source) throw new WorkflowError("PUBLICATION_KIND","Hanya PO/SO internal baru yang dapat dibuat di Accurate. Usulan perubahan dokumen Accurate tetap lokal.",409);
  if (draft.kind==="SO" && !draft.quotation) throw new WorkflowError("SO_REQUIRES_QUOTATION","Pilih SQ yang sudah tersimpan di Accurate untuk membuat SO.",409);
  if (draft.status !== "APPROVED" || !draft.approvedBy) throw new WorkflowError("PUBLICATION_STATUS","Selesaikan persetujuan internal sebelum membuat dokumen Accurate.",409);
}

/** Only durable, server-issued references can establish SQ provenance. */
export function quotationReference(draft:Draft):{id:number;number:string}|undefined {
  if(draft.kind!=="SQ")return undefined;
  if(draft.source?.kind==="SQ")return {id:draft.source.id,number:draft.source.number};
  if(draft.status!=="PUBLISHED")return undefined;
  if(draft.quotation)return draft.quotation;
  if(draft.publication?.accurateId&&draft.publication.accurateNumber)return {id:draft.publication.accurateId,number:draft.publication.accurateNumber};
}
