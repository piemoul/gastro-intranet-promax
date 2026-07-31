/**
 * Seed the reference data we already know for certain from the live system:
 *   - 7 branches
 *   - 6 FX-rate settings (CURR_RATE_*)
 *   - a dev admin (Yogi — SALES / CHIEF / Jakarta) so login works
 *   - the verified subset of /roles permission rules
 *
 * The FULL user list, all 56 permission rules, and master/transaction data are
 * imported later by the scraper. This seed is idempotent.
 *
 *   npm run db:seed
 */
import { eq } from "drizzle-orm";
import { db, sql } from "./_db";
import { branches, permissions, settings, users } from "@/server/db/schema";
import { hashPassword } from "@/lib/password";
import type { Department, Level, PermAction, PermModel, Scope } from "@/lib/constants";

const BRANCHES = [
  "Jakarta",
  "Semarang",
  "Denpasar",
  "Bandung",
  "Surabaya",
  "Z - CLOSED ACCOUNT",
  "Z - TESTING",
];

const FX_SETTINGS: [string, string][] = [
  ["CURR_RATE_USD_IDR", "18250.0"],
  ["CURR_RATE_EUR_USD", "1.15"],
  ["CURR_RATE_SGD_USD", "0.8"],
  ["CURR_RATE_JPY_USD", "0.0075"],
  ["CURR_RATE_NZD_USD", "0.65"],
  ["CURR_RATE_RMB_USD", "0.15"],
];

type RuleSeed = {
  department: Department;
  levelMin: Level;
  levelMax: Level;
  model: PermModel;
  action: PermAction;
  scope: Scope;
  sourceField: string | null;
  destField: string | null;
};

// Verified subset of the /roles matrix (DEPT SALES + DEPT ALL). Full set → scraper.
const RULES: RuleSeed[] = [
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Customer", action: "cru", scope: "SELF", sourceField: "id", destField: "default_sales_id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Quotation", action: "cru", scope: "SELF", sourceField: "id", destField: "sales_id" },
  { department: "SALES", levelMin: "MANAGER", levelMax: "CHIEF", model: "Customer", action: "cru", scope: "BRANCH", sourceField: "id", destField: "id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Item", action: "index", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Item", action: "new", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Item", action: "create", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "SENIOR MANAGER", levelMax: "CHIEF", model: "Customer", action: "crud", scope: "BRANCH", sourceField: "id", destField: "id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Customer", action: "index", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Customer", action: "show", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "MANAGER", levelMax: "CHIEF", model: "Quotation", action: "cru", scope: "ALL", sourceField: null, destField: null },
  { department: "ALL", levelMin: "STAFF", levelMax: "CHIEF", model: "User", action: "edit", scope: "SELF", sourceField: "id", destField: "id" },
  { department: "ALL", levelMin: "STAFF", levelMax: "CHIEF", model: "User", action: "update", scope: "SELF", sourceField: "id", destField: "id" },
];

async function main() {
  console.log("Seeding reference data…");

  // Branches (skip if a branch with the same name already exists).
  const existingBranches = await db.select({ name: branches.name }).from(branches);
  const have = new Set(existingBranches.map((b) => b.name));
  const toInsert = BRANCHES.filter((n) => !have.has(n)).map((name) => ({ name }));
  if (toInsert.length) await db.insert(branches).values(toInsert);
  console.log(`  branches: +${toInsert.length} (total intended ${BRANCHES.length})`);

  // Settings (upsert by key).
  for (const [key, value] of FX_SETTINGS) {
    await db
      .insert(settings)
      .values({ key, valueDecimal: value })
      .onConflictDoUpdate({ target: settings.key, set: { valueDecimal: value, updatedAt: new Date() } });
  }
  console.log(`  settings: ${FX_SETTINGS.length} FX rates`);

  // Permissions are fully derived — reset and reinsert the verified subset.
  await db.delete(permissions);
  await db.insert(permissions).values(RULES);
  console.log(`  permissions: ${RULES.length} rules`);

  // Dev admin — Yogi (SALES / CHIEF / Jakarta). Login with LEGACY_PASSWORD.
  const [jakarta] = await db.select().from(branches).where(eq(branches.name, "Jakarta"));
  const adminEmail = "yogi.k@gastro.co.id";
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (existing.length === 0) {
    const pw = process.env.SEED_ADMIN_PASSWORD ?? process.env.LEGACY_PASSWORD ?? "gastro123";
    await db.insert(users).values({
      email: adminEmail,
      name: "Yogi Gunario",
      nickname: "Yogi",
      department: "SALES",
      level: "CHIEF",
      branchId: jakarta?.id,
      passwordHash: await hashPassword(pw),
      active: true,
    });
    console.log(`  users: +1 dev admin (${adminEmail})`);
  } else {
    console.log(`  users: admin already present (${adminEmail})`);
  }

  console.log("Done.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
