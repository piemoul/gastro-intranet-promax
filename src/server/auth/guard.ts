import "server-only";
import { cache } from "react";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers, permissions as permissionsTable, quotations } from "@/server/db/schema";
import {
  can as pureCan,
  effectiveScopes,
  type Actor,
  type EffectiveScope,
  type Rule,
} from "@/lib/permissions";
import type { PermModel, PrimitiveAction } from "@/lib/constants";
import { getSession } from "./session";

/** Load the full rule set once per request (React cache dedupes within a render). */
export const loadRules = cache(async (): Promise<Rule[]> => {
  const rows = await db.select().from(permissionsTable);
  return rows.map((r) => ({
    department: r.department,
    levelMin: r.levelMin,
    levelMax: r.levelMax,
    model: r.model,
    action: r.action,
    scope: r.scope,
    sourceField: r.sourceField,
    destField: r.destField,
  }));
});

/** The current actor derived from the session cookie, or null if signed out. */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const s = await getSession();
  if (!s) return null;
  return { id: s.uid, department: s.department, level: s.level, branchId: s.branchId };
});

/** Boolean permission check for the current actor. */
export async function can(model: PermModel, action: PrimitiveAction): Promise<boolean> {
  const actor = await currentActor();
  if (!actor) return false;
  return pureCan(await loadRules(), actor, model, action);
}

/** Throw (→ caller renders 403 / redirects) unless the current actor is permitted. */
export async function requirePermission(
  model: PermModel,
  action: PrimitiveAction,
): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new PermissionError("UNAUTHENTICATED", model, action);
  if (!pureCan(await loadRules(), actor, model, action))
    throw new PermissionError("FORBIDDEN", model, action);
  return actor;
}

export class PermissionError extends Error {
  constructor(
    readonly reason: "UNAUTHENTICATED" | "FORBIDDEN",
    readonly model: PermModel,
    readonly action: PrimitiveAction,
  ) {
    super(`${reason}: ${model}::${action}`);
    this.name = "PermissionError";
  }
}

/**
 * Turn one effective scope into a Drizzle predicate for the quotations table.
 * SELF maps the stored field pair to real columns; unknown fields fail closed.
 */
function quotationScopePredicate(scope: EffectiveScope, actor: Actor): SQL | undefined {
  switch (scope.kind) {
    case "ALL":
      return undefined;
    case "BRANCH":
      return actor.branchId == null
        ? sql`false`
        : eq(quotations.branchId, actor.branchId);
    case "SELF": {
      const actorVal = scope.sourceField === "branch_id" ? actor.branchId : actor.id;
      if (actorVal == null) return sql`false`;
      switch (scope.destField) {
        case "sales_id":
          return eq(quotations.salesId, actorVal);
        case "sales_admin_id":
          return eq(quotations.salesAdminId, actorVal);
        case "branch_id":
          return eq(quotations.branchId, actorVal);
        case "id":
          return eq(quotations.id, actorVal);
        default:
          return sql`false`; // fail closed on an unmapped field
      }
    }
  }
}

function customerScopePredicate(scope: EffectiveScope, actor: Actor): SQL | undefined {
  switch (scope.kind) {
    case "ALL":
      return undefined;
    case "BRANCH":
      return actor.branchId == null ? sql`false` : eq(customers.branchId, actor.branchId);
    case "SELF": {
      const actorVal = scope.sourceField === "branch_id" ? actor.branchId : actor.id;
      if (actorVal == null) return sql`false`;
      switch (scope.destField) {
        case "default_sales_id":
          return eq(customers.defaultSalesId, actorVal);
        case "branch_id":
          return eq(customers.branchId, actorVal);
        case "id":
          return eq(customers.id, actorVal);
        default:
          return sql`false`;
      }
    }
  }
}

type ScopedModel = "Quotation" | "Customer";
const PREDICATE: Record<ScopedModel, (s: EffectiveScope, a: Actor) => SQL | undefined> = {
  Quotation: quotationScopePredicate,
  Customer: customerScopePredicate,
};

/**
 * Build the row-visibility `where` clause for a scoped list query.
 *   - undefined  → actor sees everything (ALL, or the table isn't scoped)
 *   - sql`false` → actor sees nothing (no matching rule)
 *   - otherwise  → OR of the actor's SELF/BRANCH predicates
 *
 * Compose with your own filters via `and(await scopeWhere(...), myFilter)`.
 */
export async function scopeWhere(
  model: ScopedModel,
  action: PrimitiveAction = "index",
): Promise<SQL | undefined> {
  const actor = await currentActor();
  if (!actor) return sql`false`;
  const scopes = effectiveScopes(await loadRules(), actor, model, action);
  if (scopes.length === 0) return sql`false`;
  if (scopes.some((s) => s.kind === "ALL")) return undefined;

  const predicates = scopes
    .map((s) => PREDICATE[model](s, actor))
    .filter((p): p is SQL => p !== undefined);
  if (predicates.length === 0) return undefined;
  return predicates.length === 1 ? predicates[0] : or(...predicates);
}

export { and };
