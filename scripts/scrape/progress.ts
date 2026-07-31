/** Live scrape progress: current row counts. Run anytime during a scrape. */
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, sql } from "../_db";
import { customers, itemBrands, items, quotationItems, quotations, users } from "@/server/db/schema";

async function n(t: PgTable) {
  const [r] = await db.select({ c: count() }).from(t);
  return r.c;
}
async function main() {
  console.log("items:      ", await n(items), "/ ~7497");
  console.log("customers:  ", await n(customers), "/ ~5891");
  console.log("quotations: ", await n(quotations), "/ ~23121");
  console.log("quo. lines: ", await n(quotationItems));
  console.log("users:      ", await n(users), "/ 58");
  console.log("brands:     ", await n(itemBrands), "/ 114");
  await sql.end();
}
main();
