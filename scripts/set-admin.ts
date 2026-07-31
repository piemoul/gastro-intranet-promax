/**
 * Grant/revoke admin. Admins see the Administration menu and approve SOs.
 *   npx tsx scripts/set-admin.ts yogi.k@gastro.co.id
 *   npx tsx scripts/set-admin.ts someone@gastro.co.id --revoke
 */
import { eq } from "drizzle-orm";
import { db, sql as pg } from "./_db";
import { users } from "@/server/db/schema";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email) throw new Error("Usage: tsx scripts/set-admin.ts <email> [--revoke]");

  const updated = await db
    .update(users)
    .set({ isAdmin: !revoke, updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id, name: users.name, isAdmin: users.isAdmin });

  if (updated.length === 0) console.log(`User ${email} tidak ditemukan.`);
  else console.log(`${updated[0].name} <${email}> → isAdmin = ${updated[0].isAdmin}`);

  const admins = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.isAdmin, true));
  console.log(`\nAdmin saat ini (${admins.length}):`);
  for (const a of admins) console.log(`  ${a.name} <${a.email}>`);
  await pg.end();
}
main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
