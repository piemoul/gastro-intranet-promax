import "server-only";
import { referenceGet } from "../integrations/reference-api";
import { directoryGrants } from "./portal-policy";
import { getUsers } from "./users";

let expires=0;
let pending:Promise<void>|undefined;
/** Complete snapshots only. Errors cannot revoke or grant users. Login/requests fail closed for Portal accounts. */
export async function refreshPortalDirectory(force=false) {
  if(!process.env.INTRANET_PORTAL_API_URL) return;
  if(!force&&Date.now()<expires)return;
  if(pending)return pending;
  pending=(async()=>{
    const grants=directoryGrants(await referenceGet("PORTAL",{resource:"directory"}));
    await getUsers().syncDirectory(grants);
    expires=Date.now()+60000;
  })();
  try{await pending;}finally{pending=undefined;}
}
