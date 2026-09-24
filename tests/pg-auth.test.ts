import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { PgUserStore } from "../src/server/auth/pg-users";
import { AuthError, MASTER_ADMIN_EMAIL } from "../src/server/auth/users";
import { createSql } from "../src/server/postgres";

const testUrl=process.env.INTRANET_TEST_DATABASE_URL;
const denied=(error:unknown)=>error instanceof AuthError;
const identity=(email:string,sub:string)=>({email,sub,emailVerified:true,authoritative:true});

/** Explicit opt-in only. Every query runs in a temporary Intranet test schema, never public/WMS tables. */
test("PostgreSQL authentication persists and enforces production invariants",{skip:!testUrl},async context=>{
  const connection=createSql(testUrl!);
  const schema=`intranet_auth_test_${randomUUID().replaceAll("-","")}`;
  await connection`CREATE SCHEMA ${connection(schema)}`;
  // Transaction-local search_path works with both direct PostgreSQL and transaction poolers.
  const scoped=Object.assign(
    (strings:TemplateStringsArray,...parameters:unknown[])=>connection.begin(async tx=>{
      await tx`SELECT set_config('search_path',${schema},true)`;
      return (tx as unknown as (strings:TemplateStringsArray,...parameters:unknown[])=>Promise<unknown>)(strings,...parameters);
    }),
    {begin:<T>(callback:(tx:TransactionSql)=>Promise<T>)=>connection.begin(async tx=>{await tx`SELECT set_config('search_path',${schema},true)`;return callback(tx);}),end:async()=>{},json:connection.json.bind(connection)},
  ) as unknown as Sql;
  const store=new PgUserStore(scoped),other=new PgUserStore(scoped);
  try {
    const current=await scoped<{schema:string}[]>`SELECT current_schema() AS schema`;
    assert.equal(current[0].schema,schema,"Refuse to migrate unless test schema isolation is confirmed.");
    await store.ready();
    const master=await store.authenticateIdentity(identity(MASTER_ADMIN_EMAIL,"integration-master"));
    const masterToken=await store.createSession(master);
    const admin=(await store.actor(masterToken))!;
    const first=await store.save(admin,{email:"sales@intranet-fixture.example",name:"Fixture Sales",role:"sales",companyIds:[1,2],active:true});
    let salesToken="";

    await context.test("migrations seed only one immutable master, reject role escalation and protect audit rows",async()=>{
      await other.ready();
      assert.equal((await other.list(admin)).filter(user=>user.role==="master_admin").length,1);
      await assert.rejects(()=>store.save(admin,{name:"Changed",role:"sales",companyIds:[1],active:false},master.id),denied);
      await assert.rejects(()=>store.save(admin,{email:"intruder@fixture.example",name:"Intruder",role:"master_admin",companyIds:[1]}));
      await assert.rejects(()=>scoped`UPDATE intranet_users SET active=FALSE WHERE id='master-admin'`);
      await assert.rejects(()=>scoped`DELETE FROM intranet_users WHERE id='master-admin'`);
      await assert.rejects(()=>scoped`UPDATE intranet_user_audit SET action='tampered'`,/append-only/);
      await assert.rejects(()=>scoped`DELETE FROM intranet_user_audit`,/append-only/);
      await assert.rejects(()=>scoped`TRUNCATE intranet_user_audit`,/append-only/);
      await assert.rejects(()=>scoped`TRUNCATE intranet_users CASCADE`,/immutable/);
    });

    await context.test("unlisted and unverified identities cannot sign in; first binding persists across instances",async()=>{
      await assert.rejects(()=>store.authenticateIdentity(identity("unknown@fixture.example","unknown-sub")),denied);
      await assert.rejects(()=>store.authenticateIdentity({...identity(first.email,"sales-sub"),emailVerified:false}),denied);
      await assert.rejects(()=>store.authenticateIdentity({...identity(first.email,"sales-sub"),authoritative:false}),denied);
      await assert.rejects(()=>store.createSession(first),denied);
      const bound=await store.authenticateIdentity(identity(first.email,"sales-sub"));
      salesToken=await store.createSession(bound);
      assert.equal((await other.byId(first.id))?.googleSub,"sales-sub");
      assert.equal((await other.actor(salesToken))?.role,"sales");
      assert.equal((await other.actor(salesToken))?.teamId,"sales");
      await assert.rejects(()=>store.list({...admin,userId:first.id}),denied);
    });

    await context.test("concurrent first logins cannot bind two Google subjects to one account",async()=>{
      const user=await store.save(admin,{email:"race@intranet-fixture.example",name:"Race Account",role:"importer",companyIds:[1],active:true});
      const results=await Promise.allSettled([store.authenticateIdentity(identity(user.email,"race-a")),other.authenticateIdentity(identity(user.email,"race-b"))]);
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
      assert.equal(results.filter(result=>result.status==="rejected").length,1);
      const pinned=(await store.byId(user.id))!.googleSub;
      assert.ok(pinned==="race-a"||pinned==="race-b");
      const rows=await scoped<{count:number}[]>`SELECT count(*)::integer AS count FROM intranet_user_audit WHERE target=${user.id} AND action='google_identity_bound'`;
      assert.equal(rows[0].count,1);
      await assert.rejects(()=>scoped`UPDATE intranet_users SET google_sub='replaced-sub' WHERE id=${user.id}`,/immutable/);
      await assert.rejects(()=>store.authenticateIdentity(identity(first.email,pinned!)),denied);
    });

    await context.test("duplicate Google subjects across separate accounts are rejected atomically",async()=>{
      const user=await store.save(admin,{email:"different@intranet-fixture.example",name:"Different Account",role:"sales",companyIds:[1],active:true});
      await assert.rejects(()=>store.authenticateIdentity(identity(user.email,"sales-sub")),denied);
      assert.equal((await store.byId(user.id))?.googleSub,null);
      const rows=await scoped<{count:number}[]>`SELECT count(*)::integer AS count FROM intranet_user_audit WHERE target=${user.id} AND action='google_identity_bound'`;
      assert.equal(rows[0].count,0);
    });

    await context.test("company switching, session revocation and permission updates are persisted",async()=>{
      assert.equal((await other.changeCompany(salesToken,2)).companyId,2);
      assert.equal((await store.actor(salesToken))?.companyId,2);
      await assert.rejects(()=>store.changeCompany(salesToken,3),denied);
      const updated=await store.save(admin,{name:first.name,role:"head_importer",companyIds:[3],active:true},first.id);
      assert.equal(await other.actor(salesToken),null);
      const fresh=await other.createSession(updated);
      assert.equal((await store.actor(fresh))?.role,"head_importer");
      assert.equal((await store.actor(fresh))?.companyId,3);
      await store.save(admin,{name:first.name,role:"head_importer",companyIds:[3],active:false},first.id);
      assert.equal(await other.actor(fresh),null);
      await assert.rejects(()=>store.createSession(updated),denied);
    });

    await context.test("sessions store only token hashes, expire and can be revoked across instances",async()=>{
      const token=await store.createSession(master);
      const tokenHash=createHash("sha256").update(token).digest("hex");
      const rows=await scoped<{hash:string}[]>`SELECT hash FROM intranet_sessions WHERE hash=${tokenHash}`;
      assert.equal(rows[0].hash,tokenHash);assert.notEqual(rows[0].hash,token);
      await scoped`UPDATE intranet_sessions SET expires=${Date.now()-1} WHERE hash=${tokenHash}`;
      assert.equal(await other.actor(token),null);
      const fresh=await store.createSession(master);await other.logout(fresh);
      assert.equal(await store.actor(fresh),null);
    });

    await context.test("OAuth flows have valid PKCE, expire, and allow exactly one concurrent consumer",async()=>{
      const flow=await store.beginOAuth();
      assert.equal(flow.challenge,createHash("sha256").update(flow.verifier).digest("base64url"));
      const results=await Promise.allSettled([store.consumeOAuth(flow.state),other.consumeOAuth(flow.state)]);
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
      assert.equal(results.filter(result=>result.status==="rejected").length,1);
      const expired=await store.beginOAuth(),stateHash=createHash("sha256").update(expired.state).digest("hex");
      await scoped`UPDATE intranet_oauth_flows SET expires=${Date.now()-1} WHERE hash=${stateHash}`;
      await assert.rejects(()=>other.consumeOAuth(expired.state),denied);
    });

    await context.test("audit insertion failure rolls back account edits and session deletion",async()=>{
      const account=await store.save(admin,{email:"rollback@intranet-fixture.example",name:"Rollback Account",role:"sales",companyIds:[1],active:true});
      const bound=await store.authenticateIdentity(identity(account.email,"rollback-sub"));
      const token=await store.createSession(bound);
      await scoped`CREATE FUNCTION intranet_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated audit failure'; END; $$`;
      await scoped`CREATE TRIGGER intranet_test_audit_failure BEFORE INSERT ON intranet_user_audit FOR EACH ROW EXECUTE FUNCTION intranet_test_fail_audit()`;
      try {
        await assert.rejects(()=>store.save(admin,{name:"Changed Name",role:"importer",companyIds:[2],active:false},account.id),/Simulated audit failure/);
        assert.deepEqual(await store.byId(account.id),bound);
        assert.ok(await other.actor(token));
      }finally{await scoped`DROP TRIGGER intranet_test_audit_failure ON intranet_user_audit`;}
    });
  }finally{
    await connection`DROP SCHEMA IF EXISTS ${connection(schema)} CASCADE`;
    await connection.end({timeout:5});
  }
});
