import { randomUUID } from "node:crypto";
import type { Actor, Draft } from "../lib/domain";
import { validateCompletePayload } from "../lib/validation";
import { assertPublish, WorkflowError } from "./workflow";

export type PublicationResult = { outcome:"published"; id:number; number:string } | { outcome:"rejected"|"uncertain"; error:string };
export function beginPublication(actor:Actor, before:Draft):Draft {
  assertPublish(actor,before);
  validateCompletePayload(before.kind,before.payload);
  const now=new Date().toISOString(),attemptId=randomUUID();
  return {...before,status:"PUBLISHING",version:before.version+1,updatedAt:now,publication:{attemptId,marker:`[INTRANET:${before.id}:${attemptId}]`,startedAt:now,actorId:actor.userId}};
}
export function finishPublication(before:Draft,attemptId:string,result:PublicationResult):Draft {
  if (!before.publication || before.publication.attemptId!==attemptId) throw new WorkflowError("PUBLICATION_CONFLICT","Percobaan publikasi tidak cocok.",409);
  if (before.status==="PUBLISHED") return before; // A late timeout must never overwrite verified success.
  if (!["PUBLISHING","UNCERTAIN"].includes(before.status)) throw new WorkflowError("PUBLICATION_CONFLICT","Publikasi telah selesai.",409);
  if (result.outcome==="published" && (!Number.isSafeInteger(result.id)||result.id<=0||!result.number.trim())) throw new WorkflowError("PUBLICATION_RESULT","Identitas dokumen Accurate tidak valid.",409);
  return {...before,status:result.outcome==="published"?"PUBLISHED":result.outcome==="rejected"?"APPROVED":"UNCERTAIN",version:before.version+1,updatedAt:new Date().toISOString(),publication:{...before.publication,...(result.outcome==="published"?{accurateId:result.id,accurateNumber:result.number,error:undefined}:{error:result.error})}};
}
