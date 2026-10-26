import { referenceGet } from "../src/server/integrations/reference-api";
import { directoryGrants } from "../src/server/auth/portal-policy";
import { getUsers } from "../src/server/auth/users";

const grants=directoryGrants(await referenceGet("PORTAL",{resource:"directory"}));
const apply=process.argv.includes("--apply");
if(apply){const users=getUsers();try{await users.syncDirectory(grants);}finally{await users.close();}}
console.log(JSON.stringify({applied:apply,source:"gastro-portal-baserow",activeSales:grants.filter(g=>g.active&&g.role==="sales").length,activeSuperAdmins:grants.filter(g=>g.active&&g.role==="master_admin").length,writesToAccurate:0}));
