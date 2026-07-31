/**
 * Pure permission engine ported from the legacy Rails /roles matrix.
 *
 * A rule grants `model::action` to a department, for a contiguous level range
 * [levelMin..levelMax], with a row visibility `scope`:
 *   - ALL    → every row
 *   - BRANCH → rows in the actor's branch
 *   - SELF   → rows where `destField` (on the row) equals `sourceField` (on the
 *              actor), e.g. quotations.sales_id === actor.id
 *
 * This module is intentionally free of DB/Next imports so it can be unit-tested
 * in isolation. The Drizzle `where` binding lives in server/auth/guard.ts.
 */
import {
  LEVEL_ORDER,
  expandAction,
  type Department,
  type Level,
  type PermAction,
  type PermModel,
  type PrimitiveAction,
  type Scope,
} from "./constants";

/** A permission rule as stored (action still in shorthand cru/crud form). */
export type Rule = {
  department: Department;
  levelMin: Level;
  levelMax: Level;
  model: PermModel;
  action: PermAction;
  scope: Scope;
  sourceField: string | null;
  destField: string | null;
};

/**
 * The authenticated actor's attributes the engine reasons over. `department` and
 * `level` are plain strings (not the enums) because real users carry values
 * outside the controlled permission set; the engine fails safe on unknowns.
 */
export type Actor = {
  id: number;
  department: string | null;
  level: string | null;
  branchId: number | null;
};

/** A resolved visibility scope for one (actor, model, action). */
export type EffectiveScope =
  | { kind: "ALL" }
  | { kind: "BRANCH" }
  | { kind: "SELF"; sourceField: string; destField: string };

/** Does a rule's department apply to this actor? DEPT "ALL" applies to everyone. */
function departmentMatches(rule: Rule, actor: Actor): boolean {
  if (rule.department === "ALL") return true;
  return actor.department === rule.department;
}

/** Is the actor's level within the rule's [min..max] range (inclusive)? */
function levelInRange(rule: Rule, actor: Actor): boolean {
  if (!actor.level) return false;
  const lvl = LEVEL_ORDER[actor.level as Level];
  if (lvl == null) return false; // unknown level → fails safe
  return lvl >= LEVEL_ORDER[rule.levelMin] && lvl <= LEVEL_ORDER[rule.levelMax];
}

/** Rules that apply to this actor for a given model + primitive action. */
export function matchingRules(
  rules: Rule[],
  actor: Actor,
  model: PermModel,
  action: PrimitiveAction,
): Rule[] {
  return rules.filter(
    (r) =>
      r.model === model &&
      departmentMatches(r, actor) &&
      levelInRange(r, actor) &&
      expandAction(r.action).includes(action),
  );
}

/** Is the actor allowed to perform model::action at all (ignoring which rows)? */
export function can(
  rules: Rule[],
  actor: Actor,
  model: PermModel,
  action: PrimitiveAction,
): boolean {
  return matchingRules(rules, actor, model, action).length > 0;
}

/**
 * Collapse matching rules into the visibility scopes that apply. Row access is a
 * UNION: a row is visible if ANY matching rule permits it. So if any rule is
 * ALL, that dominates (returns [{ALL}]); otherwise the distinct BRANCH/SELF
 * scopes are OR'd by the caller.
 */
export function effectiveScopes(
  rules: Rule[],
  actor: Actor,
  model: PermModel,
  action: PrimitiveAction,
): EffectiveScope[] {
  const matched = matchingRules(rules, actor, model, action);
  if (matched.length === 0) return [];
  if (matched.some((r) => r.scope === "ALL")) return [{ kind: "ALL" }];

  const out: EffectiveScope[] = [];
  let hasBranch = false;
  const selfSeen = new Set<string>();
  for (const r of matched) {
    if (r.scope === "BRANCH") {
      if (!hasBranch) {
        hasBranch = true;
        out.push({ kind: "BRANCH" });
      }
    } else if (r.scope === "SELF") {
      const src = r.sourceField ?? "id";
      const dest = r.destField ?? "id";
      const key = `${src}->${dest}`;
      if (!selfSeen.has(key)) {
        selfSeen.add(key);
        out.push({ kind: "SELF", sourceField: src, destField: dest });
      }
    }
  }
  return out;
}

/**
 * Convenience: the widest scope an actor has (ALL > BRANCH > SELF > none).
 * Handy for UI hints ("you see all quotations" vs "only your own").
 */
export function widestScope(
  rules: Rule[],
  actor: Actor,
  model: PermModel,
  action: PrimitiveAction,
): "ALL" | "BRANCH" | "SELF" | "NONE" {
  const scopes = effectiveScopes(rules, actor, model, action);
  if (scopes.some((s) => s.kind === "ALL")) return "ALL";
  if (scopes.some((s) => s.kind === "BRANCH")) return "BRANCH";
  if (scopes.some((s) => s.kind === "SELF")) return "SELF";
  return "NONE";
}
